/**
 * Repara los JSON de extraccion re-procesando SOLO las imagenes que quedaron
 * con error (bug de parsearMonto ya corregido). Busca la imagen por su nombre
 * dentro de la carpeta de la persona y actualiza el registro.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cargarPlaywright, rutaChromium } from './navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const PUERTO = 5203;
const SALIDA = process.env.CV_SALIDA || 'C:/Users/User/AppData/Local/Temp/opencode/cv-extraccion';
const ORIGEN = process.env.CV_ORIGEN || 'C:/Users/User/Documents/HOJAS DE VIDA ROSIMAR SAS';
const EXT_IMAGEN = ['jpeg', 'jpg', 'png', 'webp', 'bmp', 'gif', 'tif', 'tiff', 'pdf'];
const TIEMPO_MAXIMO_IMAGEN = 180_000;

function esperar(ms) { return new Promise((res) => setTimeout(res, ms)); }

function esImagen(nombre) {
  const parts = nombre.split('.');
  const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  return EXT_IMAGEN.includes(ext);
}

/** Busca un archivo por nombre dentro de la carpeta de la persona (recursivo). */
function buscarEnCarpeta(nombre, dir) {
  if (!fs.existsSync(dir)) return null;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, item.name);
    if (item.isDirectory()) {
      const r = buscarEnCarpeta(nombre, ruta);
      if (r) return r;
    } else if (item.name === nombre && esImagen(item.name)) {
      return ruta;
    }
  }
  return null;
}

/** Busca un archivo dentro de un zip (por si la persona vino de un zip). */
function buscarEnZip(nombre, rutaZip) {
  try {
    const lista = execSync(`"tar" -tf "${rutaZip}"`, { encoding: 'utf8' });
    const linea = lista.split('\n').map((l) => l.trim()).find((l) => l.split('/').pop() === nombre);
    if (!linea) return null;
    const tmp = path.join('C:/Users/User/AppData/Local/Temp/opencode', `_tmp_${Date.now()}`);
    fs.mkdirSync(tmp, { recursive: true });
    execSync(`"tar" -xf "${rutaZip}" -C "${tmp}" "${linea}"`);
    return path.join(tmp, linea);
  } catch {
    return null;
  }
}

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
  const fallidos = [];

  // Paso 1: identificar imagenes con error en cada JSON y localizarlas
  for (const archivo of fs.readdirSync(SALIDA).filter((f) => f.endsWith('.json'))) {
    const ruta = path.join(SALIDA, archivo);
    const j = JSON.parse(fs.readFileSync(ruta, 'utf8'));
    const personaDir = path.join(ORIGEN, j.nombre);
    const zipRuta = path.join(ORIGEN, `${j.nombre}.zip`);

    for (const reg of j.registros) {
      if (!reg.error) continue;
      const rutaImg = buscarEnCarpeta(reg.fileName, personaDir) || buscarEnZip(reg.fileName, zipRuta);
      fallidos.push({ persona: j.nombre, jsonPath: ruta, fileName: reg.fileName, rutaImg, registros: j.registros });
    }
  }

  console.log(`Imagenes con error a reprocesar: ${fallidos.length}`);
  if (fallidos.length === 0) return;

  const vite = await arrancarVite();
  const { chromium } = await cargarPlaywright(RAIZ);
  const navegador = await chromium.launch({ executablePath: rutaChromium() });

  try {
    const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await contexto.newPage();
    page.on('pageerror', (e) => console.error('  [pagina]', e.message));
    await page.goto(`http://localhost:${PUERTO}/bench-ocr.html`, { waitUntil: 'load' });
    await page.waitForSelector('body[data-banco-listo="1"]', { timeout: 120_000 });

    for (const f of fallidos) {
      if (!f.rutaImg) {
        console.log(`  [no-encontrada] ${f.persona}/${f.fileName}`);
        continue;
      }
      const buf = fs.readFileSync(f.rutaImg);
      const base64 = buf.toString('base64');
      const mime = f.fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
      try {
        const res = await page.evaluate(
          async (imp) => {
            const modIndex = await import('/src/lib/ocr/index.ts');
            const bin = Uint8Array.from(atob(imp.base64), (c) => c.charCodeAt(0));
            const file = new File([bin], imp.nombre, { type: imp.mime });
            const r = await modIndex.processDocument(file);
            return {
              fileName: r.fileName,
              method: r.method,
              confidenceScore: r.confidenceScore,
              detectedType: r.detectedType,
              text: r.extractedText,
              candidate: r.candidateData || null,
              contract: r.contractData || null,
              warning: r.warnings || null,
            };
          },
          { base64, nombre: f.fileName, mime },
          { timeout: TIEMPO_MAXIMO_IMAGEN }
        );
        const idx = f.registros.findIndex((r) => r.fileName === f.fileName);
        if (idx >= 0) f.registros[idx] = res;
        const fallasRestantes = f.registros.filter((r) => r.error).length;
        const j = JSON.parse(fs.readFileSync(f.jsonPath, 'utf8'));
        j.registros = f.registros;
        j.fallas = fallasRestantes;
        fs.writeFileSync(f.jsonPath, JSON.stringify(j, null, 2));
        console.log(`  [reparado] ${f.persona}/${f.fileName} -> ${res.detectedType} text=${res.text.length} conf=${(res.confidenceScore * 100).toFixed(0)}%`);
      } catch (e) {
        console.log(`  [fail] ${f.persona}/${f.fileName}: ${String(e.message || e).slice(0, 120)}`);
      }
    }
  } finally {
    await navegador.close();
    vite.kill('SIGTERM');
  }
  console.log('\nReparacion finalizada.');
}

main().catch((e) => { console.error(e); process.exit(1); });
