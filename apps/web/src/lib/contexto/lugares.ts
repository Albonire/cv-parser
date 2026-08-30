/**
 * Gazetteer de lugares de Colombia (departamentos y municipios).
 *
 * Sustituye la lista fija de 40 ciudades que tenia el parser: sin esto, cualquier
 * municipio fuera de esa lista quedaba sin reconocer. Los datos son publicos
 * (division politico-administrativa DANE) y viajan con la aplicacion, asi que la
 * deteccion de ciudad funciona sin conexion y sin costo.
 */

export const DEPARTAMENTOS: string[] = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bolívar', 'Boyacá', 'Caldas',
  'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca',
  'Guainía', 'Guaviare', 'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño',
  'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda',
  'San Andrés y Providencia', 'Santander', 'Sucre', 'Tolima', 'Valle del Cauca',
  'Vaupés', 'Vichada', 'Bogotá D.C.',
];

export const MUNICIPIOS: string[] = [
  // Capitales y principales centros urbanos
  'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Cúcuta', 'Soledad',
  'Ibagué', 'Bucaramanga', 'Soacha', 'Santa Marta', 'Villavicencio', 'Bello',
  'Valledupar', 'Pereira', 'Montería', 'Pasto', 'Buenaventura', 'Manizales',
  'Neiva', 'Palmira', 'Riohacha', 'Sincelejo', 'Popayán', 'Itagüí', 'Floridablanca',
  'Envigado', 'Tuluá', 'Dosquebradas', 'Barrancabermeja', 'Tunja', 'Girardot',
  'Apartadó', 'Uribia', 'Florencia', 'Turbo', 'Maicao', 'Piedecuesta', 'Yopal',
  'Ipiales', 'Facatativá', 'Quibdó', 'Sogamoso', 'Duitama', 'Girón', 'Zipaquirá',
  'Chía', 'Arauca', 'Mosquera', 'Madrid', 'Funza', 'Fusagasugá', 'Cartago',
  'Magangué', 'Jamundí', 'Yumbo', 'Rionegro', 'Malambo', 'Ciénaga', 'Sabanalarga',
  'Lorica', 'Caucasia', 'Mocoa', 'San Andrés', 'Leticia', 'Inírida',
  'San José del Guaviare', 'Mitú', 'Puerto Carreño', 'Armenia', 'Sahagún',
  'Villa del Rosario', 'Los Patios', 'Ocaña', 'Pamplona', 'Tibú', 'Chinácota',
  'El Zulia', 'Sardinata', 'Ábrego', 'Villa Caro', 'Toledo', 'Salazar',
  'Puerto Santander', 'Cáchira', 'Convención', 'El Carmen', 'Ragonvalia',
  'Chitagá', 'Mutiscua', 'Silos', 'Cácota', 'Pamplonita', 'Bochalema', 'Durania',
  'Herrán', 'Labateca', 'Arboledas', 'Cucutilla', 'Gramalote', 'Lourdes',
  'Santiago', 'San Cayetano', 'Bucarasica', 'La Playa', 'Hacarí', 'San Calixto',
  'Teorama', 'El Tarra', 'La Esperanza', 'Cachirá',
  // Santander
  'San Gil', 'Socorro', 'Málaga', 'Vélez', 'Barbosa', 'Lebrija', 'Rionegro',
  'Sabana de Torres', 'Puerto Wilches', 'Cimitarra', 'Zapatoca', 'Charalá',
  'Curití', 'Piedecuesta', 'Los Santos', 'San Vicente de Chucurí', 'El Playón',
  // Antioquia
  'Sabaneta', 'La Estrella', 'Caldas', 'Copacabana', 'Girardota', 'Barbosa',
  'Marinilla', 'La Ceja', 'Guarne', 'Necoclí', 'Chigorodó', 'Carepa',
  // Cundinamarca y Boyacá
  'Cajicá', 'Sopó', 'Tocancipá', 'Gachancipá', 'La Calera', 'Tenjo', 'Cota',
  'Sibaté', 'Ubaté', 'Villeta', 'La Mesa', 'Anapoima', 'Chiquinquirá', 'Paipa',
  'Villa de Leyva', 'Moniquirá', 'Puerto Boyacá', 'Garagoa',
  // Valle, Cauca, Nariño, Eje Cafetero
  'Buga', 'Cartago', 'Sevilla', 'Zarzal', 'Candelaria', 'Florida', 'Pradera',
  'Santander de Quilichao', 'Puerto Tejada', 'Tumaco', 'Túquerres', 'La Unión',
  'Calarcá', 'Montenegro', 'Quimbaya', 'La Tebaida', 'Santa Rosa de Cabal',
  'La Virginia', 'Chinchiná', 'La Dorada', 'Villamaría', 'Riosucio',
  // Costa Caribe
  'Turbaco', 'Arjona', 'El Carmen de Bolívar', 'Baranoa', 'Puerto Colombia',
  'Galapa', 'Sabanagrande', 'Fundación', 'El Banco', 'Plato', 'Aracataca',
  'Corozal', 'Sampués', 'Tolú', 'Cereté', 'Montelíbano', 'Planeta Rica', 'Tierralta',
  'Aguachica', 'Codazzi', 'La Jagua de Ibirico', 'Bosconia', 'San Juan del Cesar',
  'Fonseca', 'Villanueva', 'Manaure', 'Albania', 'Barrancas',
  // Llanos, Huila, Tolima, Caquetá
  'Acacías', 'Granada', 'Puerto López', 'San Martín', 'Aguazul', 'Tauramena',
  'Villanueva', 'Pitalito', 'Garzón', 'La Plata', 'Campoalegre', 'Espinal',
  'Melgar', 'Honda', 'Chaparral', 'Líbano', 'Mariquita', 'Purificación',
  'San Vicente del Caguán', 'Puerto Asís', 'Orito', 'Valle del Guamuez',
];

const NORMALIZED_INDEX = new Map<string, string>();

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

for (const name of [...MUNICIPIOS, ...DEPARTAMENTOS]) {
  NORMALIZED_INDEX.set(normalizeKey(name), name);
}

/** Patron que reconoce cualquier municipio o departamento del gazetteer. */
export const LUGARES_PATTERN = new RegExp(
  `\\b(?:${[...new Set([...MUNICIPIOS, ...DEPARTAMENTOS])]
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[áéíóúÁÉÍÓÚñÑ]/g, '.'))
    .join('|')})\\b`,
  'i'
);

/** Indica si el texto contiene un lugar conocido de Colombia. */
export function containsKnownPlace(text: string): boolean {
  const normalized = normalizeKey(text);
  for (const key of NORMALIZED_INDEX.keys()) {
    if (key.length < 4) continue;
    const pattern = new RegExp(`(^|[^a-z])${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`);
    if (pattern.test(normalized)) return true;
  }
  return false;
}

/** Devuelve el nombre canonico del lugar encontrado, o null. */
export function findKnownPlace(text: string): string | null {
  const normalized = normalizeKey(text);
  let found: { name: string; index: number } | null = null;

  for (const [key, canonical] of NORMALIZED_INDEX) {
    if (key.length < 4) continue;
    const pattern = new RegExp(`(^|[^a-z])(${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})([^a-z]|$)`);
    const match = normalized.match(pattern);
    if (match && match.index !== undefined) {
      const index = match.index;
      if (!found || index < found.index || (index === found.index && canonical.length > found.name.length)) {
        found = { name: canonical, index };
      }
    }
  }

  return found ? found.name : null;
}
