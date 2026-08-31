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
    <header className="sticky top-0 z-50 border-b border-mist bg-paper">
      <div className="mx-auto max-w-[1280px] px-6">
        {/* Identidad y estado del dispositivo */}
        <div className="flex h-16 items-center justify-between gap-6">
          <a
            href={hrefDe('reader')}
            className="flex items-baseline gap-2 no-underline"
          >
            <span className="font-display text-[19px] font-semibold tracking-[-0.02em] text-ink">
              Rosimar S.A.S.
            </span>
            <span className="hidden text-micro text-steel md:inline">Talento humano</span>
          </a>

          <div className="flex items-center gap-4">
            <select
              value={sessionRole}
              onChange={(e) => onRoleChange(e.target.value as UserRole)}
              aria-label="Rol de usuario"
              className="text-micro text-steel bg-paper border border-fog rounded px-2 py-1 focus:outline-none"
            >
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <p className="text-micro text-steel">
              {isOnline ? 'En línea' : 'Sin conexión'}
              {syncQueueCount > 0 && ` · ${syncQueueCount} por sincronizar`}
            </p>
          </div>
        </div>

        {/* Navegación: enlaces reales, con URL propia y estado sólo tipográfico */}
        <nav aria-label="Secciones" className="-mb-px flex gap-5 overflow-x-auto">
          {visibleSections.map((seccion) => {
            const activa = seccion.id === activeSection;

            return (
              <a
                key={seccion.id}
                href={hrefDe(seccion.id)}
                aria-current={activa ? 'page' : undefined}
                className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 py-4 text-body no-underline transition-colors ${
                  activa
                    ? 'border-ink font-semibold tracking-[-0.02em] text-ink'
                    : 'border-transparent text-steel hover:text-ink'
                }`}
              >
                {seccion.label}
                {seccion.id === 'alerts' && alertCount > 0 && (
                  <span
                    className="ml-0.5 rounded-lg bg-alert px-1.5 text-micro font-semibold text-paper"
                    aria-label={`${alertCount} alertas pendientes`}
                  >
                    {alertCount}
                  </span>
                )}
              </a>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
