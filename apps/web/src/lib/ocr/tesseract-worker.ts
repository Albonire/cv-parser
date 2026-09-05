import { createWorker, PSM, Worker } from 'tesseract.js';
import { GiroPagina, girarImagen, muestraGirada, preprocessImage } from './image-prep';
import { buildLayout, DocumentLayout, PageInput, Word } from './layout';
import { normalizarPalabraOcr } from './ocr-normalize';

/**
 * Motor de OCR en el navegador (WebAssembly).
 *
 * Dos decisiones importantes:
 *
 * 1. Se piden las cajas de cada palabra (`blocks`) y se pasan por el mismo motor
 *    de maquetacion que usan los PDF digitales. Antes se tomaba `data.text`, que
 *    es texto plano: para una foto o un escaneo a dos columnas eso significaba
 *    leer las dos columnas mezcladas renglon por renglon.
 *
 * 2. El modelo de idioma se sirve desde `/tessdata`, no desde un CDN. Asi el
 *    lector funciona sin conexion (RNF-3) y no depende de un tercero. Los
 *    archivos ya estaban en el repositorio pero no se referenciaban.
 */

/** Modelo de idioma servido por la propia aplicacion, no por un CDN. */
const LANG_PATH = '/tessdata';
/** Worker y nucleo WebAssembly, copiados a public/tesseract por scripts/copy-ocr-assets.mjs. */
const WORKER_PATH = '/tesseract/worker.min.js';
const CORE_PATH = '/tesseract';
const IDIOMAS = 'spa+eng';

let workerPromise: Promise<Worker> | null = null;

export async function getTesseractWorker(
  onProgress?: (progress: number, message: string) => void
): Promise<Worker> {
  if (!workerPromise) {
    if (onProgress) onProgress(10, 'Cargando motor de OCR (WebAssembly spa+eng)...');

    workerPromise = createWorker(IDIOMAS, undefined, {
      langPath: LANG_PATH,
      workerPath: WORKER_PATH,
      corePath: CORE_PATH,
      // Los archivos de `public/tessdata` estan sin comprimir.
      gzip: false,
    }).then(async (worker) => {
      await worker.setParameters({
        // Segmentacion automatica: detecta bloques y columnas en la propia imagen.
        tessedit_pageseg_mode: PSM.AUTO,
        // Conserva los espacios, necesarios para separar campos en un mismo renglon.
        preserve_interword_spaces: '1',
      });
      return worker;
    });
  }

  return workerPromise;
}

/** Libera el motor de OCR y su memoria WebAssembly. */
export async function terminateTesseractWorker(): Promise<void> {
  if (!workerPromise) return;
  const worker = await workerPromise;
  workerPromise = null;
  await worker.terminate();
}

export interface OcrExecutionResult {
  text: string;
  confidence: number;
  layout: DocumentLayout;
}

/**
 * Cuando la lectura en escala de grises es lo bastante buena como para no
 * gastar un segundo OCR con la imagen binarizada.
 *
 * La confianza de Tesseract NO sirve por si sola para decidirlo: cuando no
 * encuentra nada devuelve 0 caracteres con confianza 95, porque no hay nada de
 * lo que dudar. Medido sobre el banco de 40 escaneos, esa era la razon de que
 * el perfil duro se hundiera: en grises daba 43 caracteres con confianza 92 y
 * se aceptaban, cuando la binarizada de la misma pagina daba 2.197.
 *
 * La senal que si discrimina es la CANTIDAD de texto reconocido, acompanada de
 * una confianza alta.
 */
const CARACTERES_LECTURA_SOLIDA = 400;
const CONFIANZA_LECTURA_SOLIDA = 0.8;

interface Lectura {
  texto: string;
  confianza: number;
  cajas: unknown;
}

function lecturaSolida(texto: string, confianza: number): boolean {
  return texto.trim().length >= CARACTERES_LECTURA_SOLIDA && confianza >= CONFIANZA_LECTURA_SOLIDA;
}

/**
 * Compara dos lecturas de la misma pagina. Pesa la cantidad de texto por la
 * confianza, de modo que una lectura con mucho mas texto gana salvo que su
 * confianza sea bastante peor.
 */
function puntajeLectura(texto: string, confianza: number): number {
  return texto.trim().length * (0.5 + confianza / 2);
}

/**
 * Datos que los formularios piden: correo, telefono, cedula o NIT, fecha y
 * monto. Son los mismos para una hoja de vida y para un contrato, asi que
 * sirven de medida neutral de lo util que trae una lectura.
 */
const PATRONES_DATO: RegExp[] = [
  /[\w.+-]+@[\w.-]+\s*\.\s*\w{2,}/g,
  /\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
  /\b\d{1,3}(?:[.\s]\d{3}){2,}\b/g,
  /\b(?:C\.?C\.?|CC|CO)\s*\d{6,10}\b/gi,
  /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
  /\b\d{1,2}\s+(?:de\s+)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s*(?:de\s+)?\d{4}\b/gi,
  /\$\s*\d{1,3}(?:[.,]\d{3})+/g,
];

/**
 * Cuantos datos aprovechables trae la lectura.
 *
 * Hace falta porque el volumen de texto no mide lo que interesa: en una tabla
 * de dos columnas cada preparado de la imagen captura una columna distinta, y
 * la que trae los rotulos y los titulos tiene mas caracteres que la que trae la
 * columna de valores. Medido en CT_04: la lectura ganadora por volumen (656
 * caracteres de titulos) daba peor resultado que la perdedora (345 caracteres
 * con la cedula, el domicilio y el cargo).
 */
function datosUtiles(texto: string): number {
  const vistos = new Set<string>();
  for (const patron of PATRONES_DATO) {
    for (const encontrado of texto.matchAll(patron)) vistos.add(encontrado[0].replace(/\s+/g, ''));
  }
  return vistos.size;
}

/**
 * Cual de dos lecturas conviene. Manda la cantidad de datos aprovechables y el
 * volumen de texto solo desempata: una lectura que trae dos campos mas es mejor
 * aunque tenga la mitad de caracteres.
 */
function comparaLecturas(a: Lectura, b: Lectura): number {
  const datos = datosUtiles(b.texto) - datosUtiles(a.texto);
  if (datos !== 0) return datos;
  return puntajeLectura(b.texto, b.confianza / 100) - puntajeLectura(a.texto, a.confianza / 100);
}

interface CajaTesseract {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface PalabraTesseract {
  text: string;
  confidence: number;
  bbox: CajaTesseract;
}

/** Convierte las palabras de Tesseract al modelo comun de maquetacion. */
export function tesseractWordsToWords(palabras: PalabraTesseract[]): Word[] {
  return palabras
    .filter((p) => p.text.trim().length > 0)
    .map((p) => {
      const height = Math.max(1, p.bbox.y1 - p.bbox.y0);
      return {
        text: normalizarPalabraOcr(p.text.trim()),
        x: p.bbox.x0,
        y: p.bbox.y0,
        width: Math.max(1, p.bbox.x1 - p.bbox.x0),
        height,
        fontSize: height,
        confidence: Math.max(0, Math.min(1, p.confidence / 100)),
      };
    });
}

function extraerPalabras(blocks: unknown): PalabraTesseract[] {
  if (!Array.isArray(blocks)) return [];

  const palabras: PalabraTesseract[] = [];
  for (const block of blocks as { paragraphs?: { lines?: { words?: PalabraTesseract[] }[] }[] }[]) {
    for (const parrafo of block.paragraphs ?? []) {
      for (const linea of parrafo.lines ?? []) {
        for (const palabra of linea.words ?? []) palabras.push(palabra);
      }
    }
  }

  return palabras;
}

/**
 * Deteccion de la orientacion de la pagina.
 *
 * `image-prep` endereza mas o menos cinco grados, que cubre el papel torcido en
 * el cristal del escaner pero no la hoja metida al reves. Medido sobre el banco
 * de escaneos, una pagina girada 90 grados sacaba 12% de precision y una girada
 * 180 grados un 4%, contra el 70-95% de la misma maquetacion derecha: no es una
 * lectura peor, es una lectura perdida entera.
 *
 * La sonda es un OCR sobre una version reducida de la pagina. La senal que
 * discrimina es la CONFIANZA, no la cantidad de texto: girada, Tesseract sigue
 * emitiendo cientos de caracteres, pero baja de 92-95 a 38-51.
 *
 * Se sondea primero 0 y 180 grados, que comparten proporcion; si el derecho
 * gana con holgura no se prueban los otros dos. Asi la pagina normal, que es el
 * caso corriente, paga dos sondas pequenas y no cuatro.
 */
const ANCHO_SONDA = 800;
/** Confianza a partir de la cual la pagina derecha se da por buena sin mas sondas. */
const CONFIANZA_ORIENTACION_CLARA = 85;
/** Texto minimo para que la confianza de la sonda signifique algo. */
const CARACTERES_SONDA_UTIL = 60;
/**
 * Cuanto tiene que ganarle un giro al derecho para que se aplique. Girar una
 * pagina que estaba bien cuesta mucho mas que dejar sin girar una torcida, y
 * las paginas derechas son la inmensa mayoria.
 */
const MARGEN_ORIENTACION = 10;
/** Confianza minima para aceptar un giro de 90/180/270 grados. Evita falsos giros por ruido. */
const CONFIANZA_MINIMA_GIRO = 60;

interface Sonda {
  grados: GiroPagina;
  chars: number;
  conf: number;
  ancho: number;
  alto: number;
}

/**
 * Confianza util de una sonda: cuando Tesseract no encuentra texto devuelve una
 * confianza alta porque no tiene nada de lo que dudar, asi que sin texto
 * suficiente la sonda no vale nada.
 */
function valorSonda(s: Sonda): number {
  return s.chars < CARACTERES_SONDA_UTIL ? 0 : s.conf;
}

async function sondear(
  worker: Worker,
  fuente: File | Blob,
  grados: GiroPagina
): Promise<Sonda> {
  const muestra = await muestraGirada(fuente, grados, ANCHO_SONDA);
  const { data } = await worker.recognize(muestra, {}, { text: true });
  return {
    grados,
    chars: (data.text ?? '').trim().length,
    conf: data.confidence ?? 0,
    ancho: muestra.width,
    alto: muestra.height,
  };
}

/**
 * Giros que merece la pena probar segun la proporcion de la pagina.
 *
 * Una hoja carta escaneada derecha o al reves llega vertical; una escaneada de
 * lado llega apaisada. Podar por la proporcion quita la mitad de las sondas y,
 * sobre todo, evita el error caro: sin esta poda el sondeo llegaba a girar 90
 * grados paginas verticales que estaban perfectamente derechas.
 */
function girosPlausibles(ancho: number, alto: number): GiroPagina[] {
  return alto >= ancho ? [0, 180] : [0, 90, 270];
}

/** Grados que hay que girar la pagina para dejarla derecha. */
export async function detectarOrientacion(
  worker: Worker,
  fuente: File | Blob
): Promise<GiroPagina> {
  const derecho = await sondear(worker, fuente, 0);
  const candidatos = girosPlausibles(derecho.ancho, derecho.alto).filter((g) => g !== 0);

  // Pagina vertical que se lee bien: no hay nada que corregir.
  if (
    candidatos.length === 1 &&
    derecho.chars >= CARACTERES_SONDA_UTIL &&
    derecho.conf >= CONFIANZA_ORIENTACION_CLARA
  ) {
    return 0;
  }

  let mejor = derecho;
  for (const grados of candidatos) {
    const sonda = await sondear(worker, fuente, grados);
    if (valorSonda(sonda) > valorSonda(mejor)) mejor = sonda;
  }

  return valorSonda(mejor) >= valorSonda(derecho) + MARGEN_ORIENTACION && mejor.conf >= CONFIANZA_MINIMA_GIRO
    ? mejor.grados
    : 0;
}

/**
 * Renglones minimos para dar por hecho que una lectura cubre la pagina entera.
 * Medido sobre los dos bancos: cuando el preprocesado destruye una tabla, la
 * lectura en gris se queda en 3 a 9 renglones (CT_07 seis, CT_09 tres, CT_05
 * nueve) mientras que una lectura completa da de 19 a 43. El hueco entre las
 * dos poblaciones es lo bastante ancho para separarlas con un solo numero.
 */
const RENGLONES_PAGINA_COMPLETA = 15;

/** Renglones no vacios de una lectura. */
function renglonesUtiles(texto: string): number {
  return texto.split('\n').filter((l) => l.trim().length > 0).length;
}

/** Un renglon con forma de "Etiqueta: valor" o de rotulo suelto ("Cargo:"). */
const RENGLON_ETIQUETADO = /^[^:\n]{2,35}:(?:\s*$|\s+\S)/;

/**
 * Proporcion de renglones etiquetados a partir de la cual la pagina se trata
 * como tabla de datos. Medido: las hojas de vida se quedan en 0,03 y los
 * contratos completos van de 0,23 a 0,38.
 */
const PROPORCION_TABLA = 0.15;

/**
 * En una tabla de datos cada preparado de la imagen captura una columna
 * distinta, asi que compensa leer las dos aunque la primera parezca completa.
 * En una hoja de vida, que es prosa, no.
 */
function pareceTablaEtiquetada(texto: string): boolean {
  const renglones = texto.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  if (renglones.length === 0) return false;
  const etiquetados = renglones.filter((l) => RENGLON_ETIQUETADO.test(l)).length;
  return etiquetados / renglones.length >= PROPORCION_TABLA;
}

/**
 * Lee la pagina probando los preprocesados que le pueden servir.
 *
 * Las fotografias de camara (WhatsApp, celular) leen mejor en escala de grises;
 * la binarizacion local, pensada para escaneos planos, les borra el texto. Al
 * reves ocurre con un escaneo con sombra, donde el gris no da nada. Y una tabla
 * de dos columnas puede necesitar la fuente sin preprocesar.
 *
 * La escala de grises se lee siempre. Las demas variantes cuestan un OCR entero
 * cada una, asi que solo se leen cuando la forma del documento dice que pueden
 * cambiar el resultado.
 */
async function leerConVariantes(worker: Worker, fuente: File | Blob): Promise<Lectura> {
  const leer = async (src: File | Blob, psm?: PSM): Promise<Lectura> => {
    if (psm !== undefined) {
      await worker.setParameters({ tessedit_pageseg_mode: psm });
    }
    try {
      const res = await worker.recognize(src, {}, { blocks: true, text: true });
      return {
        texto: res.data.text ?? '',
        confianza: res.data.confidence ?? 0,
        cajas: res.data.blocks,
      };
    } finally {
      if (psm !== undefined) {
        await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
      }
    }
  };

  // Cuantas columnas detecta la maquetacion para esa lectura y si es solida.
  const evaluar = (l: Lectura): { lectura: Lectura; columnas: number; solida: boolean } => {
    const palabras = tesseractWordsToWords(extraerPalabras(l.cajas));
    const ancho = Math.max(1, ...palabras.map((w) => w.x + w.width));
    const alto = Math.max(1, ...palabras.map((w) => w.y + w.height));
    const layout = buildLayout([{ words: palabras, width: ancho, height: alto }]);
    return {
      lectura: l,
      columnas: Math.max(1, layout.columnsPerPage[0] ?? 1),
      solida: lecturaSolida(l.texto, l.confianza / 100),
    };
  };

  const preprocesar = async (binarizar: boolean, igualarLuz = true): Promise<Blob | null> => {
    try {
      return await preprocessImage(fuente, { binarizar, igualarLuz });
    } catch (error) {
      console.warn(`Preprocesamiento ${binarizar ? 'binarizado' : 'en escala de grises'} omitido:`, error);
      return null;
    }
  };

  const leerVariante = async (src: Blob | null, nombre: string, psm?: PSM) => {
    if (!src) return null;
    try {
      return evaluar(await leer(src, psm));
    } catch (error) {
      console.warn(`Lectura ${nombre} omitida:`, error);
      return null;
    }
  };

  const gris = await preprocesar(false);
  let conGris = await leerVariante(gris, 'en escala de grises');

  const esContratoOFormulario = (txt: string) =>
    /contrato|empleador|trabajad|termino\s+fijo|salario|prestaci[oó]n\s+(?:de\s+)?servicios/i.test(txt);
  const tieneSenalesTabularesOContrato = (txt: string) =>
    esContratoOFormulario(txt) || pareceTablaEtiquetada(txt) || /[|_[\]—]{2,}/.test(txt);

  /** La lectura cubre la pagina y no hay nada mas que buscar. */
  const cubreLaPagina = (c: typeof conGris) => {
    if (!c || !c.solida || renglonesUtiles(c.lectura.texto) < RENGLONES_PAGINA_COMPLETA) return false;
    // Si parece contrato o tabla pero no trae datos utiles basicos, no se considera completa:
    // PSM.AUTO puede haber leido solo la prosa legal del pie descartando la tabla.
    if (tieneSenalesTabularesOContrato(c.lectura.texto) && datosUtiles(c.lectura.texto) < 3) return false;
    return true;
  };

  // La igualacion de luz levanta mucho las fotos con vineta o sombra y estorba
  // en los escaneos muy degradados, donde emborrona el texto en vez de igualar
  // el papel. No hay forma barata de distinguirlos mirando la imagen: se probo
  // con la energia de borde y no separa los dos casos, asi que se lee tambien
  // sin igualar y gana la que mas texto reconoce.
  //
  // Se paga cuando la lectura igualada no cubre la pagina, y tambien cuando
  // tiene forma de tabla de datos: ahi cada preparado captura una columna
  // distinta y la que parece completa puede estar dejandose la mitad de los
  // campos. En una hoja de vida, que es prosa, no se paga.
  if (!cubreLaPagina(conGris) || (conGris && pareceTablaEtiquetada(conGris.lectura.texto))) {
    const conGrisPlano = await leerVariante(await preprocesar(false, false), 'en gris sin igualar');
    if (conGrisPlano && (!conGris || comparaLecturas(conGrisPlano.lectura, conGris.lectura) < 0)) {
      conGris = conGrisPlano;
    }
  }

  // Si no hay señales de tabla ni de contrato, y la lectura en gris cubre la pagina,
  // no hay nada mas que buscar y se evita el coste de OCR adicional.
  if (conGris && !tieneSenalesTabularesOContrato(conGris.lectura.texto) && cubreLaPagina(conGris)) {
    return conGris.lectura;
  }

  // Fuente original: lee completa una tabla alineada cuyas celdas tocan el
  // canal. La escala de grises la pierde porque Sauvola funde el fondo gris de
  // la etiqueta con su texto. A la inversa, en una tabla desfasada la escala de
  // grises REVELA la estructura de dos columnas que el parser aprovecha.
  let lecturaFuente: Lectura | null = null;
  try {
    lecturaFuente = await leer(fuente);
  } catch (error) {
    console.warn('Lectura de la fuente original omitida:', error);
  }
  const conFuente = lecturaFuente ? evaluar(lecturaFuente) : null;

  const candidatas: { lectura: Lectura; columnas: number; solida: boolean }[] = [];
  if (conGris) candidatas.push(conGris);
  if (conFuente) candidatas.push(conFuente);

  // Respaldo de bloque para fotos con tablas / cuadrícula (contratos de WhatsApp):
  // PSM.AUTO a menudo descarta celdas de una tabla creyendo que son gráficos.
  // Cuando un documento contiene señales tabulares o de contrato, se evalúa
  // PSM.SINGLE_BLOCK (6) y se compara con comparaLecturas para que las celdas
  // de la tabla no se descarten.
  const haySenalesTabulares = candidatas.some((c) => tieneSenalesTabularesOContrato(c.lectura.texto));
  if (haySenalesTabulares) {
    if (gris) {
      const conBloqueGris = await leerVariante(gris, 'en bloque gris', PSM.SINGLE_BLOCK);
      if (conBloqueGris) candidatas.push(conBloqueGris);
    }

    const conBloqueFuente = await leerVariante(fuente, 'en bloque fuente', PSM.SINGLE_BLOCK);
    if (conBloqueFuente) candidatas.push(conBloqueFuente);
  }

  // Si ninguna fue solida: respaldo binarizado (escaneo con sombra).
  if (!candidatas.some((c) => c.solida)) {
    const binarizada = await preprocesar(true);
    if (binarizada && binarizada !== gris) {
      try {
        const conBinarizada = evaluar(await leer(binarizada));
        candidatas.push(conBinarizada);
      } catch (error) {
        console.warn('Lectura binarizada omitida:', error);
      }
    }
  }

  if (candidatas.length === 0) return { texto: '', confianza: 0, cajas: [] };

  return [...candidatas].sort((a, b) => {
    const datos = datosUtiles(b.lectura.texto) - datosUtiles(a.lectura.texto);
    if (datos !== 0) return datos;
    if (a.columnas >= 2 && a.solida && (b.columnas < 2 || !b.solida)) return -1;
    if (b.columnas >= 2 && b.solida && (a.columnas < 2 || !a.solida)) return 1;
    return puntajeLectura(b.lectura.texto, b.lectura.confianza / 100) - puntajeLectura(a.lectura.texto, a.lectura.confianza / 100);
  })[0].lectura;
}

/** Proporciones de la imagen, sin pasar por OCR. */
async function esApaisada(fuente: File | Blob): Promise<boolean> {
  if (typeof createImageBitmap !== 'function') return false;
  try {
    const bitmap = await createImageBitmap(fuente);
    const apaisada = bitmap.width > bitmap.height;
    bitmap.close?.();
    return apaisada;
  } catch {
    return false;
  }
}

/** Reconoce un elemento de imagen corrigiendo antes su orientacion. */
async function reconocerElemento(
  worker: Worker,
  item: File | Blob | HTMLCanvasElement
): Promise<Lectura> {
  if (typeof HTMLCanvasElement !== 'undefined' && item instanceof HTMLCanvasElement) {
    const { data } = await worker.recognize(item, {}, { blocks: true, text: true });
    return { texto: data.text ?? '', confianza: data.confidence ?? 0, cajas: data.blocks };
  }

  if (typeof window === 'undefined' && !(item instanceof File || item instanceof Blob)) {
    const { data } = await worker.recognize(item as unknown as HTMLCanvasElement, {}, { blocks: true, text: true });
    return { texto: data.text ?? '', confianza: data.confidence ?? 0, cajas: data.blocks };
  }

  const fileItem = item as File | Blob;

  // Una pagina apaisada es sospechosa de venir escaneada de lado, asi que se
  // sondea ANTES de leerla: leerla de lado no cuesta menos y no sirve de nada.
  let apaisada = false;
  try {
    apaisada = await esApaisada(fileItem);
  } catch (error) {
    console.warn('No se pudo medir la pagina:', error);
  }

  if (apaisada) {
    try {
      const giro = await detectarOrientacion(worker, fileItem);
      if (giro !== 0) return leerConVariantes(worker, await girarImagen(fileItem, giro));
    } catch (error) {
      console.warn('Deteccion de orientacion omitida:', error);
    }
    return leerConVariantes(worker, fileItem);
  }

  // Pagina vertical: se lee primero y solo se sondea la orientacion si salio
  // mal. Es el caso corriente, y asi no paga ninguna sonda.
  const lectura = await leerConVariantes(worker, fileItem);
  if (lecturaSolida(lectura.texto, lectura.confianza / 100)) return lectura;

  try {
    const giro = await detectarOrientacion(worker, fileItem);
    if (giro !== 0) {
      const reintento = await leerConVariantes(worker, await girarImagen(fileItem, giro));
      if (
        puntajeLectura(reintento.texto, reintento.confianza / 100) >
        puntajeLectura(lectura.texto, lectura.confianza / 100)
      ) {
        return reintento;
      }
    }
  } catch (error) {
    console.warn('Deteccion de orientacion omitida:', error);
  }

  return lectura;
}

/** Ejecuta OCR sobre uno o varios archivos, blobs o canvas. */
export async function performOcr(
  input: File | Blob | HTMLCanvasElement | (File | Blob | HTMLCanvasElement)[],
  onProgress?: (progress: number, message: string) => void
): Promise<OcrExecutionResult> {
  const worker = await getTesseractWorker(onProgress);
  const items = Array.isArray(input) ? input : [input];

  const paginas: PageInput[] = [];
  const textosRespaldo: string[] = [];
  let sumaConfianza = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (onProgress) {
      const base = Math.round((i / items.length) * 60) + 20;
      onProgress(base, `Reconociendo texto en pagina ${i + 1} de ${items.length}...`);
    }

    const { texto, confianza, cajas } = await reconocerElemento(worker, item);

    const palabras = extraerPalabras(cajas);
    const words = tesseractWordsToWords(palabras);

    const ancho = Math.max(1, ...words.map((w) => w.x + w.width));
    const alto = Math.max(1, ...words.map((w) => w.y + w.height));

    paginas.push({ words, width: ancho, height: alto });
    textosRespaldo.push(texto);
    sumaConfianza += confianza;
  }

  const layout = buildLayout(paginas);
  const confianza = items.length > 0 ? sumaConfianza / items.length / 100 : 0;

  return {
    // Si Tesseract no devolvio cajas, se usa el texto plano como respaldo.
    text: layout.lines.length > 0 ? layout.text : textosRespaldo.join('\n\n'),
    confidence: confianza,
    layout,
  };
}
