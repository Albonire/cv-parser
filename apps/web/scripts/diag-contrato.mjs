/**
 * Diagnostico rapido: muestra las lineas del layout y el contrato extraido
 * para un solo archivo de contrato, usando el mismo pipeline que la aplicacion.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cargarPlaywright, rutaChromium } from './navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const PUERTO = 5199;

const ARCHIVO = process.argv[2] || 'CT_05_contrato-alineado_limpio.pdf';
const ARCHIVO_SALIDA = path.join(RAIZ, 'test-scans', `diag-${ARCHIVO}.json`);

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

    console.log(`Diagnosticando: ${ARCHIVO}`);

    const diagnostico = await page.evaluate(
      (archivo) => window.bancoLector.diagnosticar(archivo),
      ARCHIVO,
      { timeout: 300_000 }
    );

    console.log(`\n=== LINEAS DEL LAYOUT (${diagnostico.lineasLayout.length}) ===`);
    for (const [i, linea] of diagnostico.lineasLayout.entries()) {
      const col = linea.column === -1 ? 'SPAN' : linea.column === 0 ? 'IZQ ' : 'DER ';
      console.log(`  ${String(i).padStart(3)} [${col}] y=${String(linea.y).padStart(5)} h=${String(linea.height).padStart(3)} fs=${String(linea.fontSize).padStart(4)} | ${linea.text.substring(0, 90)}`);
    }

    console.log(`\n=== TEXTO EXTRAIDO (${diagnostico.texto.length} chars) ===`);
    const lineasTexto = diagnostico.texto.split('\n');
    for (const [i, linea] of lineasTexto.entries()) {
      console.log(`  ${String(i).padStart(3)} | ${linea.substring(0, 100)}`);
    }

    console.log(`\n=== CONTRATO EXTRAIDO ===`);
    console.log(JSON.stringify(diagnostico.contrato, null, 2));

    fs.writeFileSync(ARCHIVO_SALIDA, JSON.stringify(diagnostico, null, 2));
    console.log(`\nDiagnostico guardado en ${path.relative(RAIZ, ARCHIVO_SALIDA)}`);
  } finally {
    await navegador.close();
    vite.kill('SIGTERM');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
