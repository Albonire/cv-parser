/**
 * Motor de analisis de maquetacion (layout) comun a todos los origenes:
 * PDF digital (pdf.js), PDF escaneado e imagenes (Tesseract) y Word (mammoth).
 *
 * Todas las etapas posteriores (segmentacion de secciones y extractores de campo)
 * trabajan sobre la salida de este modulo, de modo que el orden de lectura se
 * reconstruye una sola vez y de la misma forma para los cuatro caminos.
 */

/** Palabra con su caja delimitadora en coordenadas de pantalla (y crece hacia abajo). */
export interface Word {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  isBold?: boolean;
  /** Confianza del OCR entre 0 y 1. Los origenes digitales usan 1. */
  confidence?: number;
}

/** Renglon reconstruido, con las señales de formato que necesita el segmentador. */
export interface LayoutLine {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  isBold: boolean;
  isUpper: boolean;
  /** 0 = columna izquierda, 1 = columna derecha, -1 = renglon a todo el ancho. */
  column: number;
  page: number;
  confidence: number;
  /** El renglon esta en la franja superior de su pagina (zona de encabezado). */
  topOfPage: boolean;
  words: Word[];
}

export interface PageInput {
  words: Word[];
  width: number;
  height: number;
}

export interface DocumentLayout {
  lines: LayoutLine[];
  pageCount: number;
  /** Numero de columnas detectadas en cada pagina. */
  columnsPerPage: number[];
  /** Texto plano en orden de lectura. */
  text: string;
  /** Tamaño de fuente mediano del cuerpo, base para detectar encabezados. */
  medianFontSize: number;
  /** Confianza media de las palabras (1 en documentos digitales). */
  meanConfidence: number;
}

/** Ancho minimo del canal vertical vacio para aceptar dos columnas, como fraccion del ancho de pagina. */
const MIN_GUTTER_RATIO = 0.03;
/** Fraccion minima de palabras que debe tener la columna mas pequeña. */
const MIN_SIDE_WORD_SHARE = 0.15;
/** Numero minimo de renglones que debe tener la columna mas pequeña. */
const MIN_SIDE_ROWS = 4;
/** Fraccion minima de renglones que debe tener la columna mas pequeña. */
const MIN_SIDE_ROW_SHARE = 0.2;
/** Numero minimo de palabras en la pagina para siquiera evaluar columnas. */
const MIN_WORDS_FOR_COLUMNS = 14;

const BINS = 240;

interface Gutter {
  center: number;
  width: number;
}

/**
 * Busca un canal vertical vacio que separe dos columnas usando un perfil de
 * proyeccion sobre el eje X. A diferencia de partir la pagina por la mitad, esto
 * no parte formularios de una sola columna con etiqueta y valor en el mismo
 * renglon, ni manda los titulos cortos de la derecha a la columna izquierda.
 *
 * Si la primera pasada (con todas las palabras) no encuentra gutter porque un
 * titulo centrado tapa el canal, se repite excluyendo las palabras de la zona
 * superior de la pagina.
 */
export function detectGutter(words: Word[], pageWidth: number, pageHeight = 0): Gutter | null {
  if (words.length < MIN_WORDS_FOR_COLUMNS || pageWidth <= 0) return null;

  const fromAll = detectGutterFrom(words, pageWidth);
  if (fromAll) return fromAll;

  // Segunda pasada: excluir palabras de la zona superior (titulos centrados
  // que cruzan el canal vertical).
  if (pageHeight <= 0) return null;
  const maxY = pageHeight * TOP_BAND_RATIO;
  const tableWords = words.filter((w) => w.y + w.height > maxY);
  return detectGutterFrom(tableWords, pageWidth);
}

function detectGutterFrom(words: Word[], pageWidth: number): Gutter | null {
  if (words.length < MIN_WORDS_FOR_COLUMNS) return null;

  const binWidth = pageWidth / BINS;
  const covered = new Array<boolean>(BINS).fill(false);

  for (const word of words) {
    const from = Math.max(0, Math.floor(word.x / binWidth));
    const to = Math.min(BINS - 1, Math.floor((word.x + word.width) / binWidth));
    for (let i = from; i <= to; i++) covered[i] = true;
  }

  const contentStart = covered.indexOf(true);
  const contentEnd = covered.lastIndexOf(true);
  if (contentStart < 0 || contentEnd <= contentStart) return null;

  const minGutterBins = Math.max(2, Math.ceil((MIN_GUTTER_RATIO * pageWidth) / binWidth));
  let best: Gutter | null = null;

  let i = contentStart;
  while (i <= contentEnd) {
    if (covered[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j <= contentEnd && !covered[j]) j++;
    const runBins = j - i;

    if (runBins >= minGutterBins) {
      const center = ((i + j) / 2) * binWidth;
      const candidate: Gutter = { center, width: runBins * binWidth };
      if (isValidColumnSplit(words, center) && (!best || candidate.width > best.width)) {
        best = candidate;
      }
    }
    i = j;
  }

  return best;
}

function isValidColumnSplit(words: Word[], center: number): boolean {
  const left = words.filter((w) => w.x + w.width <= center);
  const right = words.filter((w) => w.x >= center);

  const smallerWords = Math.min(left.length, right.length);
  if (smallerWords / words.length < MIN_SIDE_WORD_SHARE) return false;

  // Una columna de fechas alineada a la derecha tambien deja un canal vacio, pero
  // aporta muy pocos renglones. Exigir renglones a ambos lados la descarta.
  const leftRows = groupWordsIntoRows(left).length;
  const rightRows = groupWordsIntoRows(right).length;
  const smallerRows = Math.min(leftRows, rightRows);
  if (smallerRows < MIN_SIDE_ROWS) return false;
  if (smallerRows / (leftRows + rightRows) < MIN_SIDE_ROW_SHARE) return false;

  return true;
}

/** Agrupa palabras en renglones por solapamiento vertical real de sus cajas. */
export function groupWordsIntoRows(words: Word[]): Word[][] {
  if (words.length === 0) return [];

  const sorted = [...words].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: Word[][] = [];

  let current: Word[] = [sorted[0]];
  let top = sorted[0].y;
  let bottom = sorted[0].y + sorted[0].height;
  const refHeight = sorted[0].height;

  for (let i = 1; i < sorted.length; i++) {
    const word = sorted[i];
    const wordTop = word.y;
    const wordBottom = word.y + word.height;
    const overlap = Math.min(bottom, wordBottom) - Math.max(top, wordTop);

    if (overlap > refHeight * 0.4) {
      current.push(word);
      top = Math.min(top, wordTop);
      bottom = Math.max(bottom, wordBottom);
    } else {
      rows.push(current);
      current = [word];
      top = wordTop;
      bottom = wordBottom;
    }
  }
  rows.push(current);

  return rows;
}

/**
 * Une las palabras de un renglon respetando el tamaño de los espacios: pdf.js
 * suele partir una misma palabra en varios fragmentos, y unirlos siempre con un
 * espacio rompe correos, URLs y numeros de documento.
 */
export function joinRowWords(words: Word[]): string {
  const sorted = [...words].sort((a, b) => a.x - b.x);
  let text = sorted[0].text;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gap = curr.x - (prev.x + prev.width);
    const reference = Math.max(1, curr.fontSize || curr.height || 10);

    if (gap > reference * 1.6) text += '   ';
    else if (gap > reference * 0.16) text += ' ';
    else if (/\s$/.test(text) || /^\s/.test(curr.text)) text += '';
    else text += '';

    text += curr.text;
  }

  return text.replace(/\s+$/g, '');
}

/** Fraccion superior de la pagina que se considera zona de encabezado. */
const TOP_BAND_RATIO = 0.28;

function toLine(words: Word[], column: number, page: number, pageHeight = 0): LayoutLine {
  const text = joinRowWords(words).trim();
  const x = Math.min(...words.map((w) => w.x));
  const right = Math.max(...words.map((w) => w.x + w.width));
  const y = Math.min(...words.map((w) => w.y));
  const bottom = Math.max(...words.map((w) => w.y + w.height));
  const fontSize = median(words.map((w) => w.fontSize || w.height));
  const boldChars = words.filter((w) => w.isBold).reduce((n, w) => n + w.text.length, 0);
  const totalChars = words.reduce((n, w) => n + w.text.length, 0) || 1;
  const letters = text.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');

  return {
    text,
    x,
    y,
    width: right - x,
    height: bottom - y,
    fontSize,
    isBold: boldChars / totalChars > 0.6,
    isUpper: letters.length >= 3 && letters === letters.toUpperCase(),
    column,
    page,
    confidence: Math.min(...words.map((w) => (w.confidence === undefined ? 1 : w.confidence))),
    topOfPage: pageHeight > 0 ? y <= pageHeight * TOP_BAND_RATIO : false,
    words,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Ordena los renglones de una pagina en orden de lectura humano. */
function layoutPage(page: PageInput, pageIndex: number): { lines: LayoutLine[]; columns: number } {
  const words = page.words.filter((w) => w.text.trim().length > 0);
  if (words.length === 0) return { lines: [], columns: 1 };

  const gutter = detectGutter(words, page.width, page.height);

  if (!gutter) {
    const rows = groupWordsIntoRows(words);
    return {
      lines: rows
        .map((row) => toLine(row, 0, pageIndex, page.height))
        .filter((l) => l.text.length > 0),
      columns: 1,
    };
  }

  const tolerance = gutter.width * 0.25;
  const left: Word[] = [];
  const right: Word[] = [];
  const spanning: Word[] = [];

  for (const word of words) {
    if (word.x + word.width <= gutter.center + tolerance) left.push(word);
    else if (word.x >= gutter.center - tolerance) right.push(word);
    else spanning.push(word);
  }

  const spanningLines = groupWordsIntoRows(spanning)
    .map((row) => toLine(row, -1, pageIndex, page.height))
    .filter((l) => l.text.length > 0);
  const leftLines = groupWordsIntoRows(left)
    .map((row) => toLine(row, 0, pageIndex, page.height))
    .filter((l) => l.text.length > 0);
  const rightLines = groupWordsIntoRows(right)
    .map((row) => toLine(row, 1, pageIndex, page.height))
    .filter((l) => l.text.length > 0);

  // Los renglones a todo el ancho (titulos, encabezados) parten la pagina en
  // bandas; dentro de cada banda se lee primero la columna izquierda completa.
  const boundaries = spanningLines.map((l) => l.y).sort((a, b) => a - b);
  const ordered: LayoutLine[] = [];
  let previousBoundary = -Infinity;

  for (let i = 0; i <= boundaries.length; i++) {
    const upper = i < boundaries.length ? boundaries[i] : Infinity;
    const inBand = (l: LayoutLine) => l.y > previousBoundary && l.y < upper;

    ordered.push(...leftLines.filter(inBand).sort((a, b) => a.y - b.y));
    ordered.push(...rightLines.filter(inBand).sort((a, b) => a.y - b.y));

    if (i < boundaries.length) {
      ordered.push(...spanningLines.filter((l) => l.y === upper));
      previousBoundary = upper;
    }
  }

  return { lines: ordered, columns: 2 };
}

/** Construye la maquetacion completa del documento a partir de las palabras de cada pagina. */
export function buildLayout(pages: PageInput[]): DocumentLayout {
  const lines: LayoutLine[] = [];
  const columnsPerPage: number[] = [];

  pages.forEach((page, index) => {
    const result = layoutPage(page, index);
    lines.push(...result.lines);
    columnsPerPage.push(result.columns);
  });

  const allWords = pages.flatMap((p) => p.words);
  const confidences = allWords.map((w) => (w.confidence === undefined ? 1 : w.confidence));

  return {
    lines,
    pageCount: pages.length,
    columnsPerPage,
    text: lines.map((l) => l.text).join('\n'),
    medianFontSize: median(lines.map((l) => l.fontSize)),
    meanConfidence:
      confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 1,
  };
}

/** Construye una maquetacion a partir de texto plano (Word/.docx o respaldo). */
export function layoutFromPlainText(text: string): DocumentLayout {
  const rawLines = text.split('\n');
  const lines: LayoutLine[] = [];
  let y = 0;

  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      y += 12;
      continue;
    }
    const letters = trimmed.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');
    lines.push({
      text: trimmed,
      x: 0,
      y,
      width: trimmed.length * 5,
      height: 12,
      fontSize: 12,
      isBold: false,
      isUpper: letters.length >= 3 && letters === letters.toUpperCase(),
      column: 0,
      page: 0,
      confidence: 1,
      topOfPage: lines.length < 12,
      words: [],
    });
    y += 12;
  }

  return {
    lines,
    pageCount: 1,
    columnsPerPage: [1],
    text: lines.map((l) => l.text).join('\n'),
    medianFontSize: 12,
    meanConfidence: 1,
  };
}
