export type AlertType =
  | 'vencimiento_contrato'
  | 'contrato_vencido'
  | 'fin_periodo_prueba'
  | 'limite_memorandos'
  | 'cumpleanos'
  | 'otro';

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertStatus = 'pendiente' | 'vista' | 'resuelta';

export interface AlertItem {
  id: string;
  employeeId?: string;
  employeeName?: string;
  contractId?: string;
  alertType: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  dueDate?: string;
  status: AlertStatus;
  createdAt: string;
}
