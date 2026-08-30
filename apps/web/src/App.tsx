import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { PageHeader } from './components/PageHeader';
import { useRoute } from './lib/navigation/useRoute';
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
  // La sección activa vive en la URL, no en el estado: así funcionan el botón
  // "atrás", la recarga y los enlaces profundos.
  const { route, navegarA } = useRoute();
  const activeSection = route.section.id;

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueueCount, setSyncQueueCount] = useState(0);

  // Estados de datos
  const [candidates, setCandidates] = useState<CandidateFormData[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [contracts, setContracts] = useState<ContractFormData[]>([]);
  const [memoranda, setMemoranda] = useState<MemorandumItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  // El empleado preseleccionado en memorandos llega por la URL
  // (#/memorandos?empleado=emp-1), de modo que el enlace se puede compartir.
  const memoEmployeeFilter = route.params.get('empleado') ?? undefined;

  // Cargar datos desde IndexedDB
  const loadData = useCallback(async () => {
    try {
      const c = await db.candidates.toArray();
      const e = await db.employees.toArray();
      const con = await db.contracts.toArray();
      const m = await db.memoranda.toArray();
      await generateSystemAlerts();
      const a = await db.alerts.toArray();
      const pendingSyncs = await db.syncQueue.where('synced').equals(0).count();
      setSyncQueueCount(pendingSyncs);

      setCandidates(c);
      setEmployees(e);
      setContracts(con);
      setMemoranda(m);
      setAlerts(a);
    } catch (err) {
      console.error('Error cargando datos de IndexedDB:', err);
    }
  }, []);

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

  const handleNavigateToMemo = (empId: string) => navegarA('memoranda', { empleado: empId });

  const pendingAlertCount = alerts.filter((a) => a.status !== 'resuelta').length;

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <Navbar
        activeSection={activeSection}
        alertCount={pendingAlertCount}
        isOnline={isOnline}
        syncQueueCount={syncQueueCount}
      />

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 pb-24">
        <PageHeader
          title={route.section.title}
          description={route.section.description}
        />

        {activeSection === 'reader' && (
          <ReaderView
            onCandidateSaved={() => loadData()}
            onContractSaved={() => loadData()}
          />
        )}

        {activeSection === 'candidates' && (
          <CandidatesView candidates={candidates} onReload={loadData} />
        )}

        {activeSection === 'employees' && (
          <EmployeesView
            employees={employees}
            onReload={loadData}
            onNavigateToMemo={handleNavigateToMemo}
          />
        )}

        {activeSection === 'contracts' && (
          <ContractsView contracts={contracts} onReload={loadData} />
        )}

        {activeSection === 'memoranda' && (
          <MemorandaView
            memoranda={memoranda}
            employees={employees}
            onReload={loadData}
            preselectedEmployeeId={memoEmployeeFilter}
          />
        )}

        {activeSection === 'alerts' && (
          <AlertsView alerts={alerts} onReload={loadData} />
        )}

        {activeSection === 'dashboard' && (
          <DashboardView
            candidates={candidates}
            employees={employees}
            contracts={contracts}
            alerts={alerts}
          />
        )}

        {activeSection === 'reports' && (
          <ReportsView
            candidates={candidates}
            employees={employees}
            contracts={contracts}
          />
        )}
      </main>

      <footer className="bg-paper border-t border-fog py-4 text-center text-xs text-steel">
        Rosimar S.A.S. — Sistema de Gestion de Talento Humano y Analisis de Hojas de Vida · Operacion 100% en Navegador (Costo $0)
      </footer>
    </div>
  );
};

export default App;

