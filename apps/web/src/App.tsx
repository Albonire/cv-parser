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

