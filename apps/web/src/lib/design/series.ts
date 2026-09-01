/**
 * Colores de las series de las gráficas, leídos de los tokens del sistema.
 *
 * Se leen en tiempo de ejecución en vez de repetirlos en el código para que
 * `index.css` siga siendo la única fuente de verdad de la paleta: si alguien
 * cambia la identidad, las gráficas cambian con ella.
 */

const TOKENS_SERIE = [
  '--color-chart-1',
  '--color-chart-2',
  '--color-chart-3',
  '--color-chart-4',
  '--color-chart-5',
] as const;

/** Respaldo para Node (pruebas) y para el primer render antes de tener estilos. */
const RESPALDO = ['#1a3a52', '#2563eb', '#475569', '#94a3b8', '#c19a5c'];

export function coloresDeSerie(): string[] {
  if (typeof window === 'undefined') return RESPALDO;

  const estilos = getComputedStyle(document.documentElement);
  return TOKENS_SERIE.map((token, i) => estilos.getPropertyValue(token).trim() || RESPALDO[i]);
}

/** Color de la serie principal, para las gráficas de una sola serie. */
export function colorPrincipal(): string {
  return coloresDeSerie()[1];
}
