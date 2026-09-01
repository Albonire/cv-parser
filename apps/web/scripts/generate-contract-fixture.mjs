/**
 * Genera `test-pdfs/Contrato_01_2Columnas.pdf`, el contrato de prueba que
 * reproduce el formato tabular real de Rosimar: etiquetas en la columna
 * izquierda y valores en la derecha (mismo renglon), que antes del fix F1.3
 * escapaba al parser por exigir `Etiqueta: valor` en la misma linea.
 *
 * Uso: node scripts/generate-contract-fixture.mjs  (desde apps/web)
 */
import { jsPDF } from 'jspdf';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const output = join(here, '..', 'test-pdfs', 'Contrato_01_2Columnas.pdf');

const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });

function emitWords(doc, palabras, xInicio, y, gapG = 6) {
  // Emite una palabra por cambio de estado grafico (13 + epsilon): si todas van
  // en un mismo estado, jspdf las agrupa en UN item y pdf.js produce una sola
  // word gigante que taparia el canal entre columnas; asi cada palabra queda
  // separada y `detectGutter` encuentra las dos columnas de la tabla.
  let x = xInicio;
  for (let i = 0; i < palabras.length; i++) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13 + (i % 2) * 0.001);
    doc.text(palabras[i], x, y);
    x += doc.getTextWidth(palabras[i]) + gapG;
  }
}

// Titulo corto y alineado a la izquierda: no debe cruzar el canal vertical
// entre las dos columnas (x termina ~204, el canal empieza ~204) o
// `detectGutter` no encontraria columnas.
emitWords(doc, ['CONTRATO', 'DE', 'TRABAJO'], 40, 60);

const filas = [
  ['EMPRESA:', 'ROSIMAR S.A.S.'],
  ['NIT:', '900.123.456-7'],
  ['TRABAJADOR:', 'CARLOS ANDRES VEGA'],
  ['CEDULA:', '1050234987'],
  ['CARGO:', 'OPERADOR'],
  ['SALARIO:', '1.600.000'],
  ['FECHA DE INICIO:', '12/05/2024'],
  ['FECHA DE VENCIMIENTO:', '11/05/2025'],
  ['TERMINO:', '12 MESES'],
  ['PREAVISO:', '30 dias'],
];

doc.setFont('helvetica', 'normal');
let y = 84;
for (const [label, value] of filas) {
  doc.setFontSize(11 + (y % 2 === 0 ? 0 : 0.0001));
  doc.text(label, 40, y);
  doc.setFontSize(11 + ((y + 1) % 2 === 0 ? 0 : 0.0001));
  doc.text(value, 320, y);
  y += 14;
}

writeFileSync(output, Buffer.from(doc.output('arraybuffer')));
console.log('Generado:', output);