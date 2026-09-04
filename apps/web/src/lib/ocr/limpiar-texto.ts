/**
 * Limpieza y reorganizacion del texto extraido por OCR de fotos (WhatsApp).
 *
 * El OCR de Tesseract sobre fotos de celular no separa bien las palabras en
 * mayusculas (los formularios de contrato llegan como "AUXILIARDEBODEGA",
 * "LUGARFECHADEDE", "BARRANQUILLACALLE", "CEDULAIDENTIFICACIONESPUELICA") y
 * a veces mezcla una minuscula con una mayuscula ("deLaBodega"). Ese texto
 * enredado es ilegible en la ficha y ademas hace que los parsers del sistema
 * web (que buscan "AUXILIAR DE BODEGA" con espacio) no encuentren el dato.
 *
 * Este modulo segmenta las palabras fusionadas usando el vocabulario que ya
 * aparece separado en el mismo expediente (el corpus de Rosimar) mas los
 * diccionarios del sistema (cargos, lugares, habilidades). Es determinista,
 * sin modelos y sin red. Al separar "AUXILIARDEBODEGA" en "AUXILIAR DE BODEGA"
 * la ficha se vuelve legible y el web puede tomar el cargo.
 */

export interface Vocabulario {
  /** Palabras conocidas, normalizadas a MAYUSCULAS sin tildes. */
  palabras: Set<string>;
  /** Vocablo mas largo, para acotar la programacion dinamica. */
  maxLargo: number;
}

/**
 * Normaliza una palabra a la forma usada como llave del vocabulario:
 * MAYUSCULAS, sin tildes, sin caracteres no alfabeticos.
 */
export function llaveVocabulario(palabra: string): string {
  return palabra
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-ZÑ0-9]/g, '');
}

/** Vocabulario vacio (nunca segmenta). */
export function vocabularioVacio(): Vocabulario {
  return { palabras: new Set(), maxLargo: 0 };
}

/**
 * Construye un vocabulario a partir de un texto y de terminos semilla (los
 * diccionarios del sistema). Cada palabra de 3+ caracteres que aparece separada
 * se anade como palabra conocida; los terminos semilla se normalizan y dividen
 * por espacios.
 */
export function construirVocabulario(
  texto: string,
  semillas: string[] = []
): Vocabulario {
  const palabras = new Set<string>();
  const anadir = (p: string) => {
    const k = llaveVocabulario(p);
    // Acepta tambien articulos y preposiciones de 2 letras (DE, LA, EL, EN...)
    // porque son la clave para separar "AUXILIARDEBODEGA". Las de 1 letra no
    // aportan (casi nunca son una palabra real y meten ruido).
    if (k.length >= 2) palabras.add(k);
  };

  for (const palabra of (texto || '').split(/[^\p{L}\p{N}]+/u)) anadir(palabra);
  for (const semilla of semillas) for (const p of (semilla || '').split(/\s+/)) anadir(p);

  let maxLargo = 0;
  for (const p of palabras) if (p.length > maxLargo) maxLargo = p.length;

  return { palabras, maxLargo };
}

/** Une varios vocabularios conservando el maxLargo. */
export function fusionarVocabularios(...vocabularios: Vocabulario[]): Vocabulario {
  const palabras = new Set<string>();
  let maxLargo = 0;
  for (const v of vocabularios) {
    for (const p of v.palabras) palabras.add(p);
    if (v.maxLargo > maxLargo) maxLargo = v.maxLargo;
  }
  return { palabras, maxLargo };
}

/** Palabras concretas que no deben partirse (nombres propios, marcas). */
const INSEPARABLES = new Set([
  'ROSIMAR', 'BARRANQUILLA', 'COLOMBIA', 'DISTRIBUCIONES', 'COMBARRANQUILLA',
  'COOSALUD', 'GUETTE', 'ORTIZ', 'GONZALEZ', 'RODRIGUEZ', 'MARTINEZ', 'PEREZ',
]);

/**
 * Segmenta una palabra continua en palabras conocidas del vocabulario.
 * Devuelve la mejor segmentacion (la de mayor puntaje) o la original si no
 * encuentra una mejora clara. La aplica con caracteres en minuscula o en
 * mayuscula por igual: la separacion vale en cualquier caso.
 *
 * Algoritmo: programacion dinamica en la que cada posicion guarda la mejor
 * puntuacion al llegar hasta ahi y la pieza que la cierra. El puntaje premia
 * las palabras del vocabulario y la cobertura total, y penaliza dejar una pieza
 * sin reconocer.
 */
export function segmentarPalabraOriginal(palabraOrig: string, voc: Vocabulario): string {
  const palabra = palabraOrig.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (palabra.length < 6) return palabraOrig;
  // Las palabras inseparables se respetan tal cual.
  if (INSEPARABLES.has(palabra)) return palabraOrig;

  const n = palabra.length;
  const maxLen = Math.min(voc.maxLargo, n);
  // mejor[i] = { puntos, prev, piezaFusionada (bool) }
  const mejor: { p: number; prev: number | null; seg: string }[] = Array.from({ length: n + 1 }, () =>
    ({ p: -Infinity, prev: null, seg: '' })
  );
  mejor[0] = { p: 0, prev: null, seg: '' };

  for (let i = 1; i <= n; i++) {
    // 1) Cerrar con una pieza desconocida (poco premio, permite avanzar de a una letra).
    if (mejor[i - 1].p > -Infinity) {
      const cand = { p: mejor[i - 1].p - 4, prev: i - 1, seg: palabra[i - 1] };
      if (cand.p > mejor[i].p) mejor[i] = cand;
    }
    // 2) Cerrar con una palabra conocida.
    if (voc.palabras.size > 0) {
      for (let len = Math.min(maxLen, i); len >= 2; len--) {
        const pieza = palabra.slice(i - len, i);
        if (!voc.palabras.has(pieza)) continue;
        const base = mejor[i - len];
        if (base.p <= -Infinity) continue;
        const premio = pieza.length >= 5 ? 12 : 8;
        const cand = { p: base.p + premio, prev: i - len, seg: pieza };
        if (cand.p > mejor[i].p) mejor[i] = cand;
      }
    }
  }

  const fin = mejor[n];
  if (!Number.isFinite(fin.p)) return palabraOrig;
  // Exige que al menos haya ganado con palabras reales (no solo la pieza unica).
  if (fin.p <= 0) return palabraOrig;

  // Reconstruye la segmentacion desde el final.
  const partes: string[] = [];
  let i = n;
  while (i > 0 && mejor[i].prev !== null) {
    const seg = mejor[i].seg;
    if (!seg) break;
    partes.push(seg);
    i = mejor[i].prev as number;
  }
  partes.reverse();
  if (partes.length < 2) return palabraOrig;
  return partes.join(' ');
}

/**
 * Separa las mayusculas inyectadas en medio de una palabra en minusculas
 * ("deLaBodega" -> "de La Bodega"). Conservador: solo corta en la frontera
 * minuscula->mayuscula, que es lo que el OCR deja cuando junta dos palabras
 * impresas sin espacio.
 */
export function separarCamelCase(palabra: string): string {
  const parts = palabra.split(/([a-záéíóúüñ])([A-ZÁÉÍÓÚÑ])/);
  return parts.join('');
}

/**
 * Normaliza puntuacion y espacios para legibilidad: quita rayas y comillas
 * decorativas, colapsa espacios multiples y separa signos pegados a palabras.
 */
export function normalizarPuntuacion(texto: string): string {
  return texto
    .replace(/[—–]/g, ' - ')
    .replace(/[“”‘’]/g, '"')
    .replace(/\s*\|+\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/\s+\./g, '.')
    .trim();
}

export interface LimpiezaTexto {
  /** Texto completo con las separaciones aplicadas. */
  texto: string;
  /** Numero de palabras fusionadas que se separaron (para medir impacto). */
  separaciones: number;
}

/**
 * Limpia y reorganiza un texto completo de OCR de foto. Aplica las reglas de
 * separacion de palabras fusionadas, camelCase y normalizacion de puntuacion.
 * Las semillas son terminos de los diccionarios del sistema para reconocer
 * cargos, lugares y conceptos aunque no aparezcan separados en el corpus.
 */
export function limpiarTextoOCR(texto: string, semillas: string[] = []): LimpiezaTexto {
  if (!texto) return { texto: '', separaciones: 0 };

  const voc = construirVocabulario(texto, semillas);
  let textoLimpio = texto;
  let separaciones = 0;

  // Segmenta cada "token" (secuencia de letras/numeros) por separado, dejando
  // intactos los separadores (espacios, saltos, puntuacion).
  const tokens = texto.match(/[^\p{L}\p{N}]+|[\p{L}\p{N}]+/gu) ?? [];
  const salida: string[] = [];
  for (const token of tokens) {
    if (!/^\p{L}/u.test(token) || token.length < 7) {
      salida.push(token);
      continue;
    }
    const segmentado = segmentarPalabraOriginal(token, voc);
    if (segmentado !== token) {
      separaciones++;
      salida.push(segmentado);
    } else {
      const camel = separarCamelCase(token);
      if (camel !== token) {
        salida.push(camel);
      } else {
        salida.push(token);
      }
    }
  }
  textoLimpio = salida.join('');
  textoLimpio = normalizarPuntuacion(textoLimpio);

  return { texto: textoLimpio, separaciones };
}