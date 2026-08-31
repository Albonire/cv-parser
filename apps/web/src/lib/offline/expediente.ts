import { db } from './db';
import { queueMutation } from './sync';
import { EmployeeDocumentRecord, DocumentCategory } from '../../types/employee-document';
import { ExtractedDocumentData } from '../../types/reader';
import { clasificarHistorial } from '../ocr/document-classifier';
import { realzarImagen } from '../ocr/image-prep';

/**
 * Ficha de expediente que se guarda al procesar un documento de un empleado.
 * Se vincula al empleado por su numero de documento (cedula/nit) cuando existe;
 * si el empleado no esta registrado aun, la ficha queda con los datos de
 * identidad para vincularla mas adelante.
 */

/** Normaliza un numero de documento (espacios, puntos y guiones). */
export function normalizarDocumento(valor?: string): string {
  return (valor ?? '').replace(/[.\s-]/g, '').trim();
}

/**
 * Convierte un archivo a data URI base64 para almacenarlo en IndexedDB.
 * Limitado a archivos de imagen razonables (< 10 MB) para no colapsar la
 * cuota del navegador.
 */
export async function fileToBase64(file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('La imagen excede 10 MB. Reduzca la resolucion antes de guardar.');
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen.'));
    reader.readAsDataURL(file);
  });
}

/** Busca un empleado por el numero de documento de su ficha de candidato. */
export async function buscarEmpleadoPorCedula(
  cedula: string
): Promise<{ id: string } | undefined> {
  const limpia = normalizarDocumento(cedula);
  if (!limpia) return undefined;

  const employees = await db.employees.toArray();
  const match = employees.find((e) =>
    normalizarDocumento(e.candidateData?.documentNumber) === limpia
  );

  return match ? { id: match.id } : undefined;
}

/** Construye la ficha de expediente a partir del resultado de extraccion. */
export async function construirExpediente(
  resultado: ExtractedDocumentData,
  categoria: DocumentCategory = clasificarHistorial(resultado.extractedText),
  imageFile?: File
): Promise<Omit<EmployeeDocumentRecord, 'id' | 'createdAt' | 'updatedAt'>> {
  const { workerName, workerDocumentNumber } = extraerIdentidad(resultado);

  let imageData: string | undefined;
  if (imageFile) {
    try {
      // Se realza la foto antes de guardarla: mayor resolucion, mejor contraste y
      // nitidez, de modo que la cédula quede legible como imagen en el expediente.
      // En el navegador se prefiere la version mejorada; en Node (pruebas) se
      // guarda el original.
      const mejorada =
        typeof window !== 'undefined'
          ? await realzarImagen(imageFile).catch(() => imageFile)
          : imageFile;
      imageData = await fileToBase64(mejorada);
    } catch {
      // Si falla la lectura de la imagen, se guarda sin ella (no bloquea el guardado).
    }
  }

  return {
    category: categoria,
    workerName,
    workerDocumentNumber,
    extractedText: resultado.extractedText,
    sourceFileName: resultado.fileName,
    processedAt: new Date().toISOString(),
    confidenceScore: resultado.confidenceScore,
    method: resultado.method,
    imageData,
  };
}

/** Extrae nombre y cedula del trabajador desde el resultado estructurado. */
function extraerIdentidad(resultado: ExtractedDocumentData): {
  workerName?: string;
  workerDocumentNumber?: string;
} {
  const contrato = resultado.contractData;
  if (contrato?.workerName) {
    return {
      workerName: contrato.workerName,
      workerDocumentNumber: contrato.workerDocumentNumber || undefined,
    };
  }

  const salud = resultado.healthData;
  if (salud?.workerName || salud?.documentNumber) {
    return {
      workerName: salud.workerName,
      workerDocumentNumber: salud.documentNumber,
    };
  }

  const candidato = resultado.candidateData;
  if (candidato?.documentNumber) {
    return {
      workerName: [candidato.firstNames, candidato.lastNames].filter(Boolean).join(' '),
      workerDocumentNumber: candidato.documentNumber,
    };
  }

  const cedulaGenerica = buscarCedulaEnTexto(resultado.extractedText);
  return cedulaGenerica ? { workerDocumentNumber: cedulaGenerica } : {};
}

/** Ultimo recurso: localiza un numero de cedula/nit en el texto OCR. */
export function buscarCedulaEnTexto(texto: string): string | undefined {
  const limpio = texto.replace(/\b(?:telefono|telefonos|celular|movil|whatsapp|contacto)\b/gi, ' ');

  // 1) Numero precedido por una etiqueta de documento: "CC No. 32.891.622",
  //    "Cedula: 1098765432", "NIT 900.123.456-7", "NUMERO DE IDENTIFICACION".
  const etiquetada = limpio.match(
    /(?:\bcc\b|cedula|documento de identidad|identificaci[oó]n|nit)\s+(?:no\.?|n[ºo])?\s*(\d[\d.\s-]{5,}\d)/i
  );
  if (etiquetada) {
    const digito = etiquetada[1].replace(/[.\s-]/g, '');
    if (digito.length >= 7 && digito.length <= 11) return digito;
  }

  // 2) Cualquier grupo de 8-10 digitos aislado (cedula colombiana tipica).
  //    Se descartan los que comienzan con 3 (moviles) para no confundir con telefono.
  const grupos = limpio.match(/(?<![\d.])\d{8,10}(?![\d.])/g) ?? [];
  const candidata = grupos.find((n) => !n.startsWith('3'));
  return candidata;
}

/**
 * Guarda el documento en el expediente del empleado, vinculandolo por cedula.
 * Devuelve la ficha guardada (con employeeId ya resuelto, si lo habia).
 */
export async function guardarDocumentoExpediente(
  base: Omit<EmployeeDocumentRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<EmployeeDocumentRecord> {
  const now = new Date().toISOString();
  const doc: EmployeeDocumentRecord = {
    ...base,
    id: `exp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: now,
    updatedAt: now,
  };

  const cedula = normalizarDocumento(doc.workerDocumentNumber);
  if (cedula) {
    const empleado = await buscarEmpleadoPorCedula(cedula);
    if (empleado) {
      doc.employeeId = empleado.id;
      doc.matchedEmployeeId = empleado.id;
    }
  }

  await db.employeeDocuments.put(doc);
  await queueMutation('create', 'employee_documents', doc.id, doc as unknown as Record<string, unknown>);

  return doc;
}

/** Devuelve el numero de documentos del expediente de un empleado. */
export async function contarExpediente(employeeId: string): Promise<number> {
  return db.employeeDocuments.where('employeeId').equals(employeeId).count();
}
