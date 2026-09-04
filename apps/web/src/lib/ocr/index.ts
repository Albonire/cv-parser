import { ExtractedDocumentData, FieldConfidence } from '../../types/reader';
import { CandidateFormData } from '../../types/candidate';
import { ContractFormData } from '../../types/contract';
import { readDocxFile } from './docx-reader';
import { readPdfFile } from './pdf-reader';
import { performOcr } from './tesseract-worker';
import { classifyDocumentType } from './document-classifier';
import { parseCvText } from './parser-cv';
import { parseContractText } from './parser-contract';
import { parseIdCardText } from './parser-id';
import { parseHealthText } from './parser-health';
import { parseLiquidacionText } from './parser-liquidacion';
import { parseMemorandoText } from './parser-memorando';
import { parseFuncionesText } from './parser-funciones';
import { detectarCargos } from './cargos';
import { clasificarHistorial } from './document-classifier';
import { DocumentLayout, layoutFromPlainText } from './layout';
import { visualConsent } from './visual-consent';

const EXTENSIONES_IMAGEN = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tif', 'tiff'];

/**
 * Hay evidencia de que el documento es la hoja de vida de una persona: se leyo
 * un nombre y ademas alguna forma de identificarla o contactarla. Con menos que
 * eso se prefiere no proponer un formulario.
 *
 * Ademas, si el unico "nombre" que se pudo leer es una firma, un rol
 * institucional o una despedida ("GERENCIA", "Atentamente", "Departamento de
 * Talento Humano"), el documento no es una hoja de vida: es un memorando,
 * llamado o carta cuya cabecera el OCR mezclo con el bloque de contacto.
 */
const ES_FIRMA_O_ROL_INSTITUCIONAL =
  /(?:atentamente|cordialmente|firm[ao]\b|gerencia|direcci[oó]n\s+general|administraci[oó]n\b|recursos\s+humanos|talento\s+humano|departamento\s+(?:de\s+)?(?:personal|talento|recursos)|procesos\s+disciplinarios|gerente\s+general|recursos\s+humanos|comit[eé]\s+de\s+convivencia)/i;

function pareceHojaDeVida(candidato: CandidateFormData): boolean {
  const nombreCompleto = `${candidato.firstNames ?? ''} ${candidato.lastNames ?? ''}`.trim();
  if (ES_FIRMA_O_ROL_INSTITUCIONAL.test(nombreCompleto)) return false;

  const tieneNombre = Boolean(candidato.firstNames?.trim() && candidato.lastNames?.trim());
  if (!tieneNombre) return false;

  const contacto = [candidato.email, candidato.phone, candidato.documentNumber].filter((v) =>
    Boolean(v && String(v).trim())
  );
  const tieneTrayectoria = candidato.experience.length > 0 || candidato.education.length > 0;

  return contacto.length > 0 || tieneTrayectoria;
}

/**
 * Senales minimas de contrato de trabajo en un texto callejero (fotos con el
 * "CONTRATO" inicial degradado, ausente o cortado). Se usa como guardia para
 * no dejar que el lector maltrate un contrato como si fuera hoja de vida.
 */
function senalesDeContrato(texto: string): boolean {
  const t = texto.toLowerCase();
  const palabras = [
    'empleador', 'trabajad', 'forma de pago', 'lugar de ejecucion',
    'periodo de prueba', 'nit', 'domicilio', 'termino fijo', 'clausul',
  ];
  let cuantas = 0;
  for (const p of palabras) if (t.includes(p)) cuantas++;
  const esHojaDeVida =
    t.includes('hoja de vida') || t.includes('curriculum') ||
    t.includes('experiencia laboral') || t.includes('perfil profesional');
  return !esHojaDeVida && cuantas >= 2 && t.includes('empleador');
}

/**
 * Senales de memorando / llamado de atencion en un texto callejero. En un
 * escaneo degradado el clasificador puede no llegar a `memorando` (perdio
 * "MEMORANDO" o la tripleta "PARA:+DE:+ASUNTO:"), y el bloque de promocion
 * entonces propondria una hoja de vida con cabecera de memorando en el titular.
 * Aqui se captura la cabecera de manera mas laxa, tolerante al ruido del OCR:
 * basta con la etiqueta ASUNTO:/PARA:/DE: o con el cuerpo disciplinario.
 */
function senalesDeMemorando(texto: string): boolean {
  const t = texto.toLowerCase();

  // Etiquetas de cabecera de memorando/carta con su dos puntos.
  const etiquetas =
    (/\b(?:asunto|para|de|memorando|memorandum|llamado\s+de\s+atencion|fecha|referencia)\s*[:.]/i.test(t) ? 4 : 0) +
    (/\basunto\s*[:./]/i.test(t) ? 2 : 0) +
    (/\bpara\s*[:./]/i.test(t) ? 2 : 0) +
    (/\bde\s*[:./]/i.test(t) ? 2 : 0);

  // Cuerpo disciplinario, inequívoco de un memorando de sancion.
  const cuerpo =
    /(inasistencia\s+(?:reiterada|sin\s+justa)|sin\s+justa\s+causa|descargos|amonestaci)/i.test(t);

  const esHojaDeVida =
    t.includes('hoja de vida') || t.includes('curriculum') ||
    t.includes('experiencia laboral') || t.includes('perfil profesional') ||
    t.includes('datos personales');

  return !esHojaDeVida && (cuerpo || etiquetas >= 6);
}

/**
 * Orquestador de lectura y extraccion de documentos. Todo corre en el navegador
 * (costo $0) y de forma determinista: sin modelos de lenguaje.
 */
export async function processDocument(
  file: File,
  onProgress?: (progress: number, message: string) => void
): Promise<ExtractedDocumentData> {
  const startTime = performance.now();
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  let extractedText = '';
  let layout: DocumentLayout | undefined;
  let method: ExtractedDocumentData['method'] = 'pdf_text';
  let rawConfidence = 0.95;
  // Paginas renderizadas (escaneo) o el archivo de imagen, para el veto visual.
  let pageImages: Blob[] | Blob | undefined;

  onProgress?.(5, `Iniciando analisis de ${file.name}...`);

  if (extension === 'docx') {
    method = 'docx';
    onProgress?.(30, 'Extrayendo texto del documento Word...');
    const result = await readDocxFile(file);
    extractedText = result.text;
    layout = layoutFromPlainText(result.text);
    rawConfidence = 0.98;
  } else if (extension === 'pdf') {
    onProgress?.(20, 'Analizando capas del PDF...');
    const pdfResult = await readPdfFile(file, onProgress);

    if (pdfResult.isDigitalText) {
      method = 'pdf_text';
      extractedText = pdfResult.text;
      layout = pdfResult.layout;
      rawConfidence = 0.96;
    } else if (pdfResult.renderedPages && pdfResult.renderedPages.length > 0) {
      method = 'pdf_ocr';
      pageImages = pdfResult.renderedPages;
      onProgress?.(50, 'Ejecutando OCR sobre paginas escaneadas...');
      const ocrRes = await performOcr(pdfResult.renderedPages, onProgress);
      extractedText = ocrRes.text;
      layout = ocrRes.layout;
      rawConfidence = ocrRes.confidence;
    }
  } else if (EXTENSIONES_IMAGEN.includes(extension)) {
    method = 'image_ocr';
    pageImages = file as Blob;
    onProgress?.(25, 'Preprocesando imagen y ejecutando OCR...');
    const ocrRes = await performOcr(file, onProgress);
    extractedText = ocrRes.text;
    layout = ocrRes.layout;
    rawConfidence = ocrRes.confidence;
  } else {
    throw new Error(
      `Formato no soportado: .${extension}. Use PDF, DOCX, JPG, PNG, WEBP, BMP, GIF o TIFF.`
    );
  }

  onProgress?.(90, 'Clasificando y estructurando campos del formulario...');

  const categoria = clasificarHistorial(extractedText);
  let detectedType = classifyDocumentType(extractedText);

  let candidateData = detectedType === 'cv' ? parseCvText(extractedText, layout) : undefined;
  let contractData: ContractFormData | undefined =
    detectedType === 'contract' ? parseContractText(extractedText, layout) : undefined;

  // Una hoja de vida sin ningun encabezado de seccion no da ninguna palabra
  // clave, asi que el clasificador la deja en `desconocido`. En vez de mandarla
  // al aviso de documento no estructurado, se intenta leerla y se asciende a
  // hoja de vida SOLO si el resultado trae datos de una persona real. Asi no se
  // fuerza nunca un formulario vacio, que es lo que el clasificador evita, pero
  // tampoco se pierde una hoja de vida por no llevar titulos.
  let memoDetected = false;
  if (categoria === 'desconocido' && !candidateData && !contractData) {
    // Se prueban las dos lecturas. La maquetacion ayuda en los documentos con
    // columnas o encabezados, pero en una hoja sin ningun titulo el texto
    // plano encuentra el bloque de contacto que la maquetacion no agrupa.
    const conMaquetacion = parseCvText(extractedText, layout);
    const posible = pareceHojaDeVida(conMaquetacion)
      ? conMaquetacion
      : parseCvText(extractedText);

    if (senalesDeContrato(extractedText)) {
      // Una foto de contrato con el titulo "CONTRATO" degradado cae aqui y no
      // debe leerse como hoja de vida (produjo "COMBARRANQUILLA" como nombre y
      // cargo). Si el texto huele a contrato, se prefiere ese formulario.
      const contrato = parseContractText(extractedText, layout);
      if (contrato.employerName || contrato.workerName) {
        detectedType = 'contract';
        contractData = contrato;
      }
    } else if (senalesDeMemorando(extractedText)) {
      // Un memorando degradado (perdio "MEMORANDO" o la tripleta PARA+DE+ASUNTO)
      // no debe promoverse a hoja de vida: dejaria la cabecera en el titular
      // ("ASUNTO:DE: DIS INASISTENCIA SIN JUSTA CAUSA"). Se estructura como
      // memorando en su tabla (RN-2) y queda sin formulario de candidato.
      const memorando = parseMemorandoText(extractedText);
      if (memorando.workerName || memorando.subject) {
        memoDetected = true;
        detectedType = 'unknown';
      }
    } else if (pareceHojaDeVida(posible)) {
      detectedType = 'cv';
      candidateData = posible;
    }
  }

  // Veto visual (opt-in, bandera `cv_visual_consent`). Cuando el VLM esta
  // activo y disponible, una pagina con pinta de firma/membrete/carta ("Gerencia",
  // "Atentamente", "Departamento de...") indica que el documento NO es una hoja
  // de vida, aunque el OCR mezclara esa cabecera con el bloque de contacto. En
  // ese caso se retira el formulario de candidato: el problema real no se
  // resuelve capturando mejor el campo, se resuelve no proponiendo el formulario
  // equivocado. Si el modelo no esta disponible (`visualConsent` devuelve null)
  // no se hace NADA y el resultado es identico al de hoy.
  if (detectedType === 'cv' && pageImages !== undefined) {
    const visual = await visualConsent(
      Array.isArray(pageImages) ? pageImages : [pageImages],
      undefined
    );
    if (visual && visual.hasSignatureLikePage) {
      detectedType = 'unknown';
      candidateData = undefined;
    }
  }

  const idCardData = detectedType === 'id_card' ? parseIdCardText(extractedText) : undefined;
  const healthData = detectedType === 'health' ? parseHealthText(extractedText) : undefined;
  const liquidacionData =
    detectedType === 'liquidacion' ? parseLiquidacionText(extractedText) : undefined;
  // Memorando / llamado de atencion y funciones de cargo no tienen formulario
  // propio (detectedType 'unknown') pero se estructuran para registrarlos en sus
  // tablas y en la ficha del empleado.
  const memorandoData =
    categoria === 'memorando' || categoria === 'llamado_atencion' || memoDetected
      ? parseMemorandoText(extractedText)
      : undefined;
  const funcionesData =
    categoria === 'funciones' ? parseFuncionesText(extractedText) : undefined;

  const { confidence, warnings, fieldConfidence } = evaluarCalidad(
    detectedType,
    candidateData,
    extractedText,
    rawConfidence
  );

  onProgress?.(100, 'Extraccion completada con exito.');

  return {
    detectedType,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type || extension,
    extractedText,
    confidenceScore: confidence,
    processingTimeMs: Math.round(performance.now() - startTime),
    method,
    candidateData,
    contractData,
    idCardData,
    healthData,
    liquidacionData,
    memorandoData,
    funcionesData,
    warnings: warnings.length > 0 ? warnings : undefined,
    fieldConfidence,
    detectedRoles: candidateData ? detectarCargos(candidateData.experience) : undefined,
  };
}

/** Campos clave de una hoja de vida y su peso en el puntaje de confianza. */
const CAMPOS_CLAVE: { field: keyof CandidateFormData; label: string; peso: number }[] = [
  { field: 'firstNames', label: 'Nombres', peso: 0.14 },
  { field: 'lastNames', label: 'Apellidos', peso: 0.14 },
  { field: 'documentNumber', label: 'Numero de documento', peso: 0.1 },
  { field: 'email', label: 'Correo electronico', peso: 0.08 },
  { field: 'phone', label: 'Telefono', peso: 0.08 },
  { field: 'cityResidence', label: 'Ciudad de residencia', peso: 0.06 },
  { field: 'headline', label: 'Cargo o titular', peso: 0.05 },
  { field: 'experience', label: 'Experiencia laboral', peso: 0.1 },
  { field: 'education', label: 'Formacion academica', peso: 0.1 },
  { field: 'skills', label: 'Habilidades', peso: 0.05 },
];

/**
 * Calcula la confianza compuesta y marca que campos quedaron vacios o dudosos,
 * que es lo que la persona de RRHH debe revisar antes de guardar (RN-7).
 */
function evaluarCalidad(
  detectedType: ExtractedDocumentData['detectedType'],
  candidato: CandidateFormData | undefined,
  texto: string,
  confianzaOcr: number
): { confidence: number; warnings: string[]; fieldConfidence: FieldConfidence[] } {
  const warnings: string[] = [];
  const fieldConfidence: FieldConfidence[] = [];

  if (texto.trim().length < 40) {
    warnings.push('Se reconocio muy poco texto. Verifique la calidad del escaneo o la foto.');
  }

  if (detectedType !== 'cv' || !candidato) {
    return {
      confidence: texto.trim().length < 40 ? Math.min(confianzaOcr, 0.4) : confianzaOcr,
      warnings,
      fieldConfidence,
    };
  }

  // 30% del puntaje viene de la claridad del OCR y 70% de cuantos campos se llenaron.
  let puntaje = confianzaOcr * 0.3;

  for (const campo of CAMPOS_CLAVE) {
    const valor = candidato[campo.field];
    const lleno = Array.isArray(valor) ? valor.length > 0 : Boolean(valor && String(valor).trim());

    if (lleno) {
      puntaje += campo.peso * 0.7;
      fieldConfidence.push({
        field: campo.field,
        label: campo.label,
        level: confianzaOcr >= 0.85 ? 'alta' : 'media',
      });
    } else {
      fieldConfidence.push({ field: campo.field, label: campo.label, level: 'vacio' });
    }
  }

  if (!candidato.firstNames && !candidato.lastNames) {
    warnings.push('No se detecto el nombre del candidato. Escribalo manualmente.');
  }
  if (!candidato.email && !candidato.phone) {
    warnings.push('No se detecto informacion de contacto (ni correo ni telefono).');
  }
  if (candidato.experience.length === 0) {
    warnings.push('No se detecto experiencia laboral. Revise el documento original.');
  }
  if (confianzaOcr < 0.7) {
    warnings.push(
      'La calidad del reconocimiento es baja. Revise campo por campo antes de guardar.'
    );
  }

  const confianza = Math.min(1, Math.max(0.2, puntaje));

  return {
    confidence: texto.trim().length < 40 ? Math.min(confianza, 0.4) : confianza,
    warnings,
    fieldConfidence,
  };
}

export * from './skills-taxonomy';
export * from './layout';
export * from './pdf-reader';
export * from './docx-reader';
export * from './tesseract-worker';
export * from './document-classifier';
export * from './sections';
export * from './cargos';
export * from './parser-cv';
export * from './parser-contract';
export * from './parser-id';
export * from './parser-health';
export * from './parser-liquidacion';
export * from './parser-memorando';
export * from './parser-funciones';
export * from './extraer-zip';
export * from './ocr-normalize';
