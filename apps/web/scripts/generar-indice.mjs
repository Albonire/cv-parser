/**
 * Genera un indice (CSV + JSON de resumen) de las 50 fichas laborales para
 * facilitar la revision. Reutiliza el mismo consolidador de generar-fichas.mjs.
 *
 * Salida: <CV_SALIDA_PDF>/indice-fichas.csv y indice-fichas.json
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cargarPlaywright, rutaChromium } from './navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const PUERTO = 5206;
const ENTRADA = process.env.CV_SALIDA || 'C:/Users/User/AppData/Local/Temp/opencode/cv-extraccion';
const SALIDA_PDF = process.env.CV_SALIDA_PDF || 'C:/Users/User/Documents/FICHAS LABORALES ROSIMAR';
const SOLO = process.argv.slice(2).find((a) => !a.startsWith('--'));

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

const consolidarIndice = async (j) => {
  const cls = await import('/src/lib/ocr/document-classifier.ts');
  const tipoNormalizado = (texto) => {
    const t = (texto || '').toLowerCase();
    if (/renuncia|retiro voluntario/.test(t)) return 'Renuncia';
    if (/memorando/.test(t)) return 'Memorando';
    if (/llamado de atencion|llamado de atenci/.test(t)) return 'Llamado';
    if (/vacaciones/.test(t) && /disfrut/.test(t)) return 'Vacaciones';
    if (/liquidacion/.test(t)) return 'Liquidacion';
    if (/funciones/.test(t) && /cargo/.test(t)) return 'Funciones';
    if (/afiliad/.test(t)) return 'Salud';
    return null;
  };

  const res = {
    nombre: j.nombre,
    documento: '',
    nacimiento: '',
    ciudad: '',
    telefono: '',
    email: '',
    cargo: '',
    salario: '',
    eps: '',
    tipoCarpeta: '',
    contratos: 0,
    historial: [],
    documentos: j.registros.length,
    cv: 0,
    liquidaciones: 0,
  };

  let mejorCv = null; let mejorP = 0;
  const cvs = new Set();
  for (const reg of j.registros) {
    if (reg.error) continue;
    if (reg.candidate) {
      cvs.add(reg.fileName);
      let p = 0;
      if (reg.candidate.firstNames) p++;
      if (reg.candidate.lastNames) p++;
      if (reg.candidate.documentNumber) p += 2;
      if (reg.candidate.phone) p += 1;
      if (reg.candidate.cityResidence) p++;
      if (p > mejorP) { mejorP = p; mejorCv = reg.candidate; }
    }
    if (reg.contract) {
      res.contratos++;
      if (!res.cargo && reg.contract.position) res.cargo = reg.contract.position;
      if (!res.salario && reg.contract.salary) res.salario = `$${Number(reg.contract.salary).toLocaleString('es-CO')}`;
    }
    if (reg.liquidacion) { res.liquidaciones++; if (!res.cargo && reg.liquidacion.cargo) res.cargo = reg.liquidacion.cargo; }
    if (reg.health && reg.health.epsName && !res.eps) res.eps = reg.health.epsName;
    if (reg.idCard && reg.idCard.documentNumber && !res.documento) res.documento = reg.idCard.documentNumber;
    if (reg.memorando && reg.memorando.subject) res.historial.push(reg.memorando.subject);
    if (reg.detectedType === 'unknown' || reg.detectedType === 'contract' || reg.detectedType === 'liquidacion') {
      const tn = tipoNormalizado(reg.text);
      if (tn) res.historial.push(tn);
    }
    if (reg.detectedType === 'cv') res.cv++;
  }

  if (mejorCv) {
    if (!res.documento && mejorCv.documentNumber) res.documento = mejorCv.documentNumber;
    if (!res.nacimiento && mejorCv.birthDate) res.nacimiento = mejorCv.birthDate;
    if (!res.ciudad && mejorCv.cityResidence) res.ciudad = mejorCv.cityResidence;
    if (!res.telefono && mejorCv.phone) res.telefono = mejorCv.phone;
    if (!res.email && mejorCv.email) res.email = mejorCv.email;
    if (!res.cargo && mejorCv.headline) res.cargo = mejorCv.headline;
  }

  res.historial = [...new Set(res.historial.filter(Boolean))];
  if (/RETIRO|LADRON|FALTA LIQUIDACION/i.test(j.nombre)) res.tipoCarpeta = 'marcada-en-nombre';
  return res;
};

function escaparCsv(v) {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const archivos = fs.readdirSync(ENTRADA).filter((f) => f.endsWith('.json')).sort();
  const objetivo = SOLO ? archivos.filter((f) => f.toLowerCase().includes(SOLO.toLowerCase())) : archivos;
  console.log(`Indexando ${objetivo.length} fichas...`);

  const vite = await arrancarVite();
  const { chromium } = await cargarPlaywright(RAIZ);
  const navegador = await chromium.launch({ executablePath: rutaChromium() });

  const filas = [];
  try {
    const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await contexto.newPage();
    page.on('pageerror', (e) => console.error('  [pagina]', e.message));
    await page.goto(`http://localhost:${PUERTO}/bench-ocr.html`, { waitUntil: 'load' });
    await page.waitForSelector('body[data-banco-listo="1"]', { timeout: 120_000 });

    for (const archivo of objetivo) {
      const j = JSON.parse(fs.readFileSync(path.join(ENTRADA, archivo), 'utf8'));
      try {
        const res = await page.evaluate(consolidarIndice, j, { timeout: 60_000 });
        filas.push(res);
        console.log(`[ok] ${j.nombre}`);
      } catch (e) {
        console.log(`[fail] ${j.nombre}: ${String(e.message || e).slice(0, 100)}`);
      }
    }
  } finally {
    await navegador.close();
    vite.kill('SIGTERM');
  }

  // CSV
  const heads = ['Expediente', 'Documento', 'Nacimiento', 'Ciudad', 'Telefono', 'Email', 'Cargo', 'Salario', 'EPS', 'CV', 'Contratos', 'Liquidaciones', 'Historial', 'Marco'];
  const lineas = [heads.join(';')];
  for (const f of filas) {
    lineas.push([
      f.nombre, f.documento, f.nacimiento, f.ciudad, f.telefono, f.email,
      f.cargo, f.salario, f.eps, f.cv, f.contratos, f.liquidaciones,
      f.historial.join(' | '), f.tipoCarpeta,
    ].map(escaparCsv).join(';'));
  }
  fs.writeFileSync(path.join(SALIDA_PDF, 'indice-fichas.csv'), '\ufeff' + lineas.join('\n'), 'utf8');
  fs.writeFileSync(path.join(SALIDA_PDF, 'indice-fichas.json'), JSON.stringify(filas, null, 2));
  console.log(`\nListo. ${filas.length} fichas en indice-fichas.csv / .json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
