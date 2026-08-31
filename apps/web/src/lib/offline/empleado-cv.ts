import { db } from './db';
import { queueMutation } from './sync';
import { EmployeeItem } from '../../types/employee';
import { CandidateFormData } from '../../types/candidate';
import { construirExpediente, guardarDocumentoExpediente } from './expediente';
import { ExtractedDocumentData } from '../../types/reader';

/**
 * Guarda la hoja de vida de un EMPLEADO ya existente en Rosimar.
 *
 * A diferencia del guardado de candidato (que crea una fila nueva en
 * `candidates`), esto:
 *   1. Actualiza el `candidateData` embebido del empleado con la CV leida
 *      (refresca nombres, contacto, formacion, experiencia...).
 *   2. Adjunta la CV como documento `hoja_de_vida` del expediente del
 *      empleado (vinculado por cedula), para que quede en su historial.
 *   3. NO crea un candidato duplicado.
 *
 * Esto resuelve el escenario de la persona que ya es empleada (activa o
 * inactiva) y cuya hoja de vida se vuelve a cargar para registrar o
 * actualizar su informacion en la base, sin duplicar registros.
 */

/**
 * Guarda los datos de la hoja de vida de un empleado existente.
 * Devuelve `true` si encontro y actualizo al empleado, `false` si no.
 */
export async function guardarHojaDeVidaEmpleado(
  empleado: EmployeeItem,
  candidateData: CandidateFormData,
  resultado: ExtractedDocumentData,
  imageFile?: File
): Promise<boolean> {
  const now = new Date().toISOString();

  const actualizado: EmployeeItem = {
    ...empleado,
    candidateData: {
      ...empleado.candidateData,
      ...candidateData,
      // No se pierde la identificacion que ya registra Rosimar.
      documentType: candidateData.documentType || empleado.candidateData.documentType,
      documentNumber: candidateData.documentNumber || empleado.candidateData.documentNumber,
    },
    updatedAt: now,
  };

  await db.employees.put(actualizado);
  await queueMutation('update', 'employees', actualizado.id, actualizado as unknown as Record<string, unknown>);

  // Adjunta la CV al expediente como documento hoja_de_vida.
  try {
    const base = await construirExpediente(resultado, 'hoja_de_vida', imageFile);
    base.workerDocumentNumber =
      base.workerDocumentNumber || empleado.candidateData.documentNumber || candidateData.documentNumber;
    base.employeeId = empleado.id;
    base.matchedEmployeeId = empleado.id;
    await guardarDocumentoExpediente(base);
  } catch (err) {
    console.error('No se pudo adjuntar la hoja de vida al expediente del empleado', err);
  }

  return true;
}
