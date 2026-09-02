/**
 * Experimento: probar variantes de OCR sobre un contrato alineado para ver por
 * que Tesseract solo lee 8 lineas. NO forma parte de la aplicacion.
 *
 * Prueba combinaciones de PSM y preprocesado y reporta cuantos caracteres y
 * cuantas "palabras tipo tabla" reconoce cada variante.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cargarPlaywright, rutaChromium } from './navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const PUERTO = 5198;

const ARCHIVO = process.argv[2] || 'CT_05_contrato-alineado_limpio.pdf';

function esperar(ms) { return new Promise((res) => setTimeout(res, ms)); }

async function arrancarVite() {
  const proceso = spawn(
    process.execPath,
    [path.join(RAIZ, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PUERTO), '--strictPort'],
    { cwd: RAIZ, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  proceso.stderr.on('data', (d) => process.stderr.write(`[vite] ${d}`));
  const limite = Date.now() + 60_000;
  while (Date.now() < limite) {
    try { const r = await fetch(`http://localhost:${PUERTO}/bench-ocr.html`); if (r.ok) return proceso; } catch {}
    await esperar(400);
  }
  proceso.kill('SIGTERM');
  throw new Error('Vite no respondio en 60 s.');
}

async function main() {
  const vite = await arrancarVite();
  const { chromium } = await cargarPlaywright(RAIZ);
  const navegador = await chromium.launch({ executablePath: rutaChromium() });

  try {
    const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await contexto.newPage();
    page.on('pageerror', (e) => console.error('[pagina]', e.message));

    await page.goto(`http://localhost:${PUERTO}/bench-ocr.html`, { waitUntil: 'load' });
    await page.waitForSelector('body[data-banco-listo="1"]', { timeout: 120_000 });

    console.log(`Experimentando con: ${ARCHIVO}`);

    const resultado = await page.evaluate(
      async (archivo) => {
        const res = await fetch(`/test-scans/${archivo}`);
        const blob = await res.blob();
        const file = new File([blob], archivo, { type: 'application/pdf' });

        const pdfMod = await import('../src/lib/ocr/pdf-reader');
        const ocrMod = await import('../src/lib/ocr/tesseract-worker');
        const imgMod = await import('../src/lib/ocr/image-prep');

        const pdfResult = await pdfMod.readPdfFile(file);
        const info = {
          isDigitalText: pdfResult.isDigitalText,
          pageCount: pdfResult.pageCount,
          renderedPages: pdfResult.renderedPages?.length ?? 0,
        };

        if (!pdfResult.renderedPages?.length) {
          return { info, error: 'Sin paginas renderizadas' };
        }

        const pagina = pdfResult.renderedPages[0];
        const worker = await ocrMod.getTesseractWorker();

        // Conjunto de variantes a probar
        const psmModes = ['AUTO', 'AUTO_OSD', 'SPARSE_TEXT', 'SINGLE_BLOCK'];
        const preprocesados = ['sin-preproceso', 'gris', 'binarizada'];

        const variantes = [];
        for (const psm of psmModes) {
          for (const prep of preprocesados) {
            let fuente = pagina;
            if (prep === 'gris') fuente = await imgMod.preprocessImage(pagina, { binarizar: false });
            if (prep === 'binarizada') fuente = await imgMod.preprocessImage(pagina, { binarizar: true });

            const psmNomina = { AUTO: 3, AUTO_OSD: 13, SPARSE_TEXT: 11, SINGLE_BLOCK: 6 }[psm];
            const params = { tessedit_pageseg_mode: psmNomina, preserve_interword_spaces: '1' };
            const res = await worker.recognize(fuente, {}, { text: true, blocks: true, parameters: params });

            const words = [];
            for (const block of res.data.blocks ?? []) {
              for (const p of block.paragraphs ?? []) {
                for (const line of p.lines ?? []) {
                  for (const w of line.words ?? []) {
                    if (w.text && w.text.trim()) words.push(w.text.trim());
                  }
                }
              }
            }

            const muestra = res.data.text.trim().split('\n').filter((l) => l.trim()).slice(0, 12).join(' | ');
            variantes.push({
              psm, prep,
              chars: (res.data.text ?? '').trim().length,
              words: words.length,
              confidence: res.data.confidence ?? 0,
              primeras: muestra,
            });
          }
        }

        // Tambien probar escalado: render de la pagina a mas resolucion
        const renderVariantes = await (async () => {
          const out = [];
          for (const escala of [2, 3]) {
            const { pages } = pdfMod;
            // re-render a otra escala via pdf-reader no es parametrizable;
            // usamos preprocessImage(upscale) como proxy
            const grande = await imgMod.preprocessImage(pagina, { binarizar: false });
            const res2 = await worker.recognize(grande, {}, { text: true });
            out.push({ escala, charsGrande: (res2.data.text ?? '').trim().length });
          }
          return out;
        })();

        return { info, variantes, renderVariantes };
      },
      ARCHIVO,
      { timeout: 300_000 }
    );

    console.log(JSON.stringify(resultado, null, 2));
  } finally {
    await navegador.close();
    vite.kill('SIGTERM');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
