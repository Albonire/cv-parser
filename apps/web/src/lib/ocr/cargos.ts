import { ExperienceItem } from '../../types/candidate';
import { familiaDeCargo } from '../contexto/diccionario';

export interface DeteccionCargos {
  /** Cargo de la experiencia mas reciente, normalizado a su familia. */
  cargoPrincipal: string;
  /** Familia del cargo principal. */
  familiaPrincipal: string;
  /** Todos los cargos detectados, con su familia cuando el diccionario la conoce. */
  cargos: { cargo: string; familia: string | null }[];
}

/** Convierte "Enero 2020", "2020-01", "2020" o "Actual" en un valor ordenable. */
function scoreFecha(item: ExperienceItem): number {
  if (item.isCurrent) return Number.MAX_SAFE_INTEGER;
  const fuente = `${item.endDate ?? ''} ${item.startDate ?? ''}`;
  const anio = fuente.match(/\b(19|20)\d{2}\b/);
  return anio ? Number(anio[0]) : 0;
}

/**
 * Detecta los cargos a partir de la experiencia extraida y los contrasta con el
 * diccionario configurable (docs/ARQUITECTURA.md 3.1). Es la base del matching
 * candidato-vacante de fases posteriores.
 */
export function detectarCargos(experiencia: ExperienceItem[]): DeteccionCargos {
  const cargos = experiencia
    .map((item) => (item.position ?? '').trim())
    .filter((cargo) => cargo.length > 2)
    .map((cargo) => ({ cargo, familia: familiaDeCargo(cargo) }));

  const ordenada = [...experiencia]
    .filter((item) => (item.position ?? '').trim().length > 2)
    .sort((a, b) => scoreFecha(b) - scoreFecha(a));

  const principal = ordenada[0]?.position?.trim() ?? '';
  const familia = principal ? familiaDeCargo(principal) : null;

  return {
    cargoPrincipal: principal,
    familiaPrincipal: familia ?? principal,
    cargos,
  };
}
