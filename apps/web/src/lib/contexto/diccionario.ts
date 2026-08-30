/**
 * Diccionario configurable de cargos (F1 de docs/ARQUITECTURA.md 3.1).
 *
 * Agrupa cargos en familias y normaliza sinonimos, de modo que adaptar el
 * vocabulario de Rosimar S.A.S. no obligue a reescribir el parser. La carga
 * inicial esta orientada a servicios administrativos y operativos, que es el
 * perfil que contrata la empresa.
 */

export interface FamiliaCargo {
  /** Nombre canonico de la familia. */
  familia: string;
  /** Terminos que se normalizan a esa familia. El primero es el cargo canonico. */
  sinonimos: string[];
}

export const FAMILIAS_CARGOS: FamiliaCargo[] = [
  {
    familia: 'Servicios generales',
    sinonimos: [
      'servicios generales', 'aseo y limpieza', 'auxiliar de aseo', 'operario de aseo',
      'personal de aseo', 'aseadora', 'aseador', 'limpieza', 'toderos', 'todero',
    ],
  },
  {
    familia: 'Auxiliar administrativo',
    sinonimos: [
      'auxiliar administrativo', 'asistente administrativo', 'auxiliar de oficina',
      'secretaria', 'secretario', 'recepcionista', 'auxiliar de archivo',
      'gestor documental', 'auxiliar de gestion documental', 'asistente de gerencia',
    ],
  },
  {
    familia: 'Contable y financiero',
    sinonimos: [
      'auxiliar contable', 'contador', 'contadora', 'contador publico', 'analista contable',
      'auxiliar de nomina', 'analista de nomina', 'tesorero', 'auxiliar de tesoreria',
      'analista financiero', 'director financiero', 'directora administrativa y financiera',
      'coordinador de presupuestos', 'coordinadora de presupuestos', 'revisor fiscal',
    ],
  },
  {
    familia: 'Talento humano',
    sinonimos: [
      'talento humano', 'recursos humanos', 'gestion humana', 'coordinador de talento humano',
      'coordinadora de talento humano', 'analista de gestion humana', 'psicologo organizacional',
      'coordinador de seleccion', 'coordinadora de seleccion', 'reclutador', 'selector',
      'jefe de personal', 'auxiliar de talento humano',
    ],
  },
  {
    familia: 'Operario de produccion',
    sinonimos: [
      'operario', 'operario de produccion', 'operaria', 'auxiliar de produccion',
      'operador de maquina', 'operario de planta', 'ayudante de produccion',
      'empacador', 'auxiliar de empaque',
    ],
  },
  {
    familia: 'Mantenimiento',
    sinonimos: [
      'tecnico de mantenimiento', 'auxiliar de mantenimiento', 'operario tecnico de mantenimiento',
      'electricista', 'auxiliar electromecanico', 'tecnico electromecanico',
      'tecnico de refrigeracion', 'mecanico', 'soldador', 'tecnico industrial',
      'lider tecnico de automatizacion', 'tecnico de automatizacion',
    ],
  },
  {
    familia: 'Logistica y bodega',
    sinonimos: [
      'auxiliar de bodega', 'bodeguero', 'auxiliar logistico', 'coordinador logistico',
      'tecnico en gestion logistica', 'auxiliar de inventarios', 'almacenista',
      'auxiliar de despacho', 'operario logistico', 'montacarguista',
    ],
  },
  {
    familia: 'Conduccion y transporte',
    sinonimos: [
      'conductor', 'conductora', 'chofer', 'motorizado', 'mensajero', 'domiciliario',
      'conductor de camion', 'operador de vehiculo',
    ],
  },
  {
    familia: 'Seguridad y vigilancia',
    sinonimos: [
      'vigilante', 'guarda de seguridad', 'guardia de seguridad', 'escolta',
      'supervisor de seguridad', 'portero', 'celador',
    ],
  },
  {
    familia: 'Comercial y ventas',
    sinonimos: [
      'asesor comercial', 'asesora comercial', 'agente de ventas', 'vendedor', 'vendedora',
      'ejecutivo de cuenta', 'representante comercial', 'promotor', 'impulsador',
      'cajero', 'cajera', 'auxiliar de punto de venta', 'jefe de ventas',
    ],
  },
  {
    familia: 'Atencion al cliente',
    sinonimos: [
      'servicio al cliente', 'atencion al cliente', 'asesor de servicio al cliente',
      'agente de call center', 'teleoperador', 'auxiliar de atencion al usuario',
    ],
  },
  {
    familia: 'Salud y seguridad en el trabajo',
    sinonimos: [
      'auxiliar de enfermeria', 'enfermera', 'enfermero', 'coordinador sst',
      'analista sst', 'seguridad y salud en el trabajo', 'inspector de seguridad',
    ],
  },
  {
    familia: 'Direccion y coordinacion',
    sinonimos: [
      'gerente', 'director', 'directora', 'jefe', 'coordinador', 'coordinadora',
      'supervisor', 'supervisora', 'lider de equipo', 'administrador', 'administradora',
    ],
  },
  {
    familia: 'Tecnologia',
    sinonimos: [
      'desarrollador', 'desarrollador full stack', 'desarrollador senior full stack',
      'desarrollador frontend', 'desarrollador backend', 'ingeniero de sistemas',
      'analista de sistemas', 'soporte tecnico', 'administrador de bases de datos',
      'desarrollador de firmware', 'ingeniero de software',
    ],
  },
  {
    familia: 'Juridico',
    sinonimos: [
      'abogado', 'abogada', 'asesor juridico', 'asesora juridica', 'auxiliar juridico',
      'analista juridico', 'profesional juridico',
    ],
  },
  {
    familia: 'Diseño y comunicacion',
    sinonimos: [
      'diseñador grafico', 'diseñadora grafica', 'diseñador lead', 'diseñador visual',
      'community manager', 'productor audiovisual', 'publicista', 'comunicador social',
    ],
  },
];

const CLAVE_A_FAMILIA = new Map<string, string>();

function clave(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

for (const entrada of FAMILIAS_CARGOS) {
  for (const sinonimo of entrada.sinonimos) {
    CLAVE_A_FAMILIA.set(clave(sinonimo), entrada.familia);
  }
}

/** Todos los terminos de cargo conocidos, del mas largo al mas corto. */
export const TERMINOS_CARGO: string[] = [...CLAVE_A_FAMILIA.keys()].sort(
  (a, b) => b.length - a.length
);

/**
 * Normaliza un cargo a su familia. Devuelve null si el termino no esta en el
 * diccionario, para no inventar clasificaciones.
 */
export function familiaDeCargo(cargo: string): string | null {
  const normalizado = clave(cargo);
  if (CLAVE_A_FAMILIA.has(normalizado)) return CLAVE_A_FAMILIA.get(normalizado) ?? null;

  for (const termino of TERMINOS_CARGO) {
    if (termino.length < 5) continue;
    if (normalizado.includes(termino)) return CLAVE_A_FAMILIA.get(termino) ?? null;
  }

  return null;
}

/** Indica si un texto contiene algun cargo del diccionario. */
export function contieneCargo(texto: string): boolean {
  const normalizado = clave(texto);
  return TERMINOS_CARGO.some((t) => t.length >= 5 && normalizado.includes(t));
}
