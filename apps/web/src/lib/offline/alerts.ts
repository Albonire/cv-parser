import { db } from './db';
import { queueMutation } from './sync';
import { AlertItem, AlertType } from '../../types/alert';
import { DEFAULT_EMPLOYER, EMPLOYER_ID_DEFAULT } from '../../types/employer';

export async function generateSystemAlerts() {
  const now = new Date();

  // Cargar limites configurables del empleador (RN-2 / RN-3 / RN-4)
  const employer = (await db.employers.get(EMPLOYER_ID_DEFAULT)) ?? DEFAULT_EMPLOYER;
  const memoThreshold = employer.memoWarningThreshold;
  const noticeDays = employer.noticeDaysDefault;
  const probationDays = Math.round(employer.trialPeriodMonthsDefault * 30);
  
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

    // RN-2: Limite de memorandos = Alerta Critica
    if (emp.memoCount >= memoThreshold) {
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
      
      const daysLeft = probationDays - diffDays;
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
        } else if (diffDays <= noticeDays) {
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

  // Limpieza de alertas obsoletas: una alerta "pendiente" cuya condicion ya no
  // aplica se marca resuelta en vez de acumularse para siempre (empleado
  // inactivo, contrato ya no vigente, memorandos por debajo del umbral).
  const contratosVigentes = new Set(
    contracts.filter((c) => c.status === 'vigente').map((c) => c.id)
  );
  const aResolver = existingAlerts.filter((a) => {
    if (a.status === 'resuelta') return false;
    const emp = employees.find((e) => e.id === a.employeeId);
    if (!emp) return false;
    const inactivo = emp.status !== 'activo';

    if (a.alertType === 'contrato_vencido' || a.alertType === 'vencimiento_contrato') {
      return inactivo || (a.contractId ? !contratosVigentes.has(a.contractId) : false);
    }
    if (a.alertType === 'limite_memorandos') {
      return inactivo || (emp.memoCount ?? 0) < memoThreshold;
    }
    return inactivo;
  });

  for (const alert of aResolver) {
    await db.alerts.update(alert.id, { status: 'resuelta' });
    await queueMutation('update', 'alerts', alert.id, { ...alert, status: 'resuelta' } as unknown as Record<string, unknown>);
  }
}
