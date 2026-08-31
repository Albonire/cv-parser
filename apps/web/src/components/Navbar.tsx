import React from 'react';
import { hrefDe, SectionId, SECTIONS } from '../lib/navigation/routes';
import { ROLE_LABELS, UserRole } from '../types/session';

/*
 * La fila de secciones es puramente tipográfica: el estado activo se indica con
 * peso, color y un filete inferior, sin fondo ni icono.
 *
 * Se probó con un icono por sección, pero las ocho pestañas con icono a 16px
 * necesitan 1282px y el lienzo del sistema mide 1184px útiles, de modo que la
 * última quedaba cortada. Es además lo que especifica el referente para la
 * navegación por pestañas.
 */

interface NavbarProps {
  activeSection: SectionId;
  alertCount: number;
  isOnline: boolean;
  syncQueueCount?: number;
  sessionRole: UserRole;
  onRoleChange: (role: UserRole) => void;
}

// Secciones visibles sólo para ciertos roles.
const ROLE_GATED: Partial<Record<SectionId, UserRole[]>> = {
  settings: ['admin'],
};

export const Navbar: React.FC<NavbarProps> = ({
  activeSection,
  alertCount,
  isOnline,
  syncQueueCount = 0,
  sessionRole,
  onRoleChange,
}) => {
  const visibleSections = SECTIONS.filter((s) => {
    const gate = ROLE_GATED[s.id];
    return !gate || gate.includes(sessionRole);
  });

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* ============================================= HEADER CORPORATIVO */}
      <div 
        style={{
          background: 'linear-gradient(135deg, #1a3a52 0%, #2563eb 100%)'
        }}
        className="border-b border-blue-900/20 px-6 py-4"
      >
        <div className="mx-auto max-w-[1280px]">
          <div className="flex h-16 items-center justify-between gap-6">
            {/* Logo y marca */}
            <a
              href={hrefDe('reader')}
              className="flex flex-col items-baseline gap-1 no-underline hover:opacity-90 transition-opacity"
            >
              <div className="flex items-center gap-2">
                {/* Logo simbólico */}
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '8px' }}
                >
                  R
                </div>
                <div className="flex flex-col">
                  <span className="font-display text-lg font-bold tracking-tight text-white">
                    Rosimar
                  </span>
                  <span className="hidden text-xs text-blue-100 md:inline -mt-1">
                    Gestión de Talento
                  </span>
                </div>
              </div>
            </a>

            {/* Estado y configuración */}
            <div className="flex items-center gap-4 ml-auto">
              <div className="hidden sm:flex items-center gap-3">
                {/* Rol */}
                <select
                  value={sessionRole}
                  onChange={(e) => onRoleChange(e.target.value as UserRole)}
                  aria-label="Rol de usuario"
                  className="text-xs font-medium text-slate-900 bg-white border-0 rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>

                {/* Indicador de conexión */}
                <div className="flex items-center gap-1.5 text-xs font-medium text-blue-50">
                  <span 
                    className="w-2 h-2 rounded-full"
                    style={{ 
                      backgroundColor: isOnline ? '#10b981' : '#ef4444'
                    }}
                  />
                  {isOnline ? 'En línea' : 'Sin conexión'}
                </div>

                {/* Cola de sincronización */}
                {syncQueueCount > 0 && (
                  <div className="text-xs font-medium text-yellow-200 pl-2 border-l border-blue-300">
                    {syncQueueCount} pendiente{syncQueueCount !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================ NAVEGACIÓN */}
      <nav 
        aria-label="Secciones principales"
        className="border-b border-slate-200 bg-white"
      >
        <div className="mx-auto max-w-[1280px] px-6">
          <div className="flex gap-2 overflow-x-auto">
            {visibleSections.map((seccion) => {
              const activa = seccion.id === activeSection;

              return (
                <a
                  key={seccion.id}
                  href={hrefDe(seccion.id)}
                  aria-current={activa ? 'page' : undefined}
                  className={`
                    whitespace-nowrap border-b-2 px-3 py-4 text-sm font-medium no-underline 
                    transition-all duration-200 flex items-center gap-1.5
                    ${
                      activa
                        ? 'border-blue-600 text-slate-900'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                    }
                  `}
                >
                  {seccion.label}
                  {seccion.id === 'alerts' && alertCount > 0 && (
                    <span
                      className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-xs font-bold text-white"
                      aria-label={`${alertCount} alerta${alertCount !== 1 ? 's' : ''} pendiente${alertCount !== 1 ? 's' : ''}`}
                    >
                      {alertCount > 9 ? '9+' : alertCount}
                    </span>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      </nav>
    </header>
  );
};
