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

function contar(texto: string, claves: string[], pesos?: number[]): number {
  let total = 0;
  for (let i = 0; i < claves.length; i++) {
    if (texto.includes(claves[i])) {
      total += pesos ? pesos[i] : 1;
    }
  }
  return total;
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

  // Consultas de Seguridad Social / EPS / ARL / pensiones (formulario tipo EPS).
  const salud =
    (lower.includes('seguridad social') ? 3 : 0) +
    (lower.includes('informacion basica del afiliado') ? 3 : 0) +
    (lower.includes('afiliaci') ? 2 : 0) +
    (lower.includes('eps') ? 1 : 0) +
    (lower.includes('arl') ? 1 : 0) +
    (lower.includes('cotizante') ? 2 : 0) +
    (lower.includes('pensiones') ? 1 : 0) +
    (lower.includes('compensacion') ? 1 : 0);
  if (salud >= 4) return 'salud';

  // Cedula de ciudadania / tarjeta de identidad.
  const cedula =
    (lower.includes('cedula de ciudadania') ? 3 : 0) +
    (lower.includes('republica de colombia') ? 4 : 0) +
    (lower.includes('lugar de expedicion') ? 3 : 0) +
    (lower.includes('tarjeta de identidad') ? 3 : 0);
  if (cedula >= 4) return 'cedula';

  // Llamado de atencion: "LLAMADO DE ATENCION No. 033 / PARA: / DE: / ASUNTO: / FECHA:".
  if (
    lower.includes('llamado de atencion') ||
    (lower.includes('atencion') && lower.includes('para:') && lower.includes('asunto:'))
  ) {
    return 'llamado_atencion';
  }

  // Memorando ("MEMORANDO No. 026 / PARA: / DE: / ASUNTO: / FECHA:").
  if (
    lower.includes('memorando') ||
    lower.includes('memorandum') ||
    lower.includes('amonestacion') ||
    (lower.includes('para:') && lower.includes('asunto:') && lower.includes('de:'))
  ) {
    return 'memorando';
  }

  // Renuncia / carta de renuncia.
  if (lower.includes('renuncia') || lower.includes('carta de renuncia')) {
    return 'renuncia';
  }

  // Liquidacion final de contrato. Se evalua ANTES que `contrato` porque la
  // liquidacion contiene muchas palabras propias del contrato (trabajador,
  // empleador, NIT, fechas). Las claves distintivas son los conceptos laborales
  // y el cuadro de valores. Calibrado para OCR real de fotos (palabras pegadas
  // como "CESANTÍASDOBLES").
  const liquidacion =
    (lower.includes('liquidacion') ? 4 : 0) +
    (lower.includes('liquidacion final') ? 4 : 0) +
    (lower.includes('cesantias') ? 4 : 0) +
    (lower.includes('prima') ? 3 : 0) +
    (lower.includes('vacaciones') ? 2 : 0) +
    (lower.includes('indemnizacion') ? 3 : 0) +
    (lower.includes('intereses de cesantias') ? 4 : 0) +
    (lower.includes('retencion') ? 2 : 0) +
    (lower.includes('total liquidacion') ? 4 : 0) +
    (lower.includes('total a pagar') ? 3 : 0);
  if (liquidacion >= 4) return 'liquidacion';

  // Contrato laboral. Tolerante a ruido ("TÉRMINOACONTRATO", "trabajad", "NIT").
  const contrato = contar(
    lower,
    [
      'contrato',
      'emplead',
      'trabajad',
      'periodo de prueba',
      'termino fijo',
      'termino indefinido',
      'indefinido',
      'clausul',
      'nit',
    ],
    [4, 2, 2, 3, 2, 2, 2, 2, 1]
  );
  if (contrato >= 4) return 'contrato';

  // Funciones de cargo: listado de responsabilidades de un puesto.
  if (lower.includes('funciones') || lower.includes(' punto de venta') || lower.includes('punto de venta')) {
    return 'funciones';
  }

  // Hoja de vida / curriculum.
  const cv =
    (lower.includes('hoja de vida') ? 4 : 0) +
    (lower.includes('curriculum') ? 4 : 0) +
    (lower.includes('experiencia laboral') ? 3 : 0) +
    (lower.includes('perfil profesional') ? 3 : 0) +
    (lower.includes('formacion academica') ? 3 : 0) +
    (lower.includes('nombres y apellidos') ? 2 : 0) +
    (lower.includes('datos personales') ? 2 : 0) +
    (lower.includes('habilidades') ? 2 : 0) +
    (lower.includes('referencias') ? 1 : 0) +
    (lower.includes('informacion personal') ? 1 : 0);
  if (cv >= 3) return 'hoja_de_vida';

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
