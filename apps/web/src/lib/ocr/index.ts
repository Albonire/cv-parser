import { ExtractedDocumentData, FieldConfidence } from '../../types/reader';
import { CandidateFormData } from '../../types/candidate';
import { ContractFormData } from '../../types/contract';
import { HealthFormData } from '../../types/health';
import { LiquidacionFormData } from '../../types/liquidacion';
import { readDocxFile } from './docx-reader';
import { readTxtFile } from './txt-reader';
import { readPdfFile } from './pdf-reader';
import { performOcr, OcrOptions } from './tesseract-worker';
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
    'datos personales y de contrato', 'salario',
  ];
  let cuantas = 0;
  for (const p of palabras) if (t.includes(p)) cuantas++;
  const esHojaDeVida =
    t.includes('hoja de vida') || t.includes('curriculum') ||
    t.includes('experiencia laboral') || t.includes('perfil profesional');
  return !esHojaDeVida && cuantas >= 2 && (t.includes('empleador') || t.includes('contrato'));
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
 * Senales de liquidacion final de contrato en el texto. Se exige vocabulario
 * propio de una liquidacion (no basta un monto suelto) para no inventar un
 * formulario ante cualquier numero del documento.
 */
function tieneDatosLiquidacion(texto: string): boolean {
  // Se exige uno de los conceptos reales de una liquidacion final. Un simple
  // "comprobante de egreso" no basta (DOC1 es una nota de pago de servicios y no
  // una liquidacion): sin estos conceptos no se ofrece el formulario.
  return /(?:cesant[ií]as?\s+(?:consolidadas?|finales?|definitivas?)?|prima\s+de\s+servicios?|vacaciones\s+(?:consolidadas?|proporcionales?)?|intereses?\s+sobre\s+cesant[ií]as|auxilio\s+de\s+transporte|indemnizaci[oó]n\s+por\s+despido|liquidaci[oó]n\s+y\s+pago\s+total|total\s+(?:a\s+pagar|a\s+liquidar)|concepto\s+de\s+retiro)/i.test(
    texto
  );
}

/**
 * True si el parser de liquidacion pudo extraer al menos un valor real.
 * Descarta los "conceptos" espurios que el parser captura de cedulas, NIT y
 * fechas del encabezado cuando el texto no es una liquidacion.
 */
function tieneConceptosLiquidacion(liq: LiquidacionFormData): boolean {
  const nombres = (liq.otrosConceptos ?? []).map((c) => c.concepto.toLowerCase());
  const reales = nombres.filter(
    (c) =>
      !/(?:cedula|nit|telefono|cel\b|correo|de\s+[a-z]+\s+de|contacto|fecha|nacimiento|documento|representante|cargo|salario\s+base)/.test(
        c
      )
  );
  return Boolean(
    liq.totalLiquidacion ||
      liq.cesantias ||
      liq.interesesCesantias ||
      liq.prima ||
      liq.vacaciones ||
      liq.indemnizacion ||
      liq.salarioBase ||
      (liq.fechaRetiro && liq.diasTrabajados) ||
      reales.length > 0
  );
}

/**
 * Senales de contrato en un documento que ademas es hoja de vida (expediente
 * consolidado Rosimar). La mera presencia de "contrato" no basta: un CV puede
 * hablar de sus contratos. Se exige el bloque de terminos (empleador + salario
 * + forma/tipo de contrato) tipico de la plantilla "Datos Personales y de
 * Contrato".
 */
function tieneDatosContrato(texto: string): boolean {
  const lower = texto.toLowerCase();
  const bloqueEmpleador = /empresa\s+empleadora|empleador|raz[oó]n\s+social/i.test(lower);
  const terminos =
    /(?:forma\s+de\s+pago|tipo\s+de\s+contrato|fecha\s+de\s+inicio|fecha\s+de\s+iniciaci[oó]n|lugar\s+de\s+trabajo|salario|sueldo)\s*[:.-]/i.test(lower);
  return bloqueEmpleador && terminos;
}

/**
 * True si un candidato parseado representa a una persona real con datos de
 * identidad o contacto (no un nombre suelto). Evita forzar un formulario de
 * candidato vacio cuando el documento no trae datos personales.
 */
function tienePersonaReal(c: CandidateFormData): boolean {
  const nombre = `${c.firstNames ?? ''} ${c.lastNames ?? ''}`.trim();
  if (nombre.split(/\s+/).filter(Boolean).length < 2) return false;
  return Boolean(c.documentNumber || c.email || c.phone || c.address || c.headline);
}

/** Niveles de confianza para decidir la estrategia de extraccion. */
type NivelConfianza = 'alta' | 'media' | 'baja' | 'critica';
/**
 * Evalua la calidad del OCR y asigna un nivel de confianza que determina
 * que estrategia de extraccion aplicar.
 */
function evaluarNivelConfianza(confianza: number, texto: string): NivelConfianza {
  if (confianza >= 0.85 && texto.length > 200) return 'alta';
  if (confianza >= 0.65 && texto.length > 100) return 'media';
  if (confianza >= 0.45 || texto.length > 50) return 'baja';
  return 'critica';
}

/**
 * Intenta extraer al menos datos basicos de un texto degradado cuando
 * el OCR principal falla completamente. Busca nombre, cedula, telefono
 * y correo con patrones relajados.
 */
function extraccionParcial(texto: string): CandidateFormData {
  const resultado: CandidateFormData = {
    firstNames: '',
    lastNames: '',
    documentType: 'CC',
    documentNumber: '',
    email: '',
    phone: '',
    nationality: '',
    status: 'nuevo',
    education: [],
    experience: [],
    skills: [],
    references: [],
  };

  // Buscar nombre (dos palabras consecutivas con mayuscula inicial).
  const nombreMatch = texto.match(/\b([A-ZÁÉÍÓÚ][a-záéíóú]{2,})\s+([A-ZÁÉÍÓÚ][a-záéíóú]{2,})\b/);
  if (nombreMatch) {
    resultado.firstNames = nombreMatch[1];
    resultado.lastNames = nombreMatch[2];
  }

  // Buscar cedula (7-10 digitos).
  const cedulaMatch = texto.match(/\b\d{7,10}\b/);
  if (cedulaMatch) {
    resultado.documentNumber = cedulaMatch[0];
  }

  // Buscar telefono (10 digitos empiezan por 3).
  const telefonoMatch = texto.match(/\b3\d{9}\b/);
  if (telefonoMatch) {
    resultado.phone = telefonoMatch[0];
  }

  // Buscar correo electronico.
  const correoMatch = texto.match(/[\w.+-]+@[\w.-]+\.\w{2,}/);
  if (correoMatch) {
    resultado.email = correoMatch[0];
  }

  // Buscar ciudad despues de "Ciudad:" o "Ciudad de residencia:".
  const ciudadMatch = texto.match(/(?:ciudad|lugar)\s*(?::|de residencia)\s*(.+)/i);
  if (ciudadMatch) {
    resultado.cityResidence = ciudadMatch[1].trim().substring(0, 50);
  }

  return resultado;
}

/**
 * Que paso de extraccion indica si el texto vino del OCR (vision) o de un
 * documento de texto nativo (.docx, .txt, PDF digital). Los chequeos de
 * legibilidad miden ruido de reconocimiento optico: no tienen sentido sobre
 * texto digital, donde el "19% de palabras reconocibles" es una falsa alarma.
 */
export type OrigenTexto = 'ocr' | 'nativo';

/**
 * Detecta texto ilegible o corrupto que indica que el OCR fallo
 * catastroficamente y no debe confiarse en los campos extraidos.
 *
 * En origen nativo (.docx, .txt, PDF con texto digital) el texto es
 * autoritativo: no existe ruido optico que medir, asi que este detector no se
 * aplica (devuelve legible). Solo el OCR necesita esta guarda.
 */
export function detectarTextoIninteligible(
  texto: string,
  origen: OrigenTexto = 'ocr'
): {
  esIninteligible: boolean;
  razon: string;
  factorConfianza: number;
} {
  const lineas = texto.split('\n').filter((l) => l.trim().length > 0);
  if (lineas.length === 0) {
    return { esIninteligible: true, razon: 'Texto vacio', factorConfianza: 0.1 };
  }

  // Un documento de texto nativo no puede sufrir ruido de reconocimiento.
  if (origen === 'nativo') {
    return { esIninteligible: false, razon: '', factorConfianza: 1 };
  }

  // Detectar caracteres repetidos (aaaa, 1111) -- senal tipica de ruido.
  const repetidos = lineas.filter((l) => /(.)\1{3,}/.test(l)).length;
  if (repetidos > lineas.length * 0.3) {
    return {
      esIninteligible: true,
      razon: 'Demasiados caracteres repetidos (ruido)',
      factorConfianza: 0.2,
    };
  }

  // Detectar palabras largas sin vocales (gibberish de OCR corrupto).
  // Solo cuentan tokens alfabeticos: numeros, fechas, telefonos y cifras con
  // separadores (72.222.293, 01/10/2023) no son gibberish aunque no tengan vocales.
  const palabras = texto.split(/\s+/);
  const alfabeticas = palabras.filter((p) => /[a-záéíóú]/i.test(p));
  const sinVocales = alfabeticas.filter((p) => p.length > 6 && !/[aeiouáéíóú]/i.test(p)).length;
  if (sinVocales > 3 && alfabeticas.length > 9) {
    return {
      esIninteligible: true,
      razon: 'Palabras largas sin vocales (gibberish)',
      factorConfianza: 0.25,
    };
  }

  // Detectar ratio bajo de palabras reconocibles (con al menos 2 vocales).
  const reconocibles = alfabeticas.filter((p) => /[aeiouáéíóú]{2,}/i.test(p)).length;
  const ratio = reconocibles / Math.max(1, alfabeticas.length);
  if (ratio < 0.25 && alfabeticas.length > 10) {
    return {
      esIninteligible: true,
      razon: `Solo ${Math.round(ratio * 100)}% de palabras reconocibles`,
      factorConfianza: 0.3,
    };
  }

  return { esIninteligible: false, razon: '', factorConfianza: 1 };
}

/**
 * Orquestador de lectura y extraccion de documentos. Todo corre en el navegador
 * (costo $0) y de forma determinista: sin modelos de lenguaje.
 */
export async function processDocument(
  file: File,
  onProgress?: (progress: number, message: string) => void,
  ocrOpciones?: OcrOptions
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

  if (extension === 'txt' || extension === 'text') {
    method = 'txt';
    onProgress?.(25, 'Leyendo documento de texto plano...');
    const result = await readTxtFile(file);
    extractedText = result.text;
    layout = result.layout;
    rawConfidence = 0.99;
  } else if (extension === 'docx') {
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
      const ocrRes = await performOcr(pdfResult.renderedPages, onProgress, ocrOpciones);
      extractedText = ocrRes.text;
      layout = ocrRes.layout;
      rawConfidence = ocrRes.confidence;
    }
  } else if (EXTENSIONES_IMAGEN.includes(extension)) {
    method = 'image_ocr';
    pageImages = file as Blob;
    onProgress?.(25, 'Preprocesando imagen y ejecutando OCR...');
    const ocrRes = await performOcr(file, onProgress, ocrOpciones);
    extractedText = ocrRes.text;
    layout = ocrRes.layout;
    rawConfidence = ocrRes.confidence;
  } else {
    throw new Error(
      `Formato no soportado: .${extension}. Use PDF, DOCX, TXT, JPG, PNG, WEBP, BMP, GIF o TIFF.`
    );
  }

  onProgress?.(90, 'Clasificando y estructurando campos del formulario...');

  const categoria = clasificarHistorial(extractedText);
  let detectedType = classifyDocumentType(extractedText);

  let candidateData = detectedType === 'cv' ? parseCvText(extractedText, layout) : undefined;
  let contractData: ContractFormData | undefined =
    detectedType === 'contract' ? parseContractText(extractedText, layout) : undefined;

  // Si no se detecto un formulario estructurado (cv o contract), o cayo en una
  // categoria secundaria (desconocido, llamado_atencion, memorando, funciones), se
  // intenta rescatar: si hay claras senales de contrato o de hoja de vida,
  // se promueve al formulario correspondiente en vez de dejarlo como unknown vacio.
  let memoDetected = false;
  if (!candidateData && !contractData) {
    if (senalesDeContrato(extractedText)) {
      // Una foto de contrato con el titulo "CONTRATO" degradado o un documento
      // con senales contractuales que cayo en categoria secundaria se rescata aqui.
      const contrato = parseContractText(extractedText, layout);
      if (contrato.employerName || contrato.workerName) {
        detectedType = 'contract';
        contractData = contrato;
      }
    } else if (senalesDeMemorando(extractedText)) {
      memoDetected = true;
      detectedType = 'unknown';
    } else if (categoria === 'desconocido') {
      // NUEVO: Si el OCR es catastroficamente malo, intentar extraccion parcial
      // en vez de descartar el documento por completo.
      const nivelConfianza = evaluarNivelConfianza(rawConfidence, extractedText);
      if (nivelConfianza === 'critica') {
        const parcial = extraccionParcial(extractedText);
        if (parcial.firstNames || parcial.documentNumber || parcial.phone) {
          detectedType = 'cv';
          candidateData = parcial;
        }
      } else {
        // Se prueban las dos lecturas. La maquetacion ayuda en los documentos con
        // columnas o encabezados, pero en una hoja sin ningun titulo el texto
        // plano encuentra el bloque de contacto que la maquetacion no agrupa.
        const conMaquetacion = parseCvText(extractedText, layout);
        const posible = pareceHojaDeVida(conMaquetacion)
          ? conMaquetacion
          : parseCvText(extractedText);

        if (pareceHojaDeVida(posible)) {
          detectedType = 'cv';
          candidateData = posible;
        }
      }
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

  // ---- Formularios adicionales de un mismo documento (expediente consolidado) ----
  // Un documento Rosimar suele mezclar en un solo archivo datos de candidato,
  // contrato, seguridad social y liquidacion ("Datos Personales y de Contrato").
  // Antes el lector elegia UNO solo segun `detectedType` y descartaba el resto;
  // ahora cada formulario se llena si el texto trae su senal propia, para que
  // ninguna informacion del documento se pierda. Cada uno se ofrece solo cuando
  // hay datos reales (nunca se fuerza un formulario vacio).
  let healthData: HealthFormData | undefined =
    detectedType === 'health' ? parseHealthText(extractedText) : undefined;

  if (detectedType !== 'health') {
    const salud = parseHealthText(extractedText);
    if (salud.epsName || salud.arlName || salud.pensionFund || salud.compensationBox) {
      healthData = salud;
    }
  }

  let liquidacionData: LiquidacionFormData | undefined =
    detectedType === 'liquidacion' ? parseLiquidacionText(extractedText) : undefined;

  if (detectedType !== 'liquidacion' && tieneDatosLiquidacion(extractedText)) {
    const liq = parseLiquidacionText(extractedText);
    if (tieneConceptosLiquidacion(liq)) liquidacionData = liq;
  }

  // Contrato adicional: cuando el documento mezcla datos de candidato con los
  // terminos del contrato (empleador, salario, forma de pago, tipo de contrato),
  // se llena tambien el Formulario 5.2 aunque el principal sea hoja de vida.
  if (detectedType !== 'contract' && contractData === undefined && tieneDatosContrato(extractedText)) {
    const contrato = parseContractText(extractedText, layout);
    if (contrato.employerName || contrato.workerName || contrato.position || contrato.salary) {
      contractData = contrato;
    }
  }

  // Formulario de candidato adicional: un expediente consolidado que no se
  // clasifico como hoja de vida (p. ej. "Datos Personales y de Contrato") igual
  // trae los datos personales del empleado. Se llena solo si hay un nombre real
  // y al menos un dato de identidad/contacto, para no forzar un candidato vacio.
  if (candidateData === undefined && tienePersonaReal(parseCvText(extractedText, layout))) {
    candidateData = parseCvText(extractedText, layout);
  }

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
    rawConfidence,
    layout,
    method === 'docx' || method === 'txt' || method === 'pdf_text' ? 'nativo' : 'ocr'
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
  confianzaOcr: number,
  layout?: DocumentLayout,
  origen: OrigenTexto = 'ocr'
): { confidence: number; warnings: string[]; fieldConfidence: FieldConfidence[] } {
  const warnings: string[] = [];
  const fieldConfidence: FieldConfidence[] = [];

  if (texto.trim().length < 40) {
    warnings.push('Se reconocio muy poco texto. Verifique la calidad del escaneo o la foto.');
  }

  // NUEVO: Detectar texto ininteligible y ajustar confianza. Solo aplica a
  // texto proveniente del OCR; un .docx, .txt o PDF digital con texto limpio no
  // debe disparar la falsa alarma de "documento ilegible".
  const legibilidad = detectarTextoIninteligible(texto, origen);
  if (legibilidad.esIninteligible) {
    warnings.push(`Documento posiblemente ilegible: ${legibilidad.razon}. Revise el escaneo original.`);
    confianzaOcr = Math.min(confianzaOcr, legibilidad.factorConfianza);
  }

  // NUEVO: Contar palabras con baja confianza para advertir al usuario.
  if (layout) {
    const todasPalabras = layout.lines.flatMap((l) => l.words);
    const total = todasPalabras.length;
    const inciertas = todasPalabras.filter((w) => w.uncertain).length;
    if (total > 0 && inciertas / total > 0.3) {
      warnings.push(
        `El ${Math.round((inciertas / total) * 100)}% del texto tiene baja confianza. Verifique campo por campo.`
      );
    }
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
export * from './txt-reader';
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
