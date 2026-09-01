export interface HealthFormData {
  id?: string;
  employeeId?: string;
  workerName?: string;
  documentNumber?: string;
  epsName: string;
  epsRegime?: string; // Contributivo, Subsidiado, Especial
  arlName?: string;
  pensionFund?: string;
  severanceFund?: string;
  compensationBox?: string;
  affiliationDate?: string;
  /** Contacto que a veces trae la consulta de Seguridad Social. Se usa para
   *  consolidar la ficha del empleado cuando la hoja de vida no lo traia. */
  phone?: string;
  email?: string;
  certificateUrl?: string;
  rawText?: string;
}
