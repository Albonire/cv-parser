import React, { useEffect, useRef, useState } from 'react';
import { hrefDe, SectionId, SECTIONS } from '../lib/navigation/routes';
import { ROLE_LABELS, UserRole } from '../types/session';

/*
 * La fila de secciones es puramente tipográfica: el estado activo se indica con
 * peso, color y un filete inferior, sin fondo ni icono.
 *
 * Con once secciones ya no caben en la fila, y `overflow-x-auto` las escondía
 * sin ninguna señal de que hubiera más. Las tres de consulta ocasional
 * (Dashboard, Reportes, Configuración) pasan a un menú "Más", que además marca
 * su pestaña cuando la sección activa está dentro.
 */

interface NavbarProps {
  activeSection: SectionId;
  alertCount: number;
  isOnline: boolean;
  syncQueueCount?: number;
  sessionRole: UserRole;
  onLogout: () => void;
}

// Secciones visibles sólo para ciertos roles.
const ROLE_GATED: Partial<Record<SectionId, UserRole[]>> = {
  settings: ['admin'],
};

/** Secciones de consulta ocasional: viven en el menú "Más". */
const SECUNDARIAS: SectionId[] = ['dashboard', 'reports', 'liquidaciones', 'settings'];

export const Navbar: React.FC<NavbarProps> = ({
  activeSection,
  alertCount,
  isOnline,
  syncQueueCount = 0,
  sessionRole,
  onLogout,
}) => {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar el menú al pulsar fuera o con Escape.
  useEffect(() => {
    if (!menuAbierto) return;

    const fuera = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAbierto(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAbierto(false);
    };

    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', escape);
    };
  }, [menuAbierto]);

  const visibles = SECTIONS.filter((s) => {
    const gate = ROLE_GATED[s.id];
    return !gate || gate.includes(sessionRole);
  });

  const principales = visibles.filter((s) => !SECUNDARIAS.includes(s.id));
  const secundarias = visibles.filter((s) => SECUNDARIAS.includes(s.id));
  const activaEnMenu = secundarias.some((s) => s.id === activeSection);

  const clasePestana = (activa: boolean) =>
    `whitespace-nowrap border-b-2 px-3 py-4 text-sm font-medium no-underline transition-colors ${
      activa
        ? 'border-rosimar-blue text-ink'
        : 'border-transparent text-steel hover:border-fog hover:text-ink'
    }`;

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Cabecera corporativa. El degradado se toma de los tokens, no de
          valores escritos a mano; `.header-primary` no sirve aquí porque trae
          su propio relleno y estiliza el h1 de las cabeceras de página. */}
      <div
        className="border-b border-rosimar-navy/20 px-6 py-4"
        style={{
          background:
            'linear-gradient(135deg, var(--color-rosimar-navy) 0%, var(--color-rosimar-blue) 100%)',
        }}
      >
        <div className="mx-auto max-w-[1280px]">
          <div className="flex h-16 items-center justify-between gap-6">
            <a
              href={hrefDe('reader')}
              className="flex flex-col no-underline transition-opacity hover:opacity-90"
            >
              <span className="font-display text-xl font-bold tracking-tight text-paper">
                Rosimar
              </span>
              <span className="hidden text-caption text-paper/75 md:inline">
                Gestión de Talento
              </span>
            </a>

            <div className="ml-auto hidden items-center gap-4 sm:flex">
              <div className="flex items-center gap-3">
                <span className="text-caption font-semibold text-paper">
                  {ROLE_LABELS[sessionRole]}
                </span>
                <button
                  type="button"
                  onClick={onLogout}
                  className="cursor-pointer rounded-lg border border-paper/40 bg-transparent px-3 py-1.5 text-caption font-medium text-paper transition-colors hover:bg-paper/10 focus:outline-none"
                >
                  Cerrar sesión
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-caption font-medium text-paper">
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${isOnline ? 'bg-success' : 'bg-alert'}`}
                />
                {isOnline ? 'En línea' : 'Sin conexión'}
              </div>

              {syncQueueCount > 0 && (
                <div
                  className="border-l border-paper/30 pl-3 text-caption font-medium text-warning-surface"
                  title="Cambios guardados en este dispositivo que aun no se suben a la nube. Se sincronizaran cuando la conexion lo permita."
                >
                  {syncQueueCount} por sincronizar
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav aria-label="Secciones principales" className="border-b border-fog bg-paper">
        <div className="mx-auto flex max-w-[1280px] items-center px-6">
          {principales.map((seccion) => {
            const activa = seccion.id === activeSection;

            return (
              <a
                key={seccion.id}
                href={hrefDe(seccion.id)}
                aria-current={activa ? 'page' : undefined}
                className={`${clasePestana(activa)} inline-flex items-center gap-1.5`}
              >
                {seccion.label}
                {seccion.id === 'alerts' && alertCount > 0 && (
                  <span
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-alert text-caption font-bold text-paper"
                    aria-label={`${alertCount} alerta${alertCount !== 1 ? 's' : ''} pendiente${
                      alertCount !== 1 ? 's' : ''
                    }`}
                  >
                    {alertCount > 9 ? '9+' : alertCount}
                  </span>
                )}
              </a>
            );
          })}

          {secundarias.length > 0 && (
            <div className="relative ml-auto" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuAbierto((v) => !v)}
                aria-expanded={menuAbierto}
                aria-haspopup="menu"
                className={`${clasePestana(activaEnMenu)} bg-transparent`}
              >
                Más
                <span aria-hidden="true" className="ml-1.5 text-caption">
                  {menuAbierto ? '▴' : '▾'}
                </span>
              </button>

              {menuAbierto && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-10 min-w-[200px] border border-fog bg-paper py-1"
                  style={{ borderRadius: 'var(--radius-lg)' }}
                >
                  {secundarias.map((seccion) => (
                    <a
                      key={seccion.id}
                      role="menuitem"
                      href={hrefDe(seccion.id)}
                      aria-current={seccion.id === activeSection ? 'page' : undefined}
                      onClick={() => setMenuAbierto(false)}
                      className={`block px-4 py-2 text-sm no-underline transition-colors hover:bg-mist ${
                        seccion.id === activeSection ? 'font-semibold text-ink' : 'text-steel'
                      }`}
                    >
                      {seccion.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </nav>
    </header>
  );
};
