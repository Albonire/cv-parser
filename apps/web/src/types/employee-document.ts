/**
 * Expediente documental por empleado.
 *
 * Rosimar conserva el historial de cada empleado dentro de la empresa: contratos,
 * memorandos, llamados de atencion, consultas de Seguridad Social, funciones de
 * cargo, renuncias, etc. Al leer un documento que no es una hoja de vida, la
 * aplicacion guarda una ficha de expediente con el tipo, el texto reconocido y
 * los datos de identidad, vinculada al empleado por su numero de documento.
 *
 * La imagen original se almacena como base64 en IndexedDB (local, costo $0):
 * esto permite ver el documento recortado y bonito en el expediente sin subir
 * nada a la nube. El texto OCR tambien se conserva para busqueda y revision.
 */

/** Categorias de historial laboral reconocibles por el lector. */
export type DocumentCategory =
  | 'contrato'
  | 'liquidacion'
  | 'memorando'
  | 'llamado_atencion'
  | 'renuncia'
  | 'funciones'
  | 'salud'
  | 'cedula'
  | 'hoja_de_vida'
  | 'desconocido';

export interface EmployeeDocumentRecord {
  id: string;
  /** Empleado al que pertenece el documento (si fue posible vincularlo por cedula). */
  employeeId?: string;
  /** Categoria del documento dentro del historial del empleado. */
  category: DocumentCategory;
  /** Nombre reconocido del trabajador (util para vincular). */
  workerName?: string;
  /** Cedula/nit reconocido del trabajador (clave de vinculacion). */
  workerDocumentNumber?: string;
  /** Numero de documento del empleado vinculado, si lo habia. */
  matchedEmployeeId?: string;
  /** Texto reconocido completo del documento (OCR / extraccion). */
  extractedText: string;
  /** Nombre del archivo de origen (foto, PDF o Word). */
  sourceFileName: string;
  /** Fecha en que se registro el documento en el expediente. */
  processedAt: string;
  /** Confianza compuesta de la extraccion (0-1). */
  confidenceScore: number;
  /** Metodo de extraccion usado. */
  method: 'pdf_text' | 'pdf_ocr' | 'image_ocr' | 'docx';
  /** Imagen original del documento como data URI base64 (para vista visual en expediente). */
  imageData?: string;
  createdAt: string;
  updatedAt: string;
}
