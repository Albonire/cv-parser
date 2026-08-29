/** Reconocimiento de fechas y rangos de fecha en español e ingles. */

export const MESES =
  '(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic|january|february|march|april|june|july|august|september|october|november|december|jan|apr|aug|sept|dec)';

const PRESENTE = '(?:presente|actualidad|actual|hoy|present|current|now)';

/**
 * Un extremo de rango: "Marzo 2021", "03/2021", "2021", y tambien "03/15", que
 * es como quedan muchas fechas tras el OCR de formatos compactos.
 */
const EXTREMO = `(?:(?:${MESES}\\.?\\s+(?:de\\s+)?)?(?:\\d{1,2}\\s*[/-]\\s*)?(?:19|20)\\d{2}|\\d{1,2}\\s*[/-]\\s*\\d{2}(?!\\d))`;

/** Separadores validos entre los dos extremos de un rango. */
const SEPARADOR = '(?:\\s*[-–—]\\s*|\\s+a\\s+|\\s+al\\s+|\\s+hasta\\s+|\\s+to\\s+|\\s*[-–—]\\s*)';

export const RANGO_FECHAS = new RegExp(
  `(${EXTREMO})${SEPARADOR}(${EXTREMO}|${PRESENTE})`,
  'i'
);

export const ES_ACTUAL = new RegExp(PRESENTE, 'i');

export interface RangoDetectado {
  texto: string;
  inicio: string;
  fin?: string;
  esActual: boolean;
}

/** Detecta un rango de fechas dentro de un renglon. */
export function detectarRango(linea: string): RangoDetectado | null {
  const match = linea.match(RANGO_FECHAS);
  if (!match) return null;

  const esActual = ES_ACTUAL.test(match[2]);

  return {
    texto: match[0],
    inicio: normalizarExtremo(match[1]),
    fin: esActual ? 'Actual' : normalizarExtremo(match[2]),
    esActual,
  };
}

/** Devuelve el año del extremo, o el texto original si no se puede normalizar. */
function normalizarExtremo(valor: string): string {
  const anio = valor.match(/(?:19|20)\d{2}/);
  if (anio) return anio[0];

  // Formatos compactos "03/15" -> se conserva el año de dos digitos.
  const corto = valor.match(/\d{1,2}\s*[/-]\s*(\d{2})(?!\d)/);
  if (corto) return corto[1];

  return valor.trim();
}

/** Quita el rango de fechas de un renglon y limpia los separadores sobrantes. */
export function quitarRango(linea: string, rango: RangoDetectado): string {
  return linea
    .replace(rango.texto, ' ')
    .replace(/\s*[|•·]\s*/g, ' ')
    .replace(/^[\s,;:.\-–—]+|[\s,;:.\-–—]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Detecta una fecha suelta con etiqueta (nacimiento, expedicion). */
export const FECHA_SUELTA = new RegExp(
  `(\\d{1,2}\\s*[/-]\\s*\\d{1,2}\\s*[/-]\\s*\\d{2,4}|\\d{4}\\s*[/-]\\s*\\d{1,2}\\s*[/-]\\s*\\d{1,2}|\\d{1,2}\\s+de\\s+${MESES}\\s+de\\s+\\d{4}|${MESES}\\s+\\d{1,2},?\\s+\\d{4})`,
  'i'
);
