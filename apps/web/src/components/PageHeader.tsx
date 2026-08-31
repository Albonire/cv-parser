import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Acción principal de la sección, si la hay. */
  action?: React.ReactNode;
}

/**
 * Zona hero de cada sección: titular editorial alineado a la izquierda 
 * con descripción breve e indicador de acción.
 *
 * Estructura: titular display, descripción secundaria (opcional), acción derecha.
 * Es la zona de mayor jerarquía visual de cada sección: orienta al usuario dónde está
 * y cuál es el objetivo principal.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, action }) => (
  <div className="flex flex-col gap-8 border-b border-slate-200 py-8 sm:flex-row sm:items-end sm:justify-between">
    <div className="max-w-2xl flex-1">
      <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-tight">
        {title}
      </h1>
      {description && (
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          {description}
        </p>
      )}
    </div>
    {action && (
      <div className="shrink-0 flex items-center">
        {action}
      </div>
    )}
  </div>
);
