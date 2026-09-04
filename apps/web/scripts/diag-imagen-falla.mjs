/**
 * Diagnostico de una imagen que falla en processDocument con
 * "Cannot read properties of undefined (reading 'slice')".
 *
 * Reproduce la lectura con paso a paso para localizar donde ocurre.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cargarPlaywright, rutaChromium } from './navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const PUERTO = 5202;

const RUTA = process.argv[2];
if (!RUTA) {
  console.error('Uso: node scripts/diag-imagen-falla.mjs <ruta-imagen>');
  process.exit(1);
}

function esperar(ms) { return new Promise((res) => setTimeout(res, ms)); }

async function arrancarVite() {
  const proceso = spawn(
    process.execPath,
    [path.join(RAIZ, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PUERTO), '--strictPort'],
    { cwd: RAIZ, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const limite = Date.now() + 60_000;
  while (Date.now() < limite) {
    try { const r = await fetch(`http://localhost:${PUERTO}/bench-ocr.html`); if (r.ok) return proceso; } catch {}
    await esperar(400);
  }
  proceso.kill('SIGTERM');
  throw new Error('Vite no respondio en 60 s.');
}

async function main() {
  const buf = fs.readFileSync(RUTA);
  const base64 = buf.toString('base64');
  const nombre = path.basename(RUTA);

  const vite = await arrancarVite();
  const { chromium } = await cargarPlaywright(RAIZ);
  const navegador = await chromium.launch({ executablePath: rutaChromium() });

  try {
    const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await contexto.newPage();
    page.on('pageerror', (e) => console.error('[pageerror]', e.message, '\n', e.stack));
    await page.goto(`http://localhost:${PUERTO}/bench-ocr.html`, { waitUntil: 'load' });
    await page.waitForSelector('body[data-banco-listo="1"]', { timeout: 120_000 });

    const resultado = await page.evaluate(
      async (imp) => {
        const out = {};
        const bin = Uint8Array.from(atob(imp.base64), (c) => c.charCodeAt(0));
        const file = new File([bin], imp.nombre, { type: 'image/jpeg' });

        // Paso 1: createImageBitmap
        try {
          const bmp = await createImageBitmap(file);
          out.bitmap = { width: bmp.width, height: bmp.height };
          bmp.close?.();
        } catch (e) {
          out.bitmap = { error: String(e.message || e), stack: e.stack };
          return out;
        }

        // Paso 2: preprocess gris
        try {
          const mod = await import('/src/lib/ocr/image-prep.ts');
          const blob = await mod.preprocessImage(file, { binarizar: false });
          out.gris = { ok: true, size: blob.size };
        } catch (e) {
          out.gris = { error: String(e.message || e), stack: e.stack };
        }

        // Paso 3: OCR directo con el worker
        try {
          const mod = await import('/src/lib/ocr/tesseract-worker.ts');
          const worker = await mod.getTesseractWorker();
          const res = await worker.recognize(file, {}, { blocks: true, text: true });
          out.ocr = { text: (res.data.text || '').length, conf: res.data.confidence };
        } catch (e) {
          out.ocr = { error: String(e.message || e), stack: e.stack };
        }

        // Paso 4: pipeline completo
        try {
          const modIndex = await import('/src/lib/ocr/index.ts');
          const r = await modIndex.processDocument(file);
          out.pipeline = { type: r.detectedType, text: r.extractedText.length };
        } catch (e) {
          out.pipeline = { error: String(e.message || e), stack: String(e.stack) };
        }

        return out;
      },
      { base64, nombre },
      { timeout: 300_000 }
    );

    console.log(JSON.stringify(resultado, null, 2));
  } finally {
    await navegador.close();
    vite.kill('SIGTERM');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
