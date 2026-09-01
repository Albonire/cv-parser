/**
 * Navegación de la aplicación.
 *
 * Antes la sección activa vivía en un `useState`, sin URL. Eso significaba que
 * el botón "atrás" del navegador sacaba de la aplicación, recargar devolvía
 * siempre al lector, y no se podía enlazar ni compartir una sección concreta.
 *
 * Se usa enrutado por hash (`#/candidatos`) en lugar de rutas de servidor
 * porque la aplicación se publica como estático en Netlify o Cloudflare Pages:
 * el hash no exige reescrituras en el hosting y sobrevive a la recarga de la PWA.
 */

export type SectionId =
  | 'reader'
  | 'candidates'
  | 'employees'
  | 'expediente'
  | 'contracts'
  | 'vacancies'
  | 'memoranda'
  | 'liquidaciones'
  | 'alerts'
  | 'dashboard'
  | 'reports'
  | 'settings';

export interface SectionDefinition {
  id: SectionId;
  /** Segmento de URL, en español porque es visible para el usuario. */
  path: string;
  label: string;
  /** Título editorial de la sección, en la zona hero. */
  title: string;
  description: string;
}

export const SECTIONS: SectionDefinition[] = [
  {
    id: 'reader',
    path: 'lector',
    label: 'Lector',
    title: 'Lector de documentos',
    description:
      'Extrae los datos de hojas de vida, contratos, cédulas y afiliaciones desde foto, PDF o Word.',
  },
  {
    id: 'candidates',
    path: 'candidatos',
    label: 'Candidatos',
    title: 'Candidatos',
    description: 'Fichas extraídas y confirmadas, con filtros por cargo, ciudad y formación.',
  },
  {
    id: 'employees',
    path: 'empleados',
    label: 'Empleados',
    title: 'Empleados',
    description: 'Personal activo e inactivo, con fechas de ingreso, salida y razón de retiro.',
  },
  {
    id: 'expediente',
    path: 'expediente',
    label: 'Expediente',
    title: 'Expediente documental',
    description:
      'Historial de cada empleado en Rosimar: contratos, memorandos, llamados de atención, seguridad social, funciones y renuncias leídos por el sistema.',
  },
  {
    id: 'contracts',
    path: 'contratos',
    label: 'Contratos',
    title: 'Contratos laborales',
    description: 'Contratos vigentes e históricos, con sus prórrogas y estados.',
  },
  {
    id: 'vacancies',
    path: 'vacantes',
    label: 'Vacantes',
    title: 'Vacantes y matching',
    description: 'Vacantes abiertas con scoring ponderado contra el banco de candidatos.',
  },
  {
    id: 'memoranda',
    path: 'memorandos',
    label: 'Memorandos',
    title: 'Memorandos',
    description: 'Registro disciplinario. Al acumular tres, el contador exige revisión manual.',
  },
  {
    id: 'liquidaciones',
    path: 'liquidaciones',
    label: 'Liquidaciones',
    title: 'Liquidaciones',
    description: 'Liquidación final de contratos al retirarse: conceptos, fecha de retiro y total por empleado.',
  },
  {
    id: 'alerts',
    path: 'alertas',
    label: 'Alertas',
    title: 'Alertas',
    description: 'Vencimientos de contrato, periodos de prueba y acumulación de memorandos.',
  },
  {
    id: 'dashboard',
    path: 'dashboard',
    label: 'Dashboard',
    title: 'Dashboard',
    description: 'Estadísticas de reclutamiento y talento humano.',
  },
  {
    id: 'reports',
    path: 'reportes',
    label: 'Reportes',
    title: 'Reportes',
    description: 'Informes exportables a PDF y Excel.',
  },
  {
    id: 'settings',
    path: 'configuracion',
    label: 'Configuracion',
    title: 'Configuracion del empleador',
    description: 'Datos del empleador (Rosimar S.A.S.) y parametros de reglas de negocio.',
  },
];

const POR_RUTA = new Map(SECTIONS.map((s) => [s.path, s]));
const POR_ID = new Map(SECTIONS.map((s) => [s.id, s]));

export const SECCION_POR_DEFECTO = SECTIONS[0];

export interface Route {
  section: SectionDefinition;
  /** Parámetros de la URL, para enlaces profundos como `#/memorandos?empleado=emp-1`. */
  params: URLSearchParams;
}

/** Construye la URL de una sección, con parámetros opcionales. */
export function hrefDe(id: SectionId, params?: Record<string, string | undefined>): string {
  const seccion = POR_ID.get(id) ?? SECCION_POR_DEFECTO;
  const query = new URLSearchParams();

  for (const [clave, valor] of Object.entries(params ?? {})) {
    if (valor) query.set(clave, valor);
  }

  const cadena = query.toString();
  return `#/${seccion.path}${cadena ? `?${cadena}` : ''}`;
}

/** Interpreta el hash actual. Ante cualquier valor desconocido, cae en la sección por defecto. */
export function leerRuta(hash: string): Route {
  const limpio = hash.replace(/^#\/?/, '');
  const [ruta, consulta] = limpio.split('?');
  const seccion = POR_RUTA.get(ruta) ?? SECCION_POR_DEFECTO;

  return { section: seccion, params: new URLSearchParams(consulta ?? '') };
}
