/**
 * Liquidacion final de contrato de trabajo de un empleado de Rosimar.
 *
 * Al leer una liquidacion (normalmente foto/escaneo), el lector extrae este
 * formulario estructurado para que RRHH lo revise y corrija antes de guardar
 * (RN-7): fechas de ingreso/retiro, valores por concepto y total. Todo campo
 * debe quedar editable; ningun dato se asume correcto por defecto.
 */

export interface LiquidacionConcepto {
  concepto: string;
  valor: number;
}

export interface LiquidacionFormData {
  workerName?: string;
  workerDocumentNumber?: string;
  employerName?: string;
  cargo?: string;
  fechaIngreso?: string;
  fechaRetiro?: string;
  diasTrabajados?: number;
  salarioBase?: number;
  cesantias?: number;
  interesesCesantias?: number;
  prima?: number;
  vacaciones?: number;
  indemnizacion?: number;
  otrosConceptos?: LiquidacionConcepto[];
  totalLiquidacion?: number;
  fechaPago?: string;
  /** Texto OCR original del documento (para consulta). */
  rawText?: string;
}
