/**
 * Utilidades de texto compartidas por el segmentador y los extractores de campo.
 * Todo determinista: sin modelos, sin llamadas de red.
 */

/** Quita tildes, pasa a minusculas y colapsa espacios. Base de toda comparacion. */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Distancia de edicion de Levenshtein, acotada para no penalizar cadenas largas. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }

  return previous[b.length];
}

/** Similitud 0..1 entre dos cadenas ya normalizadas. */
export function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - levenshtein(a, b) / longest;
}

/**
 * Compara contra una lista de terminos tolerando ruido de OCR
 * ("EDUCACIOM", "EXPERIENOA LABORAL"). Devuelve el termino mas parecido.
 */
export function bestMatch(
  value: string,
  candidates: string[],
  minSimilarity = 0.82
): { term: string; score: number } | null {
  const normalized = normalize(value);
  let best: { term: string; score: number } | null = null;

  for (const candidate of candidates) {
    const score = similarity(normalized, normalize(candidate));
    if (score >= minSimilarity && (!best || score > best.score)) {
      best = { term: candidate, score };
    }
  }

  return best;
}

export interface LabeledPair {
  label: string;
  value: string;
}

/**
 * Separa los pares `Etiqueta: valor` que comparten un mismo renglon.
 *
 * Es lo que necesitan los formularios tipo DAFP o Minerva, donde el motor de
 * maquetacion junta correctamente "NOMBRES: ANA MARIA" y "APELLIDOS: PEREZ LOPEZ"
 * en una sola linea porque asi estan impresos.
 */
export function splitLabeledPairs(rawLine: string): LabeledPair[] {
  // Las viñetas y la numeracion iniciales impedirian reconocer la primera etiqueta.
  const line = stripBullets(rawLine);
  const pattern =
    /(?:^|\s{2,}|\s*\|\s*|\s*[•*]\s*)([A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ.\s/]{1,38}?)\s*:\s*/g;
  const marks: { label: string; start: number; valueStart: number }[] = [];

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line)) !== null) {
    // Evita partir URLs (https://) y horas (10:30)
    const after = line.slice(pattern.lastIndex);
    if (/^\/\//.test(after)) continue;
    marks.push({ label: match[1].trim(), start: match.index, valueStart: pattern.lastIndex });
  }

  if (marks.length === 0) return [];

  return marks.map((mark, index) => ({
    label: mark.label,
    value: line.slice(mark.valueStart, index + 1 < marks.length ? marks[index + 1].start : undefined).trim(),
  }));
}

/**
 * Busca el valor de una etiqueta dentro de un conjunto de renglones.
 *
 * Hace dos pasadas: primero exige igualdad exacta de la etiqueta y solo despues
 * acepta coincidencias parciales. Sin esa prioridad, "Direccion de residencia"
 * respondia a una busqueda de "ciudad" y devolvia la direccion de la calle.
 */
export function findLabeledValue(lines: string[], labels: string[]): string | null {
  const wanted = labels.map(normalize);
  const pairs = lines.flatMap((line) => splitLabeledPairs(line));

  for (const pair of pairs) {
    if (pair.value.length === 0) continue;
    if (wanted.includes(normalize(pair.label))) return pair.value;
  }

  for (const pair of pairs) {
    if (pair.value.length === 0) continue;
    const label = normalize(pair.label);
    if (wanted.some((w) => w.length >= 3 && (label.endsWith(` ${w}`) || label.startsWith(`${w} `)))) {
      return pair.value;
    }
  }

  return null;
}

/**
 * Como findLabeledValue, pero ademas acepta el formato de formularios y
 * escaneos donde la etiqueta ocupa un renglon completo y el valor cae en el
 * renglon siguiente: el OCR separa el par `Etiqueta: valor` en dos lineas
 * ("CARGO" y debajo "AUXILIAR DE ASEO").
 *
 * Solo se acepta el renglon siguiente cuando es corto y no parece otra
 * etiqueta, para no cruzar un rotulo con el valor de la seccion contigua.
 */
export function findLabeledValueOrNextLine(
  lines: string[],
  labels: string[],
  options?: { maxValueWords?: number }
): string | null {
  const directo = findLabeledValue(lines, labels);
  if (directo) return directo;

  const wanted = labels.map(normalize).filter((l) => l.length >= 3);
  const maxWords = options?.maxValueWords ?? 10;

  for (let i = 0; i < lines.length; i++) {
    const rotulo = stripBullets(lines[i]).replace(/[:.]$/, '').trim();
    if (wordCount(rotulo) > 6) continue;
    const norm = normalize(rotulo);
    // El renglon tiene que ser SOLO la etiqueta. Con `startsWith` a secas,
    // "NIT No. 901.167.955-4" pasaba por ser la etiqueta "nit" y el parser se
    // llevaba como valor el renglon siguiente, que es la etiqueta de la fila de
    // abajo. Es el desplazamiento de una fila que se veia en los contratos.
    const esEtiqueta = wanted.some((w) => norm === w);
    if (!esEtiqueta) continue;

    for (let j = i + 1; j < lines.length && j < i + 3; j++) {
      const valor = lines[j].trim();
      if (!valor || valor.length < 2 || valor.length > 90) continue;
      // Si la linea siguiente es otra etiqueta ("Etiqueta: valor"), no es el
      // valor y se corta la busqueda de esa etiqueta.
      if (splitLabeledPairs(valor).length > 0) continue;
      // Tampoco vale si el renglon siguiente es a su vez una etiqueta suelta
      // ("Domicilio del empleador", "TRABAJADOR:"): en una tabla de dos columnas
      // el renglon de al lado suele ser la etiqueta de la fila siguiente, no el
      // valor de esta.
      if (/[:;]\s*$/.test(valor)) continue;
      const valorNorm = normalize(valor);
      if (wanted.some((w) => valorNorm.includes(w))) continue;
      if (wordCount(valor) > maxWords) continue;
      return valor;
    }
  }

  return null;
}

/**
 * Fallback para OCR ruidoso de fotos (WhatsApp, escaneos moviles): la etiqueta
 * llega con caracteres alterados ("EMPLFADOR", "SALARIOI", "TRABRAJADOR") y el
 * emparejamiento exacto no la reconoce. Compara por similitud, primero los pares
 * `Etiqueta: valor` de una linea y luego los renglones-cabecera cortos cuyo
 * valor cae en el renglon siguiente.
 */
export function findLabeledValueFuzzy(
  lines: string[],
  labels: string[],
  options?: { minSimilarity?: number; maxValueWords?: number }
): string | null {
  const wanted = labels.map(normalize).filter((l) => l.length >= 3);
  if (wanted.length === 0) return null;
  const min = options?.minSimilarity ?? 0.78;
  const maxWords = options?.maxValueWords ?? 12;

  for (const line of lines) {
    for (const pair of splitLabeledPairs(line)) {
      const norm = normalize(pair.label);
      if (norm.length < 3) continue;
      if (bestMatch(norm, wanted, min)) return pair.value;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rotulo = stripBullets(lines[i]).replace(/[:.]$/, '').trim();
    if (wordCount(rotulo) > 4 || normalize(rotulo).length < 3) continue;
    if (!bestMatch(normalize(rotulo), wanted, min)) continue;

    for (let j = i + 1; j < lines.length && j < i + 3; j++) {
      const valor = lines[j].trim();
      if (!valor || valor.length < 2 || valor.length > 90) continue;
      if (splitLabeledPairs(valor).length > 0) continue;
      // Tampoco vale si el renglon siguiente es a su vez una etiqueta suelta
      // ("Domicilio del empleador", "TRABAJADOR:"): en una tabla de dos columnas
      // el renglon de al lado suele ser la etiqueta de la fila siguiente, no el
      // valor de esta.
      if (/[:;]\s*$/.test(valor)) continue;
      const valorNorm = normalize(valor);
      if (wanted.some((w) => valorNorm.includes(w))) continue;
      if (wordCount(valor) > maxWords) continue;
      return valor;
    }
  }

  return null;
}

/** Limpia viñetas, numeracion y puntuacion sobrante al inicio y al final. */
export function stripBullets(line: string): string {
  return line
    .replace(/^[\s•*•●▪\-–—+·>]+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .replace(/\s+$/, '')
    .trim();
}

/** Elimina los años entre parentesis o sueltos de un texto descriptivo. */
export function stripYears(value: string): string {
  return value
    .replace(/\((?:\s*(?:19|20)\d{2}\s*(?:[-–]\s*(?:19|20)\d{2}|\s*[-–]\s*(?:actual|presente))?\s*)\)/gi, '')
    .replace(/\b(?:19|20)\d{2}\b/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*[-–,]\s*$/, '')
    .trim();
}

/** Cuenta palabras reales (util para decidir si un renglon es un encabezado). */
export function wordCount(line: string): number {
  return line.split(/\s+/).filter((w) => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]/.test(w)).length;
}
