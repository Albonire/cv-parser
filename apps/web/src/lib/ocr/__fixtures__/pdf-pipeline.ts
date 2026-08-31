import * as fs from 'fs';
import '../compat-upsert';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { buildLayout, DocumentLayout, PageInput } from '../layout';
import { pdfItemsToWords } from '../pdf-words';

/**
 * Carga un PDF digital desde disco y lo pasa por las MISMAS funciones que usa la
 * aplicacion en el navegador (`pdfItemsToWords` + `buildLayout`). Solo cambia el
 * origen de los bytes y el build de pdf.js (legacy para Node).
 *
 * Antes las pruebas concatenaban `items.map(i => i.str)` en el orden crudo del
 * PDF, que no es lo que ve el parser en produccion: por eso pasaban con la
 * aplicacion rota.
 */
export async function layoutFromPdfFile(pdfPath: string): Promise<DocumentLayout> {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const pages: PageInput[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    const content = await page.getTextContent();

    pages.push({
      words: pdfItemsToWords(content.items as never[], viewport.height),
      width: viewport.width,
      height: viewport.height,
    });
  }

  return buildLayout(pages);
}
