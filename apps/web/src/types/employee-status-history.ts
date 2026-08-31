import { EmployeeStatus, TerminationReason } from './employee';

/** Evento de la linea de tiempo de estados de un empleado en Rosimar. */
export type StatusEventType = 'contratado' | 'inactivo' | 'reingreso';

export interface EmployeeStatusHistoryItem {
  id: string;
  employeeId: string;
  eventType: StatusEventType;
  /** Estado del empleado despues de este evento (activo = contratado/reingreso). */
  status: EmployeeStatus;
  /** Fecha en que ocurrio el evento (ISO YYYY-MM-DD o timestamp). */
  date: string;
  reason?: string;
  /** Razon de terminacion cuando el evento es 'inactivo'. */
  terminationReason?: TerminationReason;
  note?: string;
  createdAt: string;
  updatedAt: string;
}
