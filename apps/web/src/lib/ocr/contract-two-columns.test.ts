import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { parseContractText } from './parser-contract';
import { layoutFromPdfFile } from './__fixtures__/pdf-pipeline';

/**
 * Prueba del formato tabular REAL de los contratos de Rosimar: una tabla de dos
 * columnas donde la etiqueta vive en la columna izquierda y el valor en la
 * columna derecha del mismo renglon.
 *
 * El fixture se genera con `scripts/generate-contract-fixture.mjs` y se lee por
 * el MISMO camino que la aplicacion (pdf.js -> pdfItemsToWords -> buildLayout),
 * como exige AGENTS.md. Antes del fix, el parser solo aceptaba
 * `Etiqueta: valor` en la misma linea y dejaba todos estos campos vacios.
 */
describe('Parser de Contrato: tabla de dos columnas', () => {
  const pdfDir = path.join(process.cwd(), 'test-pdfs');

  it('empareja etiqueta y valor por geometria aunque esten en columnas distintas', async () => {
    const layout = await layoutFromPdfFile(path.join(pdfDir, 'Contrato_01_2Columnas.pdf'));
    const parsed = parseContractText(layout.text, layout);

    // Los campos generales no dependen de la misma linea.
    expect(parsed.employerName).toBe('ROSIMAR S.A.S.');
    expect(parsed.employerNit?.replace(/\D/g, '')).toBe('9001234567');
    expect(parsed.workerName).toBe('CARLOS ANDRES VEGA');
    expect(parsed.workerDocumentNumber).toBe('1050234987');
    expect(parsed.position).toBe('OPERADOR');
    expect(parsed.salary).toBe(1600000);

    // Las fechas tampoco: etiqueta a la izquierda, valor a la derecha.
    expect(parsed.contractType).toBe('termino_fijo');
    expect(parsed.startDate).toBe('2024-05-12');
    expect(parsed.endDate).toBe('2025-05-11');
  });
});