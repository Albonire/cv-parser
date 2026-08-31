import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Acción principal de la sección, si la hay. */
  action?: React.ReactNode;
}

/**
 * Zona hero de cada sección: titular editorial a la izquierda con una
 * descripción breve debajo.
 *
 * Es lo que le faltaba a la aplicación para tener jerarquía. Antes cada vista
 * empezaba con una tarjeta que mezclaba título, contador, buscador y filtros al
 * mismo peso visual, así que no había forma de saber dónde estabas de un
 * vistazo.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, action }) => (
  <div className="flex flex-col gap-6 border-b border-mist py-12 sm:flex-row sm:items-end sm:justify-between">
    <div className="max-w-2xl">
      <h1 className="font-display text-display font-medium tracking-[-0.01em] text-ink">
        {title}
      </h1>
      {description && <p className="mt-4 text-body text-steel">{description}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);
