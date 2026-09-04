/**
 * Extraccion por lote de hojas de vida reales (fotos de WhatsApp/escaneros).
 *
 * Recorre las carpetas de "HOJAS DE VIDA ROSIMAR SAS", procesa CADA imagen con
 * processDocument (el mismo pipeline que usa la aplicacion) dentro del navegador
 * (Tesseract WASM), y guarda por persona un JSON con:
 *   - nombre de carpeta y lista de archivos
 *   - texto OCR de cada imagen
 *   - datos estructurados de CV (candidateData) de la imagen que fue hoja de vida
 *   - consolidado de la persona
 *
 * Progresa de forma incremental para poder reanudar si se corta. El texto OCR
 * queda disponible para revision manual de calidad.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cargarPlaywright, rutaChromium } from './navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const PUERTO = 5201;

const ORIGEN = process.env.CV_ORIGEN || 'C:/Users/User/Documents/HOJAS DE VIDA ROSIMAR SAS';
const SALIDA = process.env.CV_SALIDA || 'C:/Users/User/AppData/Local/Temp/opencode/cv-extraccion';
const SOLO = process.argv.slice(2).find((a) => !a.startsWith('--'));

const EXT_IMAGEN = ['jpeg', 'jpg', 'png', 'webp', 'bmp', 'gif', 'tif', 'tiff', 'pdf'];
const TIEMPO_MAXIMO_IMAGEN = 180_000;

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

function extensionDe(nombre) {
  const parts = nombre.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function esImagen(nombre) {
  return EXT_IMAGEN.includes(extensionDe(nombre));
}

/** Lee un archivo binario y lo devuelve como objeto transferible al navegador. */
function leerParaEnviar(ruta, nombre) {
  const buf = fs.readFileSync(ruta);
  const base64 = buf.toString('base64');
  return { nombre, base64, mime: extensionDe(nombre) === 'pdf' ? 'application/pdf' : 'image/jpeg' };
}

function listarImagenesCarpeta(dir) {
  const out = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const ruta = path.join(dir, item.name);
    if (item.isDirectory()) out.push(...listarImagenesCarpeta(ruta));
    else if (esImagen(item.name)) out.push(ruta);
  }
  return out;
}

function recolectarPersonas() {
  const personas = [];
  for (const entrada of fs.readdirSync(ORIGEN, { withFileTypes: true })) {
    const ruta = path.join(ORIGEN, entrada.name);
    if (entrada.isDirectory()) {
      const imagenes = listarImagenesCarpeta(ruta);
      if (imagenes.length > 0) personas.push({ nombre: entrada.name, tipo: 'carpeta', ruta, archivos: imagenes });
    } else if (entrada.name.toLowerCase().endsWith('.zip')) {
      personas.push({ nombre: entrada.name.replace(/\.zip$/i, ''), tipo: 'zip', ruta, archivos: [ruta] });
    }
  }
  personas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return personas;
}

async function main() {
  fs.mkdirSync(SALIDA, { recursive: true });
  const personas = recolectarPersonas();
  const pendientes = SOLO ? personas.filter((p) => p.nombre.toLowerCase().includes(SOLO.toLowerCase())) : personas;

  console.log(`Encontradas ${personas.length} personas; a procesar ${pendientes.length}.`);

  const vite = await arrancarVite();
  const { chromium } = await cargarPlaywright(RAIZ);
  const navegador = await chromium.launch({ executablePath: rutaChromium() });

  try {
    const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await contexto.newPage();
    page.on('pageerror', (e) => console.error('  [pagina]', e.message));
    await page.goto(`http://localhost:${PUERTO}/bench-ocr.html`, { waitUntil: 'load' });
    await page.waitForSelector('body[data-banco-listo="1"]', { timeout: 120_000 });

    for (const persona of pendientes) {
      const archivoSalida = path.join(SALIDA, `${persona.nombre}.json`);
      if (fs.existsSync(archivoSalida)) {
        console.log(`[salte] ${persona.nombre} (ya procesada)`);
        continue;
      }

      console.log(`\n=== ${persona.nombre} (${persona.tipo}) ===`);
      const registros = [];
      let fallas = 0;

      const fuentes = persona.archivos.map((rutaImg) => leerParaEnviar(rutaImg, path.basename(rutaImg)));
      const fuentesJson = JSON.stringify(fuentes);
      try {
        const res = await page.evaluate(
          async (argumentos) => {
            const { fuentes, procesarZip } = argumentos;
            const modIndex = await import('/src/lib/ocr/index.ts');
            const resultados = [];
            let fallas = 0;
            for (const imp of fuentes) {
              try {
                if (procesarZip) {
                  const modZip = await import('/src/lib/ocr/extraer-zip.ts');
                  const zbin = Uint8Array.from(atob(imp.base64), (c) => c.charCodeAt(0));
                  const zfile = new File([zbin], imp.nombre, { type: 'application/zip' });
                  imp.archivos = await modZip.extraerArchivosDeZip(zfile);
                }
                const lista = imp.archivos && imp.archivos.length ? imp.archivos : [new File([Uint8Array.from(atob(imp.base64), (c) => c.charCodeAt(0))], imp.nombre, { type: imp.mime })];
                for (const file of lista) {
                  try {
                    const r = await modIndex.processDocument(file);
                    resultados.push({
                      fileName: r.fileName,
                      method: r.method,
                      confidenceScore: r.confidenceScore,
                      detectedType: r.detectedType,
                      text: r.extractedText,
                      candidate: r.candidateData || null,
                      contract: r.contractData || null,
                      warning: r.warnings || null,
                    });
                  } catch (e) {
                    fallas++;
                    resultados.push({ fileName: file.name, error: String(e.message || e) });
                  }
                }
              } catch (e) {
                fallas++;
                resultados.push({ fileName: imp.nombre, error: String(e.message || e) });
              }
            }
            return { resultados, fallas };
          },
          { fuentes: JSON.parse(fuentesJson), procesarZip: persona.tipo === 'zip' },
          { timeout: persona.tipo === 'zip' ? TIEMPO_MAXIMO_IMAGEN * 8 : TIEMPO_MAXIMO_IMAGEN }
        );
        registros.push(...res.resultados);
        fallas = res.fallas;
        for (const reg of res.resultados) {
          if (reg.error) console.log(`  [fail] ${reg.fileName}: ${reg.error.slice(0, 120)}`);
          else console.log(`  [ok] ${reg.fileName} -> ${reg.detectedType} text=${reg.text.length} conf=${(reg.confidenceScore * 100).toFixed(0)}%`);
        }
      } catch (e) {
        fallas = fuentes.length;
        console.log(`  [fail] ${persona.nombre}: ${String(e.message || e).slice(0, 120)}`);
      }

      fs.writeFileSync(archivoSalida, JSON.stringify({ nombre: persona.nombre, tipo: persona.tipo, registros, fallas }, null, 2));
      console.log(`  -> guardado ${persona.nombre}.json (${registros.length} registros, ${fallas} fallas)`);
    }
  } finally {
    await navegador.close();
    vite.kill('SIGTERM');
  }

  console.log('\nExtraccion por lote finalizada.');
}

main().catch((e) => { console.error(e); process.exit(1); });
