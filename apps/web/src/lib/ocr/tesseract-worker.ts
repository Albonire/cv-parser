import { createWorker, PSM, Worker } from 'tesseract.js';
import { preprocessImage } from './image-prep';
import { buildLayout, DocumentLayout, PageInput, Word } from './layout';

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
 * Un resultado de OCR se considera legible cuando tiene texto suficiente con
 * confianza razonable. Menguando el umbral segun la cantidad de texto.
 */
function esLegible(texto: string, confianza: number): boolean {
  const longitud = texto.trim().length;
  if (longitud < 40) return false;
  // Con mucho texto, hasta una confianza media es un buen indicio; con poco,
  // se exige mas seguridad antes de dar por buena la lectura.
  return confianza >= (longitud >= 300 ? 0.55 : 0.7);
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
        text: p.text,
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

/** Reconoce un elemento de imagen con el preprocesado que mejor lo lea. */
async function reconocerElemento(
  worker: Worker,
  item: File | Blob | HTMLCanvasElement
): Promise<{ texto: string; confianza: number; cajas: unknown }> {
  // En Node (pruebas) no hay Canvas: se manda el archivo tal cual.
  if (typeof window === 'undefined' || !(item instanceof File || item instanceof Blob)) {
    const { data } = await worker.recognize(item as HTMLCanvasElement, {}, { blocks: true, text: true });
    return { texto: data.text ?? '', confianza: data.confidence ?? 0, cajas: data.blocks };
  }

  // Fotografias de camara (WhatsApp, celular) leen mejor en escala de grises;
  // la binarizacion Sauvola, pensada para escaneos planos, les borra el texto.
  let gris: Blob | null = null;
  let binarizada: Blob | null = null;
  try {
    gris = await preprocessImage(item, { binarizar: false });
  } catch (error) {
    console.warn('Preprocesamiento en escala de grises omitido:', error);
  }
  try {
    binarizada = await preprocessImage(item, { binarizar: true });
  } catch (error) {
    console.warn('Preprocesamiento binarizado omitido:', error);
  }

  const primera = gris ?? binarizada ?? item;
  const resGris = await worker.recognize(primera, {}, { blocks: true, text: true });

  // La lectura en grises es legible: usar la primera y no gastar otro OCR.
  if (esLegible(resGris.data.text ?? '', (resGris.data.confidence ?? 0) / 100)) {
    return {
      texto: resGris.data.text ?? '',
      confianza: resGris.data.confidence ?? 0,
      cajas: resGris.data.blocks,
    };
  }

  // En grises no se leyo bien: probar la binarizada y quedarse con la mejor.
  if (binarizada && binarizada !== primera) {
    const resBin = await worker.recognize(binarizada, {}, { blocks: true, text: true });
    const confGris = esLegible(resGris.data.text ?? '', 0.4)
      ? (resGris.data.confidence ?? 0) / 100
      : 0;
    const binLegible = esLegible(resBin.data.text ?? '', (resBin.data.confidence ?? 0) / 100);
    const mejorBin = binLegible || (resBin.data.confidence ?? 0) > confGris * 100;
    if (mejorBin) {
      return {
        texto: resBin.data.text ?? '',
        confianza: resBin.data.confidence ?? 0,
        cajas: resBin.data.blocks,
      };
    }
  }

  return {
    texto: resGris.data.text ?? '',
    confianza: resGris.data.confidence ?? 0,
    cajas: resGris.data.blocks,
  };
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
