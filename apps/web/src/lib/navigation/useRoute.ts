import { useCallback, useEffect, useState } from 'react';
import { hrefDe, leerRuta, Route, SectionId } from './routes';

/**
 * Mantiene la sección activa sincronizada con la URL.
 *
 * Al escuchar `hashchange` el botón "atrás" del navegador funciona de verdad:
 * recorre el historial de secciones en vez de abandonar la aplicación.
 */
export function useRoute(): {
  route: Route;
  navegarA: (id: SectionId, params?: Record<string, string | undefined>) => void;
} {
  const [route, setRoute] = useState<Route>(() => leerRuta(window.location.hash));

  useEffect(() => {
    const alCambiar = () => setRoute(leerRuta(window.location.hash));

    // Si se entra sin hash, se fija el de la sección por defecto para que la
    // primera navegación ya tenga una entrada previa en el historial.
    if (!window.location.hash) {
      window.history.replaceState(null, '', hrefDe(leerRuta('').section.id));
    }

    window.addEventListener('hashchange', alCambiar);
    return () => window.removeEventListener('hashchange', alCambiar);
  }, []);

  const navegarA = useCallback(
    (id: SectionId, params?: Record<string, string | undefined>) => {
      window.location.hash = hrefDe(id, params).slice(1);
    },
    []
  );

  return { route, navegarA };
}
