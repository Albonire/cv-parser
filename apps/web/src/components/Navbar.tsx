import React from 'react';
import { LegalDocument02Icon, UserGroupIcon, Briefcase01Icon, DocumentValidationIcon, Alert02Icon, BarChartIcon, Download01Icon, Building01Icon, Wifi01Icon, WifiDisconnected01Icon } from 'hugeicons-react';

export type TabType =
  | 'reader'
  | 'candidates'
  | 'employees'
  | 'contracts'
  | 'memoranda'
  | 'alerts'
  | 'dashboard'
  | 'reports';

interface NavbarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  alertCount: number;
  isOnline: boolean;
  syncQueueCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  alertCount,
  isOnline,
  syncQueueCount = 0,
}) => {
  const navItems: { id: TabType; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'reader', label: 'Lector OCR', icon: LegalDocument02Icon },
    { id: 'candidates', label: 'Candidatos', icon: UserGroupIcon },
    { id: 'employees', label: 'Empleados', icon: Briefcase01Icon },
    { id: 'contracts', label: 'Contratos', icon: DocumentValidationIcon },
    { id: 'memoranda', label: 'Memorandos', icon: Alert02Icon },
    { id: 'alerts', label: 'Alertas', icon: Alert02Icon },
    { id: 'dashboard', label: 'Dashboard', icon: BarChartIcon },
    { id: 'reports', label: 'Reportes', icon: Download01Icon },
  ];

  return (
    <header className="bg-navy-900 text-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo y Nombre de Empresa */}
          <div className="flex items-center space-x-3">
            <div className="bg-brand-600 p-2 rounded-lg text-white">
              <Building01Icon className="h-6 w-6" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight">Rosimar S.A.S.</span>
              <span className="hidden md:inline-block ml-2 text-xs text-navy-300 font-medium px-2 py-0.5 bg-navy-800 rounded">
                Talento Humano & OCR
              </span>
            </div>
          </div>

          {/* Navegacion de pestanas */}
          <nav className="hidden lg:flex space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors relative ${
                    isActive
                      ? 'bg-navy-800 text-brand-400 font-semibold'
                      : 'text-navy-200 hover:bg-navy-800 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 mr-1.5" />
                  {item.label}
                  {item.id === 'alerts' && alertCount > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-red-600 text-white rounded-full font-bold">
                      {alertCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Estado de Conexion */}
          <div className="flex items-center space-x-2">
            <div
              className={`flex items-center text-xs px-2.5 py-1 rounded-full font-medium ${
                isOnline ? 'bg-brand-900/50 text-brand-300 border border-brand-700' : 'bg-amber-900/50 text-amber-300 border border-amber-700'
              }`}
            >
              {isOnline ? (
                <>
                  <Wifi01Icon className="h-3.5 w-3.5 mr-1" />
                  Online
                  {syncQueueCount > 0 && <span className="ml-1 opacity-70">({syncQueueCount} pt)</span>}
                </>
              ) : (
                <>
                  <WifiDisconnected01Icon className="h-3.5 w-3.5 mr-1" />
                  Offline
                  {syncQueueCount > 0 && <span className="ml-1 opacity-70">({syncQueueCount} pt)</span>}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Barra de navegacion movil / tablet */}
        <div className="lg:hidden flex overflow-x-auto py-2 space-x-2 border-t border-navy-800 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center whitespace-nowrap px-2.5 py-1.5 rounded-md text-xs font-medium ${
                  isActive
                    ? 'bg-navy-800 text-brand-400 font-semibold'
                    : 'text-navy-200 hover:bg-navy-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5 mr-1" />
                {item.label}
                {item.id === 'alerts' && alertCount > 0 && (
                  <span className="ml-1 px-1 text-[10px] bg-red-600 text-white rounded-full">
                    {alertCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
