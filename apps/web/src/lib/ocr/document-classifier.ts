import { DetectedDocumentType } from '../../types/reader';
import { DocumentCategory } from '../../types/employee-document';

/**
 * Clasifica el contenido de un documento en dos niveles:
 *
 * - `clasificarHistorial(texto)`: a que ficha del expediente del empleado
 *   pertenece (contrato, memorando, llamado de atencion, salud, renuncia...).
 * - `classifyDocumentType(texto)`: que formulario estructurado mostrar en el
 *   lector (cv, contract, id_card, health) o `unknown` cuando el documento no
 *   es de ninguno de esos formularios (memorandos, llamados, funciones, etc.),
 *   para no forzar nunca una hoja de vida vacia ante un documento que no lo es.
 *
 * Las claves estan calibradas con textos OCR reales de fotos de WhatsApp de
 * empleados antiguos de Rosimar, donde las palabras suelen llegar pegadas o
 * parcialmente degradadas (p. ej. "TÉRMINOACONTRATO", "NIT€D", "MPILEADOR").
 */

/**
 * Cuenta claves por subcadena a proposito: en las fotos de WhatsApp el OCR pega
 * las palabras ("TERMINOACONTRATO", "MPILEADOR") y exigir frontera de palabra
 * aqui hacia que un contrato degradado dejara de reconocerse.
 */
function contar(texto: string, claves: string[], pesos?: number[]): number {
  let total = 0;
  for (let i = 0; i < claves.length; i++) {
    if (texto.includes(claves[i])) {
      total += pesos ? pesos[i] : 1;
    }
  }
  return total;
}

/**
 * La prima de servicios, como palabra suelta y no como trozo de otra.
 *
 * "Primaria" es el nivel educativo que aparece en casi cualquier hoja de vida
 * colombiana y contiene "prima", que puntuaba 3 hacia liquidacion. Es la unica
 * clave del clasificador con esa ambiguedad, asi que se trata aparte en vez de
 * exigir frontera de palabra en todas: el resto tiene que seguir tolerando las
 * palabras pegadas del OCR de fotos.
 */
const PRIMA_DE_SERVICIOS = /\bprima(?!ria|rio)/;

/**
 * Senales inequivocas de curriculum. Se calcula ANTES que el resto porque una
 * hoja de vida menciona de forma natural contratos, primas y funciones, y sin
 * esta prioridad terminaba clasificada como contrato o como documento suelto.
 */
function puntajeHojaDeVida(lower: string): number {
  return (
    (lower.includes('hoja de vida') ? 4 : 0) +
    (lower.includes('curriculum') ? 4 : 0) +
    (lower.includes('experiencia laboral') ? 3 : 0) +
    (lower.includes('perfil profesional') ? 3 : 0) +
    (lower.includes('formacion academica') ? 3 : 0) +
    (lower.includes('nombres y apellidos') ? 2 : 0) +
    (lower.includes('datos personales') ? 2 : 0) +
    (lower.includes('habilidades') ? 2 : 0) +
    (lower.includes('referencias') ? 1 : 0) +
    (lower.includes('informacion personal') ? 1 : 0)
  );
}

/**
 * Con dos senales fuertes ya no hay duda de que es una hoja de vida.
 *
 * Conventionalmente bastan "EXPERIENCIA LABORAL" (3) + "DATOS PERSONALES" (2)
 * (o + "FORMACION ACADEMICA" 3) para reconocer un perfil de candidato. Un
 * documento como "Datos Personales y de Contrato", que es la plantilla de
 * candidato de Rosimar (nombre, cedula, cargo/perfil, educacion y experiencia),
 * mezcla terminos de contrato y de EPS y sin esta prioridad terminaba en un
 * formulario equivocado en vez de en su hoja de vida.
 */
const CV_INEQUIVOCO = 5;

/**
 * Detecta si el documento es una hoja de vida por concentracion de datos personales esenciales
 * (cedula, celular, direccion, fecha de nacimiento/estado civil, educacion), util para fotos
 * recortadas que pierden el titulo formal ("Hoja De Vida").
 */
function tieneDensidadDatosPersonales(lower: string, texto: string): boolean {
  let senales = 0;
  // 1. Cédula / Documento de identidad
  if (
    /(?:\bcc\b|c\.c\.|cedula|identificacion|documento)\s*[:.-]?\s*\d{6,10}/i.test(texto) ||
    /\b\d{1,3}(?:\.\d{3}){2}\b/.test(texto) ||
    /\b\d{7,10}\b/.test(lower)
  ) {
    senales++;
  }
  // 2. Teléfono móvil 3xx
  if (
    /(?:tel|cel|movil|whatsapp|contacto)\s*[:.-]?\s*\d+/i.test(texto) ||
    /\b3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}\b/.test(texto) ||
    /\b3\d{9}\b/.test(texto)
  ) {
    senales++;
  }
  // 3. Dirección urbana
  if (
    /#\s*\d+/.test(texto) ||
    /\b(?:calle|carrera|cl|cra|kr|diag|transversal|avenida|av|barrio|mz|urbanizacion)\b/i.test(lower)
  ) {
    senales++;
  }
  // 4. Fecha o lugar de nacimiento, estado civil
  if (
    /\b(?:nacimiento|fecha\s+de\s+nacimiento|lugar\s+de\s+nacimiento|nacido|edad)\b/i.test(lower) ||
    /\b(?:estado\s+civil|soltero|casado|union\s+libre)\b/i.test(lower) ||
    /\b\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+de\s+(?:19|20)\d{2}\b/i.test(lower)
  ) {
    senales++;
  }
  // 5. Nivel educativo o referencias
  if (
    /\b(?:bachiller|primaria|secundaria|tecnico|tecnologo|profesional|universitari[oa]|estudios|referencias)\b/i.test(lower)
  ) {
    senales++;
  }

  return senales >= 3;
}

/** Minusculas y sin diacriticos: hace robusta la busqueda ante mayusculas y
 *  acentos del OCR (p. ej. "ATENCIÓN" == "atencion"). */
function normalizar(texto: string): string {
  const sinAcentos = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return sinAcentos;
}

/**
 * Categoria de historial laboral. Se evalua primero lo mas especifico y se
 * termina en `hoja_de_vida` cuando hay senales claras de curriculum o en
 * `desconocido` para cualquier otro documento.
 */
export function clasificarHistorial(texto: string): DocumentCategory {
  const lower = normalizar(texto);
  const cv = puntajeHojaDeVida(lower);

  // Dos o mas encabezados propios de curriculum: es una hoja de vida y no hay
  // que seguir mirando. Una hoja de vida real dice "contrato a termino fijo" en
  // su experiencia y "funciones propias del cargo" en cada empleo.
  if (cv >= CV_INEQUIVOCO) return 'hoja_de_vida';

  // Consultas de Seguridad Social / EPS / ARL / pensiones (formulario tipo EPS/ARL).
  // Se exige ademas una senal inequivoca de certificado/afiliacion (cotizante,
  // afiliad-, certificado, regimen, IPS...). Sin ella, un perfil de candidato o
  // una hoja de vida que mencione de pasada "Seguridad Social: EPS Sanitas | AFP
  // Porvenir | ARL Positiva" se clasificaba como EPS y saltaba al formulario de
  // salud dejando vacio el formulario de hoja de vida.
  const salud =
    (lower.includes('seguridad social') ? 3 : 0) +
    (lower.includes('informacion basica del afiliado') ? 4 : 0) +
    (lower.includes('certificado de afiliacion') ? 4 : 0) +
    (lower.includes('positiva') ? 4 : 0) +
    (lower.includes('riesgos laborales') ? 4 : 0) +
    (lower.includes('nueva eps') ? 4 : 0) +
    (lower.includes('afiliaci') ? 2 : 0) +
    (lower.includes('eps') ? 2 : 0) +
    (lower.includes('arl') ? 2 : 0) +
    (lower.includes('cotizante') ? 2 : 0) +
    (lower.includes('cobertura') ? 2 : 0) +
    (lower.includes('pensiones') ? 1 : 0) +
    (lower.includes('compensacion') ? 1 : 0);
  const certificadoSalud =
    /(?:afiliad|cotizante|certificado de afili|regimen (?:contributivo|subsidiado)|portabilidad|ips\b|numero de afiliacion)/.test(
      lower
    );
  if (
    (salud >= 4 && certificadoSalud) ||
    lower.includes('certificado de afiliacion') ||
    (salud >= 3 && certificadoSalud && (lower.includes('arl') || lower.includes('eps') || lower.includes('riesgos laborales')))
  ) {
    return 'salud';
  }

  const esLicenciaConduccion =
    lower.includes('licencia de conduccion') ||
    lower.includes('licencia de conducir') ||
    lower.includes('ministerio de transporte') ||
    (lower.includes('categoria') && (lower.includes('conduccion') || lower.includes('conducir')));

  // Cedula de ciudadania / tarjeta de identidad (excluyendo licencia de conduccion).
  const cedula =
    (lower.includes('cedula de ciudadania') ? 3 : 0) +
    (lower.includes('republica de colombia') ? 4 : 0) +
    (lower.includes('lugar de expedicion') ? 3 : 0) +
    (lower.includes('tarjeta de identidad') ? 3 : 0);
  if (cedula >= 4 && !esLicenciaConduccion) return 'cedula';

  // Encabezados formales de contrato o vinculacion laboral:
  // "CONTRATO INDIVIDUAL...", "CONTRATO DE TRABAJO", "DATOS PERSONALES Y DE CONTRATO".
  // Tienen maxima precedencia para no dejarse desviar por menciones disciplinarias
  // o de liquidacion que figuren en el historial interno del empleado.
  const tieneEncabezadoContrato =
    lower.includes('datos personales y de contrato') ||
    lower.includes('contrato individual de trabajo') ||
    lower.includes('contrato de trabajo') ||
    lower.includes('contrato laboral') ||
    /(?:^|\n)\s*(?:•\s*)?contrato\s+individual\b/i.test(texto) ||
    /(?:^|\n)\s*(?:•\s*)?contrato\s+de\s+trabajo\b/i.test(texto);

  const contrato = contar(
    lower,
    [
      'contrato',
      'empleador',
      'trabajad',
      'periodo de prueba',
      'termino fijo',
      'termino indefinido',
      'indefinido',
      'clausul',
      'forma de pago',
      'lugar de ejecucion',
      'vencimiento',
      'domicilio',
      'sueldo',
      'nit',
      'salario',
      'datos personales y de contrato',
    ],
    [4, 2, 2, 3, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 4]
  );

  if (tieneEncabezadoContrato) return 'contrato';

  // Llamado de atencion: requiere encabezado formal ("LLAMADO DE ATENCION No. ..." o bloque PARA/ASUNTO con atencion)
  // y no una mera mencion en un historial disciplinario.
  const tieneEncabezadoLlamado =
    /(?:^|\n)\s*(?:•\s*)?(?:llamado\s+de\s+atenci[oó]n|amonestaci[oó]n)(?:\s+no\.?|\s+n°|\s*:\s*|\s+\d+)/i.test(texto) &&
    !lower.includes('historial disciplinario');
  const esLlamadoEstructurado =
    tieneEncabezadoLlamado ||
    (lower.includes('atencion') && lower.includes('para:') && lower.includes('asunto:'));

  if (!tieneEncabezadoContrato && esLlamadoEstructurado) {
    return 'llamado_atencion';
  }

  // Memorando: requiere encabezado formal ("MEMORANDO No. ..." o correspondencia formal PARA / DE / ASUNTO).
  const tieneEncabezadoMemorando =
    /(?:^|\n)\s*(?:•\s*)?memorand[oa](?:\s+no\.?|\s+n°|\s*:\s*|\s+\d+)/i.test(texto) &&
    !lower.includes('historial disciplinario');
  const esMemorandoEstructurado =
    tieneEncabezadoMemorando ||
    (lower.includes('para:') && lower.includes('asunto:') && (lower.includes('de:') || lower.includes('memorand')));

  if (!tieneEncabezadoContrato && esMemorandoEstructurado) {
    return 'memorando';
  }

  // Renuncia / carta de renuncia.
  const esRenunciaEstructurada =
    (lower.includes('carta de renuncia') || /(?:^|\n)\s*renuncia\b/i.test(texto)) &&
    !lower.includes('desvinculacion') &&
    !tieneEncabezadoContrato;
  if (esRenunciaEstructurada) {
    return 'renuncia';
  }

  // Liquidacion final de contrato. Se evalua ANTES que `contrato` generico porque la
  // liquidacion contiene muchas palabras propias del contrato (trabajador,
  // empleador, NIT, fechas). Las claves distintivas son los conceptos laborales
  // y el cuadro de valores. Calibrado para OCR real de fotos (palabras pegadas
  // como "CESANTÍASDOBLES").
  const liquidacion =
    (lower.includes('liquidacion') ? 4 : 0) +
    (lower.includes('liquidacion final') ? 4 : 0) +
    (lower.includes('cesantias') ? 4 : 0) +
    (PRIMA_DE_SERVICIOS.test(lower) ? 3 : 0) +
    (lower.includes('vacaciones') ? 2 : 0) +
    (lower.includes('indemnizacion') ? 3 : 0) +
    (lower.includes('intereses de cesantias') ? 4 : 0) +
    (lower.includes('retencion') ? 2 : 0) +
    (lower.includes('total liquidacion') ? 4 : 0) +
    (lower.includes('total a pagar') ? 3 : 0);
  if (liquidacion >= 4 && !tieneEncabezadoContrato) return 'liquidacion';

  // Contrato laboral. Tolerante a ruido ("TÉRMINOACONTRATO", "trabajad", "NIT").
  if (contrato >= 4) return 'contrato';
  // En las fotos de WhatsApp el "CONTRATO" inicial llega degradado o se corta:
  // con menos puntos, la pareja empleador+trabajador ya es evidencia de
  // contrato, pero solo si la hoja de vida no tiene ninguna senal propia.
  if (contrato >= 2 && cv < 3 && lower.includes('empleador') && lower.includes('trabajad')) {
    return 'contrato';
  }

  // Funciones de cargo: listado de responsabilidades de un puesto.
  //
  // Tiene que ser un encabezado, no la palabra suelta: "Responsable de las
  // funciones propias del cargo" aparece en la experiencia de practicamente
  // cualquier hoja de vida, y con la comprobacion anterior TODAS esas hojas de
  // vida se clasificaban como documento de funciones y llegaban al formulario
  // vacias.
  if (
    lower.includes('manual de funciones') ||
    lower.includes('funciones del cargo') ||
    lower.includes('descripcion de funciones') ||
    lower.includes('perfil del cargo') ||
    lower.includes('punto de venta')
  ) {
    return 'funciones';
  }

  // Hoja de vida con una sola senal o por densidad de datos personales (fotos recortadas).
  if (cv >= 3 || tieneDensidadDatosPersonales(lower, texto)) return 'hoja_de_vida';

  return 'desconocido';
}

const CATEGORIA_A_TIPO: Record<DocumentCategory, DetectedDocumentType> = {
  hoja_de_vida: 'cv',
  contrato: 'contract',
  liquidacion: 'liquidacion',
  salud: 'health',
  cedula: 'id_card',
  memorando: 'unknown',
  llamado_atencion: 'unknown',
  renuncia: 'unknown',
  funciones: 'unknown',
  desconocido: 'unknown',
};

/**
 * Tipo de formulario a mostrar en el lector. El 100% de los documentos que no
 * pertenecen a un formulario estructurado (cv/contract/id_card/health) se
 * devuelven como `unknown` para que la interfaz muestre el aviso de documento
 * no estructurado en lugar de una hoja de vida vacia.
 */
export function classifyDocumentType(text: string): DetectedDocumentType {
  return CATEGORIA_A_TIPO[clasificarHistorial(text)];
}
