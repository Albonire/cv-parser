import { db } from './db';
import { queueMutation } from './sync';
import { LiquidacionRecord } from '../../types/liquidacion-record';
import { LiquidacionFormData } from '../../types/liquidacion';
import { normalizarDocumento } from './expediente';

/**
 * Guarda una liquidacion leida por OCR en la tabla de liquidaciones.
 *
 * Durante el lote, puede que no exista aun el empleado (si es su primer
 * documento). La liquidacion se vincula por:
 * 1. workerDocumentNumber (obtenido del OCR del documento).
 * 2. Despues, cuando se crea el empleado, se vincula employeeId retroactivamente.
 */
export async function guardarLiquidacionDesdeOcr(
  workerDocumentNumber: string,
  liquidacionData: LiquidacionFormData
): Promise<LiquidacionRecord> {
  const limpia = normalizarDocumento(workerDocumentNumber);
  if (!limpia) {
    throw new Error(`Numero de documento invalido: ${workerDocumentNumber}`);
  }

  // Intenta vincular con un empleado existente si tiene ese documento.
  const empleadoExistente = await obtenerEmpleadoPorCedula(limpia);
  const now = new Date().toISOString();

  const record: LiquidacionRecord = {
    id: `liq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    employeeId: empleadoExistente?.id,
    workerDocumentNumber: limpia,
    fechaRetiro: liquidacionData.fechaRetiro || new Date().toISOString().split('T')[0],
    liquidacionData,
    createdAt: now,
    updatedAt: now,
  };

  // Guarda en IndexedDB.
  await db.liquidaciones.add(record);
  // Cola de sincronizacion con Supabase.
  await queueMutation('create', 'liquidaciones', record.id, record as unknown as Record<string, unknown>);

  return record;
}

/**
 * Vincula una liquidacion a un empleado recien creado.
 * Se usa cuando el empleado se crea despues del OCR pero la liquidacion ya existe.
 */
export async function vincularLiquidacionAlEmpleado(
  workerDocumentNumber: string,
  employeeId: string
): Promise<LiquidacionRecord | undefined> {
  const limpia = normalizarDocumento(workerDocumentNumber);
  if (!limpia) return undefined;

  const records = await db.liquidaciones
    .where('workerDocumentNumber')
    .equals(limpia)
    .filter((r) => !r.employeeId)
    .toArray();

  if (records.length === 0) return undefined;

  // Vincula el primer registro sin empleado (puede haber multiples si se subieron
  // varios documentos antes de crear el empleado).
  const record = records[0];
  const actualizado: LiquidacionRecord = {
    ...record,
    employeeId,
    updatedAt: new Date().toISOString(),
  };

  await db.liquidaciones.put(actualizado);
  await queueMutation('update', 'liquidaciones', actualizado.id, actualizado as unknown as Record<string, unknown>);

  return actualizado;
}

/**
 * Busca las liquidaciones de un empleado (por employeeId o por documento).
 */
export async function obtenerLiquidacionesDelEmpleado(
  employeeId?: string,
  workerDocumentNumber?: string
): Promise<LiquidacionRecord[]> {
  if (employeeId) {
    return db.liquidaciones.where('employeeId').equals(employeeId).toArray();
  }

  if (workerDocumentNumber) {
    const limpia = normalizarDocumento(workerDocumentNumber);
    if (!limpia) return [];
    return db.liquidaciones.where('workerDocumentNumber').equals(limpia).toArray();
  }

  return [];
}

/**
 * Obtiene todas las liquidaciones pendientes de vincular a un empleado
 * (aquellas sin employeeId).
 */
export async function obtenerLiquidacionesSinEmpleado(): Promise<LiquidacionRecord[]> {
  return db.liquidaciones.filter((r) => !r.employeeId).toArray();
}

/**
 * Busca un empleado existente por numero de documento.
 * (Replica la logica de empleado-historial.ts).
 */
async function obtenerEmpleadoPorCedula(cedula: string) {
  const limpia = normalizarDocumento(cedula);
  if (!limpia) return undefined;
  const employees = await db.employees.toArray();
  return employees.find(
    (e) => normalizarDocumento(e.candidateData?.documentNumber) === limpia
  );
}

/**
 * Actualiza la liquidacionData de una liquidacion existente.
 * (Util cuando RRHH revisa y corrige los datos del OCR antes de guardar el empleado).
 */
export async function actualizarLiquidacion(
  liquidacionId: string,
  liquidacionData: Partial<LiquidacionFormData>
): Promise<LiquidacionRecord | undefined> {
  const record = await db.liquidaciones.get(liquidacionId);
  if (!record) return undefined;

  const actualizado: LiquidacionRecord = {
    ...record,
    liquidacionData: { ...record.liquidacionData, ...liquidacionData },
    updatedAt: new Date().toISOString(),
  };

  await db.liquidaciones.put(actualizado);
  await queueMutation('update', 'liquidaciones', actualizado.id, actualizado as unknown as Record<string, unknown>);

  return actualizado;
}

/**
 * Elimina una liquidacion (solo desde IndexedDB; la supresion en Supabase
 * sera por sincronizacion de cola).
 */
export async function eliminarLiquidacion(liquidacionId: string): Promise<void> {
  const record = await db.liquidaciones.get(liquidacionId);
  if (record) {
    await db.liquidaciones.delete(liquidacionId);
    await queueMutation('delete', 'liquidaciones', liquidacionId, {} as Record<string, unknown>);
  }
}
