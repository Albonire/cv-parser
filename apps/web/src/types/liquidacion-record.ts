import { LiquidacionFormData } from './liquidacion';

/**
 * Registro de liquidacion en la tabla `liquidaciones` de la DB offline/Supabase.
 *
 * Cada liquidacion de un empleado (al retirarse) se persiste con la fecha de
 * retiro, el numero de documento para vincular con otros documentos del
 * expediente, y la estructura de datos parseada desde OCR (revisada y corregida
 * por RRHH).
 */
export interface LiquidacionRecord {
  id: string;
  employeeId?: string; // Se vincula despues si existe el empleado; durante OCR puede no estar creado aun.
  workerDocumentNumber: string;
  fechaRetiro: string; // YYYY-MM-DD
  liquidacionData: LiquidacionFormData;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}
