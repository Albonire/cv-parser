import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { PageHeader } from './components/PageHeader';
import { useRoute } from './lib/navigation/useRoute';
import { ReaderView } from './features/reader/ReaderView';
import { CandidatesView } from './features/candidates/CandidatesView';
import { EmployeesView } from './features/employees/EmployeesView';
import { ExpedienteView } from './features/expediente/ExpedienteView';
import { ContractsView } from './features/contracts/ContractsView';
import { VacanciesView } from './features/vacancies/VacanciesView';
import { MemorandaView } from './features/memoranda/MemorandaView';
import { LiquidacionesView } from './features/liquidaciones/LiquidacionesView';
import { AlertsView } from './features/alerts/AlertsView';
import { DashboardView } from './features/dashboard/DashboardView';
import { ReportsView } from './features/reports/ReportsView';
import { EmployerSettingsView } from './features/settings/EmployerSettingsView';
import { db } from './lib/offline/db';
import { CandidateFormData } from './types/candidate';
import { EmployeeItem } from './types/employee';
import { EmployeeDocumentRecord } from './types/employee-document';
import { ContractFormData } from './types/contract';
import { MemorandumItem } from './types/memorandum';
import { LiquidacionRecord } from './types/liquidacion-record';
import { AlertItem } from './types/alert';
import { VacancyFormData } from './types/vacancy';
import { SessionUser } from './types/session';
import { getSessionUser, setSessionUser, clearSessionUser, canManage } from './lib/employer';
import { LoginView } from './features/auth/LoginView';

import { initOfflineSync } from './lib/offline/sync';
import { generateSystemAlerts } from './lib/offline/alerts';
import { recalcularEstadosEmpleados } from './lib/offline/empleado-historial';

export const App: React.FC = () => {
  // La sección activa vive en la URL, no en el estado: así funcionan el botón
  // "atrás", la recarga y los enlaces profundos.
  const { route, navegarA } = useRoute();
  const activeSection = route.section.id;

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueueCount, setSyncQueueCount] = useState(0);
  const [session, setSession] = useState<SessionUser | null>(() => getSessionUser());

  // Estados de datos
  const [candidates, setCandidates] = useState<CandidateFormData[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [employeeDocuments, setEmployeeDocuments] = useState<EmployeeDocumentRecord[]>([]);
  const [contracts, setContracts] = useState<ContractFormData[]>([]);
  const [memoranda, setMemoranda] = useState<MemorandumItem[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [vacancies, setVacancies] = useState<VacancyFormData[]>([]);

  // El empleado preseleccionado en memorandos llega por la URL
  // (#/memorandos?empleado=emp-1), de modo que el enlace se puede compartir.
  const memoEmployeeFilter = route.params.get('empleado') ?? undefined;
  const expedienteEmployeeFilter = route.params.get('empleado') ?? undefined;

  // Cargar datos desde IndexedDB
  const loadData = useCallback(async () => {
    try {
      const c = await db.candidates.toArray();
      // Deriva el estado activo/inactivo desde la evidencia persistida
      // (liquidaciones y renuncias) antes de cargar la lista (RN-5).
      await recalcularEstadosEmpleados();
      const e = await db.employees.toArray();
      const con = await db.contracts.toArray();
      const m = await db.memoranda.toArray();
      const liq = await db.liquidaciones.toArray();
      const v = await db.vacancies.toArray();
      const exp = await db.employeeDocuments.toArray();
      const s = getSessionUser();
      await generateSystemAlerts();
      const a = await db.alerts.toArray();
      const pendingSyncs = await db.syncQueue.where('synced').equals(0).count();
      setSyncQueueCount(pendingSyncs);

      setCandidates(c);
      setEmployees(e);
      setEmployeeDocuments(exp);
      setContracts(con);
      setMemoranda(m);
      setLiquidaciones(liq);
      setAlerts(a);
      setVacancies(v);
      setSession(s);
    } catch (err) {
      console.error('Error cargando datos de IndexedDB:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
    initOfflineSync();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleSyncChanged = () => loadData();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('sync-queue-changed', handleSyncChanged);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sync-queue-changed', handleSyncChanged);
    };
  }, [loadData]);

  const handleNavigateToMemo = (empId: string) => navegarA('memoranda', { empleado: empId });
  const handleNavigateToExpediente = (empId: string) => navegarA('expediente', { empleado: empId });

  const pendingAlertCount = alerts.filter((a) => a.status !== 'resuelta').length;

  const handleLogin = (user: SessionUser) => {
    setSessionUser(user);
    setSession(user);
    loadData();
  };

  const handleLogout = () => {
    clearSessionUser();
    setSession(null);
  };

  if (!session) {
    return <LoginView onLogin={handleLogin} />;
  }

  const gestionPermitida = canManage(session.role);

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <Navbar
        activeSection={activeSection}
        alertCount={pendingAlertCount}
        isOnline={isOnline}
        syncQueueCount={syncQueueCount}
        sessionRole={session.role}
        onLogout={handleLogout}
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
            onNavigateToExpediente={handleNavigateToExpediente}
          />
        )}

        {activeSection === 'expediente' && (
          <ExpedienteView
            documents={employeeDocuments}
            employees={employees}
            contracts={contracts}
            memoranda={memoranda}
            liquidaciones={liquidaciones}
            canManage={gestionPermitida}
            onReload={loadData}
            preselectedEmployeeId={expedienteEmployeeFilter}
          />
        )}

        {activeSection === 'contracts' && (
          <ContractsView contracts={contracts} employees={employees} onReload={loadData} />
        )}

        {activeSection === 'vacancies' && (
          <VacanciesView
            vacancies={vacancies}
            candidates={candidates}
            onReload={loadData}
          />
        )}

        {activeSection === 'memoranda' && (
          <MemorandaView
            memoranda={memoranda}
            employees={employees}
            onReload={loadData}
            preselectedEmployeeId={memoEmployeeFilter}
          />
        )}

        {activeSection === 'liquidaciones' && (
          <LiquidacionesView
            liquidaciones={liquidaciones}
            employees={employees}
            canManage={gestionPermitida}
            onReload={loadData}
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

        {activeSection === 'settings' && (
          <EmployerSettingsView />
        )}
      </main>

      <footer className="bg-paper border-t border-fog py-4 text-center text-xs text-steel">
        Rosimar S.A.S. — Sistema de Gestion de Talento Humano y Analisis de Hojas de Vida · Operacion 100% en Navegador (Costo $0)
      </footer>
    </div>
  );
};

export default App;

