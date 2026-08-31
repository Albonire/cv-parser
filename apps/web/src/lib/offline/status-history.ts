import { db } from './db';
import { queueMutation } from './sync';
import {
  EmployeeStatusHistoryItem,
  StatusEventType,
} from '../../types/employee-status-history';
import { EmployeeStatus, EmployeeItem, TerminationReason } from '../../types/employee';

/**
 * Linea de tiempo de estados del empleado.
 *
 * Rosimar necesita conservar la historia completa de cada persona dentro de la
 * empresa: cuando fue contratada, cuando termino (y por que) y si volvio a ser
 * contratada (reingreso). Este modulo registra cada cambio de estado como un
 * evento inmutable en `employeeStatusHistory`, de modo que el historial quede
 * ordenado y consultable sin depender solo del campo `status` actual del
 * empleado. El reingreso NUNCA borra el evento de salida anterior: se acumula.
 */

/** Registra un evento de estado en la linea de tiempo y lo sincroniza. */
export async function registrarEstadoEmpleado(input: {
  employeeId: string;
  eventType: StatusEventType;
  status: EmployeeStatus;
  date?: string;
  reason?: string;
  terminationReason?: TerminationReason;
  note?: string;
}): Promise<EmployeeStatusHistoryItem> {
  const now = new Date().toISOString();
  const item: EmployeeStatusHistoryItem = {
    id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    employeeId: input.employeeId,
    eventType: input.eventType,
    status: input.status,
    date: input.date || now,
    reason: input.reason,
    terminationReason: input.terminationReason,
    note: input.note,
    createdAt: now,
    updatedAt: now,
  };

  await db.employeeStatusHistory.put(item);
  await queueMutation('create', 'employee_status_history', item.id, item as unknown as Record<string, unknown>);
  return item;
}

/** Devuelve la linea de tiempo completa de un empleado, ordenada de mas antigua a mas reciente. */
export async function obtenerLineaTiempoEmpleado(
  employeeId: string
): Promise<EmployeeStatusHistoryItem[]> {
  const eventos = await db.employeeStatusHistory.where('employeeId').equals(employeeId).toArray();
  return eventos.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

/**
 * Termina la relacion laboral de un empleado (rutas unificadas de
 * inactivacion / despido / renuncia / etc.). Exige la fecha y la razon de
 * salida (RN-5): sin ellas no desactiva.
 */
export async function finalizarEmpleado(input: {
  empleado: EmployeeItem;
  terminationDate: string;
  terminationReason: TerminationReason;
  terminationObs?: string;
}): Promise<EmployeeItem | null> {
  if (!input.terminationDate || !input.terminationReason) return null;

  const now = new Date().toISOString();
  const actualizado: EmployeeItem = {
    ...input.empleado,
    status: 'inactivo',
    terminationDate: input.terminationDate,
    terminationReason: input.terminationReason,
    updatedAt: now,
  };

  await db.employees.put(actualizado);
  await queueMutation('update', 'employees', actualizado.id, actualizado as unknown as Record<string, unknown>);

  // Evento de linea de tiempo.
  await registrarEstadoEmpleado({
    employeeId: actualizado.id,
    eventType: 'inactivo',
    status: 'inactivo',
    date: input.terminationDate,
    reason: input.terminationObs,
    terminationReason: input.terminationReason,
  });

  return actualizado;
}

/**
 * Reingreso: vuelve a contratar a un empleado que habia terminado. Reactiva al
 * empleado, limpia la fecha/razon de salida anterior y registra un evento de
 * reingreso SIN borrar los eventos de salida previos.
 */
export async function reingresarEmpleado(input: {
  empleado: EmployeeItem;
  rehireDate: string;
  note?: string;
}): Promise<EmployeeItem | null> {
  if (!input.rehireDate) return null;

  const now = new Date().toISOString();
  const actualizado: EmployeeItem = {
    ...input.empleado,
    status: 'activo',
    // El reingreso no borra la fecha de alta original; la mantiene como la
    // fecha de primera vinculacion. Se conserva historia completa en la tabla.
    hireDate: input.empleado.hireDate || input.rehireDate,
    terminationDate: undefined,
    terminationReason: undefined,
    updatedAt: now,
  };

  await db.employees.put(actualizado);
  await queueMutation('update', 'employees', actualizado.id, actualizado as unknown as Record<string, unknown>);

  await registrarEstadoEmpleado({
    employeeId: actualizado.id,
    eventType: 'reingreso',
    status: 'activo',
    date: input.rehireDate,
    note: input.note,
  });

  return actualizado;
}
