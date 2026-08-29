import { db } from './db';
import { queueMutation } from './sync';
import { AlertItem, AlertType, AlertSeverity } from '../../types/alert';

const NOTICE_DAYS = 30; // RN-3: preaviso
const PROBATION_DAYS = 60; // RN-4: periodo prueba 2 meses (aprox 60 dias)

export async function generateSystemAlerts() {
  const now = new Date();
  
  const employees = await db.employees.toArray();
  const contracts = await db.contracts.toArray();
  const existingAlerts = await db.alerts.toArray();

  const getExistingAlert = (type: AlertType, empId?: string, contractId?: string) => {
    return existingAlerts.find(a => 
      a.alertType === type && 
      (empId ? a.employeeId === empId : true) && 
      (contractId ? a.contractId === contractId : true)
    );
  };

  const createAlert = async (alert: Omit<AlertItem, 'id' | 'createdAt' | 'status'>) => {
    const newAlert: AlertItem = {
      ...alert,
      id: `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: 'pendiente',
      createdAt: now.toISOString(),
    };
    await db.alerts.put(newAlert);
    await queueMutation("create", "alerts", newAlert.id, newAlert as unknown as Record<string, unknown>);
  };

  for (const emp of employees) {
    if (emp.status !== 'activo') continue;
    const name = `${emp.candidateData.firstNames} ${emp.candidateData.lastNames}`;

    // RN-2: 3 Memorandos = Alerta Critica
    if (emp.memoCount >= 3) {
      if (!getExistingAlert('limite_memorandos', emp.id)) {
        await createAlert({
          alertType: 'limite_memorandos',
          severity: 'critical',
          employeeId: emp.id,
          employeeName: name,
          title: 'Límite de Memorandos Alcanzado',
          description: `El empleado ${name} ha acumulado ${emp.memoCount} memorandos. Requiere revisión de contrato inmediata (RN-2).`,
        });
      }
    }

    // RN-4: Fin periodo prueba
    if (emp.hireDate) {
      const hireDate = new Date(emp.hireDate);
      const diffTime = Math.abs(now.getTime() - hireDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const daysLeft = PROBATION_DAYS - diffDays;
      if (daysLeft > 0 && daysLeft <= 15) {
        if (!getExistingAlert('fin_periodo_prueba', emp.id)) {
          await createAlert({
            alertType: 'fin_periodo_prueba',
            severity: 'info',
            employeeId: emp.id,
            employeeName: name,
            title: 'Fin de Periodo de Prueba Próximo',
            description: `El periodo de prueba (RN-4) de ${name} finaliza en ${daysLeft} días.`,
          });
        }
      }
    }

    // Alertas por Contrato (RN-3)
    const empContracts = contracts.filter(c => c.employeeId === emp.id && c.status === 'vigente');
    for (const contract of empContracts) {
      if (contract.endDate) {
        const endDate = new Date(contract.endDate);
        const diffTime = endDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) {
          if (!getExistingAlert('contrato_vencido', emp.id, contract.id)) {
             await createAlert({
                alertType: 'contrato_vencido',
                severity: 'critical',
                employeeId: emp.id,
                employeeName: name,
                contractId: contract.id,
                title: 'Contrato Vencido sin Renovar',
                description: `El contrato de ${name} se venció el ${contract.endDate}.`,
             });
          }
        } else if (diffDays <= NOTICE_DAYS) {
          if (!getExistingAlert('vencimiento_contrato', emp.id, contract.id)) {
             await createAlert({
                alertType: 'vencimiento_contrato',
                severity: 'warning',
                employeeId: emp.id,
                employeeName: name,
                contractId: contract.id,
                title: 'Preaviso de Terminación de Contrato',
                description: `El contrato de ${name} vence en ${diffDays} días (Requiere preaviso de 30 días, RN-3).`,
             });
          }
        }
      }
    }
  }
}
