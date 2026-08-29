import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { buildLayout, DocumentLayout, PageInput } from './layout';
import { pdfItemsToWords } from './pdf-words';

// El worker se resuelve por el bundler con `?url`. Construirlo con
// `new URL('pdfjs-dist/...', import.meta.url)` no funciona: Vite no resuelve
// especificadores desnudos ahi y la ruta resultante daba 404 sin lanzar error,
// de modo que pdf.js caia en su worker falso y bloqueaba la interfaz.
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

/** Puntos por pulgada objetivo para el OCR. Tesseract rinde mejor cerca de 300. */
const OCR_DPI = 300;
const PDF_BASE_DPI = 72;
/** Tope de pixeles por pagina para no agotar la memoria del navegador. */
const MAX_PIXELES_PAGINA = 4_500_000;

export interface PdfExtractionResult {
  isDigitalText: boolean;
  pageCount: number;
  text: string;
  layout?: DocumentLayout;
  renderedPages?: Blob[];
}

/** Umbral de caracteres por pagina para considerar que el PDF trae capa de texto. */
const MIN_CARACTERES_POR_PAGINA = 60;

/**
 * Lee un PDF. Si trae capa de texto, extrae las palabras con sus coordenadas y
 * reconstruye el orden de lectura. Si es un escaneo, renderiza cada pagina a
 * Canvas para pasarla por OCR.
 */
export async function readPdfFile(
  file: File | ArrayBuffer,
  onProgress?: (progress: number, message: string) => void
): Promise<PdfExtractionResult> {
  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;

  let totalChars = 0;
  const pages: PageInput[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    if (onProgress) {
      onProgress(
        Math.round((pageNum / pageCount) * 50),
        `Analizando pagina ${pageNum} de ${pageCount}...`
      );
    }

    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();

    const words = pdfItemsToWords(textContent.items as never[], viewport.height);
    totalChars += words.reduce((n, w) => n + w.text.length, 0);

    pages.push({ words, width: viewport.width, height: viewport.height });
  }

  const promedioCaracteres = totalChars / Math.max(1, pageCount);

  if (promedioCaracteres >= MIN_CARACTERES_POR_PAGINA) {
    const layout = buildLayout(pages);
    return { isDigitalText: true, pageCount, text: layout.text, layout };
  }

  // Escaneo: se renderiza cada pagina para el OCR.
  const scannedPages: Blob[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    if (onProgress) {
      onProgress(
        50 + Math.round((pageNum / pageCount) * 40),
        `Renderizando pagina ${pageNum} para OCR...`
      );
    }

    const page = await pdf.getPage(pageNum);
    const base = page.getViewport({ scale: 1.0 });
    const escala = escalaParaOcr(base.width, base.height);
    const viewport = page.getViewport({ scale: escala });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    // Fondo blanco: los PDF con transparencia salen negros al pasarlos a PNG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvas, canvasContext: ctx, viewport } as Parameters<typeof page.render>[0])
      .promise;

    const pageBlob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), 'image/png')
    );
    if (pageBlob) scannedPages.push(pageBlob);
  }

  return { isDigitalText: false, pageCount, text: '', renderedPages: scannedPages };
}

/**
 * Escala de render para acercarse a 300 DPI sin superar el tope de pixeles.
 * La escala fija de 2.5 (~180 DPI) que habia antes dejaba a Tesseract por debajo
 * de su resolucion optima.
 */
function escalaParaOcr(width: number, height: number): number {
  const deseada = OCR_DPI / PDF_BASE_DPI;
  const pixeles = width * height * deseada * deseada;
  if (pixeles <= MAX_PIXELES_PAGINA) return deseada;
  return Math.max(1.5, Math.sqrt(MAX_PIXELES_PAGINA / (width * height)));
}
