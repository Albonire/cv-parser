import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, TabType } from './components/Navbar';
import { ReaderView } from './features/reader/ReaderView';
import { CandidatesView } from './features/candidates/CandidatesView';
import { EmployeesView } from './features/employees/EmployeesView';
import { ContractsView } from './features/contracts/ContractsView';
import { MemorandaView } from './features/memoranda/MemorandaView';
import { AlertsView } from './features/alerts/AlertsView';
import { DashboardView } from './features/dashboard/DashboardView';
import { ReportsView } from './features/reports/ReportsView';
import { db } from './lib/offline/db';
import { CandidateFormData } from './types/candidate';
import { EmployeeItem } from './types/employee';
import { ContractFormData } from './types/contract';
import { MemorandumItem } from './types/memorandum';
import { AlertItem } from './types/alert';

import { initOfflineSync } from './lib/offline/sync';
import { generateSystemAlerts } from './lib/offline/alerts';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('reader');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueueCount, setSyncQueueCount] = useState(0);

  // Estados de datos
  const [candidates, setCandidates] = useState<CandidateFormData[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [contracts, setContracts] = useState<ContractFormData[]>([]);
  const [memoranda, setMemoranda] = useState<MemorandumItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  // Filtro de memorandos desde empleados
  const [memoEmployeeFilter, setMemoEmployeeFilter] = useState<string | undefined>(undefined);

  // Cargar datos desde IndexedDB
  const loadData = useCallback(async () => {
    try {
      const c = await db.candidates.toArray();
      const e = await db.employees.toArray();
      const con = await db.contracts.toArray();
      const m = await db.memoranda.toArray();
      await generateSystemAlerts();
      const a = await db.alerts.toArray();
      const pendingSyncs = await db.syncQueue.where("synced").equals(0).count();
      setSyncQueueCount(pendingSyncs);

      // Si la base de datos esta completamente vacia, precargar datos de ejemplo para Rosimar S.A.S.
      if (c.length === 0 && e.length === 0) {
        await seedInitialData();
        return;
      }

      setCandidates(c);
      setEmployees(e);
      setContracts(con);
      setMemoranda(m);
      setAlerts(a);
    } catch (err) {
      console.error('Error cargando datos de IndexedDB:', err);
    }
  }, []);

  const seedInitialData = async () => {
    const sampleCandidate: CandidateFormData = {
      id: 'cand-seed-1',
      firstNames: 'Carlos Alberto',
      lastNames: 'Mendoza Ruiz',
      documentType: 'CC',
      documentNumber: '1098765432',
      birthDate: '1992-05-14',
      nationality: 'Colombiana',
      cityResidence: 'Pamplona, Norte de Santander',
      phone: '+57 312 456 7890',
      email: 'carlos.mendoza@email.com',
      headline: 'Operario Especializado en Mantenimiento',
      summary: 'Tecnico electromecanico con 5 años de experiencia en mantenimiento industrial y control de maquinaria.',
      status: 'contratado',
      education: [
        {
          level: 'Tecnico',
          institution: 'SENA Regional Santander',
          degree: 'Mantenimiento Electromecanico Industrial',
          endYear: '2016',
        },
      ],
      experience: [
        {
          company: 'Manufacturas del Norte',
          position: 'Tecnico de Mantenimiento',
          startDate: '2018',
          endDate: '2023',
          responsibilities: 'Mantenimiento preventivo y correctivo de lineas de produccion.',
        },
      ],
      skills: [
        { category: 'General', skillName: 'Mantenimiento Industrial', level: 'Avanzado' },
        { category: 'General', skillName: 'Electricidad Basica', level: 'Intermedio' },
        { category: 'Habilidades Blandas', skillName: 'Trabajo en Equipo', level: 'Avanzado' },
      ],
      references: [
        { referenceType: 'laboral', name: 'Ing. Laura Gomez', phone: '315 987 6543' },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const sampleEmployee: EmployeeItem = {
      id: 'emp-seed-1',
      candidateId: sampleCandidate.id,
      employeeCode: 'ROS-1042',
      status: 'activo',
      hireDate: '2024-01-15',
      candidateData: sampleCandidate,
      memoCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const sampleContract: ContractFormData = {
      id: 'contract-seed-1',
      employeeId: sampleEmployee.id,
      employerName: 'Rosimar S.A.S.',
      employerNit: '900.123.456-7',
      workerName: 'Carlos Alberto Mendoza Ruiz',
      workerDocumentNumber: '1098765432',
      position: 'Operario de Mantenimiento',
      salary: 1600000,
      currency: 'COP',
      paymentFrequency: 'mensual',
      contractType: 'termino_fijo',
      durationMonths: 12,
      startDate: '2024-01-15',
      endDate: '2025-01-14',
      trialPeriodDays: 60,
      noticeDays: 30,
      executionPlace: 'Pamplona, Norte de Santander',
      status: 'vigente',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const sampleMemo: MemorandumItem = {
      id: 'memo-seed-1',
      employeeId: sampleEmployee.id,
      employeeName: 'Carlos Alberto Mendoza Ruiz',
      memoType: 'llamado_atencion',
      subject: 'Llegada tardia no justificada',
      description: 'Llegada con 35 minutos de retraso el dia 12 de marzo sin previo aviso a supervision.',
      memoDate: '2024-03-12',
      responsiblePerson: 'Gestion Humana - Rosimar S.A.S.',
      status: 'registrado',
      createdAt: new Date().toISOString(),
    };

    const sampleAlert: AlertItem = {
      id: 'alert-seed-1',
      employeeId: sampleEmployee.id,
      employeeName: 'Carlos Alberto Mendoza Ruiz',
      alertType: 'vencimiento_contrato',
      severity: 'warning',
      title: 'Preaviso de vencimiento de contrato (30 dias) - Carlos Mendoza',
      description: 'El contrato a termino fijo de Carlos Alberto Mendoza Ruiz vence en 30 dias. Debe emitirse la carta de preaviso o decision de renovacion.',
      dueDate: '2024-12-15',
      status: 'pendiente',
      createdAt: new Date().toISOString(),
    };

    await db.candidates.put(sampleCandidate);
    await db.employees.put(sampleEmployee);
    await db.contracts.put(sampleContract);
    await db.memoranda.put(sampleMemo);
    await db.alerts.put(sampleAlert);

    setCandidates([sampleCandidate]);
    setEmployees([sampleEmployee]);
    setContracts([sampleContract]);
    setMemoranda([sampleMemo]);
    setAlerts([sampleAlert]);
  };

  useEffect(() => {
    loadData();
    initOfflineSync();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadData]);

  const handleNavigateToMemo = (empId: string) => {
    setMemoEmployeeFilter(empId);
    setActiveTab('memoranda');
  };

  const pendingAlertCount = alerts.filter((a) => a.status !== 'resuelta').length;

  return (
    <div className="min-h-screen bg-navy-50/70 flex flex-col font-sans">
      <Navbar syncQueueCount={syncQueueCount}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setMemoEmployeeFilter(undefined);
          setActiveTab(tab);
        }}
        alertCount={pendingAlertCount}
        isOnline={isOnline}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'reader' && (
          <ReaderView
            onCandidateSaved={() => loadData()}
            onContractSaved={() => loadData()}
          />
        )}

        {activeTab === 'candidates' && (
          <CandidatesView candidates={candidates} onReload={loadData} />
        )}

        {activeTab === 'employees' && (
          <EmployeesView
            employees={employees}
            onReload={loadData}
            onNavigateToMemo={handleNavigateToMemo}
          />
        )}

        {activeTab === 'contracts' && (
          <ContractsView contracts={contracts} onReload={loadData} />
        )}

        {activeTab === 'memoranda' && (
          <MemorandaView
            memoranda={memoranda}
            employees={employees}
            onReload={loadData}
            preselectedEmployeeId={memoEmployeeFilter}
          />
        )}

        {activeTab === 'alerts' && (
          <AlertsView alerts={alerts} onReload={loadData} />
        )}

        {activeTab === 'dashboard' && (
          <DashboardView
            candidates={candidates}
            employees={employees}
            contracts={contracts}
            alerts={alerts}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            candidates={candidates}
            employees={employees}
            contracts={contracts}
          />
        )}
      </main>

      <footer className="bg-white border-t border-navy-200 py-4 text-center text-xs text-navy-500">
        Rosimar S.A.S. — Sistema de Gestion de Talento Humano y Analisis de Hojas de Vida · Operacion 100% en Navegador (Costo $0)
      </footer>
    </div>
  );
};

export default App;

