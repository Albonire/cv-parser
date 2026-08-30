import { Word } from './layout';

/**
 * Convierte los fragmentos de texto de pdf.js en palabras con caja delimitadora
 * en coordenadas de pantalla. Se mantiene aparte de `pdf-reader.ts` (que depende
 * del navegador) para que las pruebas ejerciten exactamente la misma conversion
 * que usa la aplicacion.
 */
export interface PdfTextItemLike {
  str?: string;
  width?: number;
  height?: number;
  transform?: number[];
  fontName?: string;
}

const BOLD_FONT = /bold|black|heavy|semib|demi/i;

export function pdfItemsToWords(items: PdfTextItemLike[], viewportHeight: number): Word[] {
  const words: Word[] = [];

  for (const item of items) {
    const text = item.str ?? '';
    if (text.trim().length === 0) continue;

    const transform = item.transform ?? [1, 0, 0, 1, 0, 0];
    const scaleX = transform[0];
    const skewY = transform[1];
    const fontSize = Math.hypot(scaleX, skewY) || item.height || 10;
    const height = item.height && item.height > 0 ? item.height : fontSize;
    const ascent = height * 0.8;

    words.push({
      text,
      x: transform[4],
      // En PDF el eje Y crece hacia arriba y el origen del texto es la linea base.
      y: viewportHeight - transform[5] - ascent,
      width: item.width && item.width > 0 ? item.width : text.length * fontSize * 0.5,
      height,
      fontSize,
      isBold: typeof item.fontName === 'string' && BOLD_FONT.test(item.fontName),
      confidence: 1,
    });
  }

  return words;
}
