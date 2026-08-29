import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { layoutFromPdfFile } from './__fixtures__/pdf-pipeline';
import { parseCvText } from './parser-cv';
import groundTruth from './__fixtures__/ground-truth.json';

/**
 * Banco de precision del lector.
 *
 * Corre el pipeline real (pdf.js -> palabras -> maquetacion -> parser) sobre los
 * PDF de `test-pdfs/` y compara campo por campo contra la verdad de referencia.
 * Imprime una tabla y guarda `eval-report.json` para comparar entre cambios.
 */

interface FieldResult {
  field: string;
  ok: boolean;
  expected: unknown;
  actual: unknown;
}

const UMBRAL_GLOBAL = Number(process.env.CV_EVAL_THRESHOLD ?? 0.9);

function normalize(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('es');
}

function getList(parsed: Record<string, unknown>, key: string): unknown[] {
  const value = parsed[key];
  return Array.isArray(value) ? value : [];
}

function checkField(
  parsed: Record<string, unknown>,
  rawKey: string,
  expected: unknown
): FieldResult {
  // campo[].sub -> todos los valores esperados aparecen en esa propiedad de la lista
  const listPropMatch = rawKey.match(/^(\w+)\[\]\.(\w+)$/);
  if (listPropMatch) {
    const [, listKey, prop] = listPropMatch;
    const actual = getList(parsed, listKey).map((item) =>
      normalize((item as Record<string, unknown>)[prop])
    );
    const missing = (expected as string[]).filter(
      (want) => !actual.some((got) => got.includes(normalize(want)))
    );
    return { field: rawKey, ok: missing.length === 0, expected, actual };
  }

  // campo[] -> todos los valores esperados aparecen en la lista
  if (rawKey.endsWith('[]')) {
    const listKey = rawKey.slice(0, -2);
    const actual = getList(parsed, listKey).map((item) =>
      typeof item === 'string'
        ? normalize(item)
        : normalize(
            (item as Record<string, unknown>).language ??
              (item as Record<string, unknown>).skillName ??
              (item as Record<string, unknown>).name
          )
    );
    const missing = (expected as string[]).filter(
      (want) => !actual.some((got) => got.includes(normalize(want)))
    );
    return { field: rawKey, ok: missing.length === 0, expected, actual };
  }

  // campo# -> la lista tiene al menos N elementos
  if (rawKey.endsWith('#')) {
    const listKey = rawKey.slice(0, -1);
    const actual = getList(parsed, listKey).length;
    return { field: rawKey, ok: actual >= (expected as number), expected, actual };
  }

  // campo~ -> el valor esperado esta contenido en el extraido
  if (rawKey.endsWith('~')) {
    const key = rawKey.slice(0, -1);
    const actual = parsed[key];
    return {
      field: rawKey,
      ok: normalize(actual).includes(normalize(expected)),
      expected,
      actual,
    };
  }

  // igualdad exacta normalizada
  const actual = parsed[rawKey];
  return { field: rawKey, ok: normalize(actual) === normalize(expected), expected, actual };
}

describe('Precision del lector sobre el pipeline real de produccion', () => {
  const pdfDir = path.join(process.cwd(), 'test-pdfs');
  const report: Record<string, unknown>[] = [];

  for (const doc of groundTruth.documentos) {
    it(`${doc.archivo}: ${doc.nota}`, async () => {
      const layout = await layoutFromPdfFile(path.join(pdfDir, doc.archivo));
      const parsed = parseCvText(layout.text, layout) as unknown as Record<string, unknown>;

      const results: FieldResult[] = Object.entries(doc.campos).map(([key, expected]) =>
        checkField(parsed, key, expected)
      );

      const passed = results.filter((r) => r.ok).length;
      const score = passed / results.length;

      report.push({
        archivo: doc.archivo,
        columnas: layout.columnsPerPage,
        aciertos: passed,
        total: results.length,
        precision: Number(score.toFixed(3)),
        fallos: results.filter((r) => !r.ok),
      });

      const failed = results.filter((r) => !r.ok);
      const detail = failed
        .map(
          (f) =>
            `  - ${f.field}\n      esperado: ${JSON.stringify(f.expected)}\n      obtenido: ${JSON.stringify(f.actual)}`
        )
        .join('\n');

      expect(
        score,
        `${doc.archivo}: ${passed}/${results.length} campos correctos\n${detail}`
      ).toBeGreaterThanOrEqual(UMBRAL_GLOBAL);
    });
  }

  it('resumen global de precision', () => {
    const totalOk = report.reduce((n, r) => n + (r.aciertos as number), 0);
    const total = report.reduce((n, r) => n + (r.total as number), 0);
    const global = total > 0 ? totalOk / total : 0;

    const table = report
      .map(
        (r) =>
          `  ${String(r.archivo).padEnd(42)} ${String(r.aciertos).padStart(3)}/${String(
            r.total
          ).padEnd(3)}  ${((r.precision as number) * 100).toFixed(1).padStart(5)}%  columnas=${JSON.stringify(r.columnas)}`
      )
      .join('\n');

    console.log(
      `\nPrecision del lector por documento:\n${table}\n  ${'GLOBAL'.padEnd(42)} ${String(
        totalOk
      ).padStart(3)}/${String(total).padEnd(3)}  ${(global * 100).toFixed(1).padStart(5)}%\n`
    );

    fs.writeFileSync(
      path.join(process.cwd(), 'eval-report.json'),
      JSON.stringify({ generado: new Date().toISOString(), global, documentos: report }, null, 2)
    );

    expect(global).toBeGreaterThanOrEqual(UMBRAL_GLOBAL);
  });
});
