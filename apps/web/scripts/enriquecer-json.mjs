/**
 * Enriquece los JSON de extraccion agregando a cada registro los campos
 * estructurados que processDocument calculo pero el script de extraccion no
 * guardo (health, idCard, liquidacion, memorando, funciones).
 *
 * Re-ejecuta los parsers sobre el texto OCR YA guardado (sin re-OCR), que es
 * rapido porque solo es regex sobre string.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cargarPlaywright, rutaChromium } from './navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const PUERTO = 5204;
const SALIDA = process.env.CV_SALIDA || 'C:/Users/User/AppData/Local/Temp/opencode/cv-extraccion';

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
  const vite = await arrancarVite();
  const { chromium } = await cargarPlaywright(RAIZ);
  const navegador = await chromium.launch({ executablePath: rutaChromium() });

  try {
    const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await contexto.newPage();
    page.on('pageerror', (e) => console.error('  [pagina]', e.message));
    await page.goto(`http://localhost:${PUERTO}/bench-ocr.html`, { waitUntil: 'load' });
    await page.waitForSelector('body[data-banco-listo="1"]', { timeout: 120_000 });

    for (const archivo of fs.readdirSync(SALIDA).filter((f) => f.endsWith('.json')).sort()) {
      const ruta = path.join(SALIDA, archivo);
      const j = JSON.parse(fs.readFileSync(ruta, 'utf8'));
      let cambiado = false;

      for (const reg of j.registros) {
        if (!reg.text || reg.error) continue;
        const tipo = reg.detectedType;
        const res = await page.evaluate(
          async (imp) => {
            const mod = {};
            try {
              const idx = await import('/src/lib/ocr/index.ts');
              const tx = imp.text;
              let out = {};
              if (imp.tipo === 'health') {
                out.health = idx.parseHealthText(tx);
              } else if (imp.tipo === 'id_card') {
                out.idCard = idx.parseIdCardText(tx);
              } else if (imp.tipo === 'liquidacion') {
                out.liquidacion = idx.parseLiquidacionText(tx);
              } else if (imp.tipo === 'unknown') {
                const cls = await import('/src/lib/ocr/document-classifier.ts');
                const cat = cls.clasificarHistorial(tx);
                if (cat === 'memorando' || cat === 'llamado_atencion') out.memorando = idx.parseMemorandoText(tx);
                else if (cat === 'funciones') out.funciones = idx.parseFuncionesText(tx);
              }
              return out;
            } catch (e) {
              return { error: String(e.message || e) };
            }
          },
          { text: reg.text, tipo },
          { timeout: 60_000 }
        );

        if (res && !res.error) {
          for (const k of ['health', 'idCard', 'liquidacion', 'memorando', 'funciones']) {
            if (res[k] !== undefined) { reg[k] = res[k]; cambiado = true; }
          }
        }
      }

      if (cambiado) {
        fs.writeFileSync(ruta, JSON.stringify(j, null, 2));
        console.log(`[ok] ${j.nombre}`);
      } else {
        console.log(`[sin-cambios] ${j.nombre}`);
      }
    }
  } finally {
    await navegador.close();
    vite.kill('SIGTERM');
  }
  console.log('\nEnriquecimiento finalizado.');
}

main().catch((e) => { console.error(e); process.exit(1); });
