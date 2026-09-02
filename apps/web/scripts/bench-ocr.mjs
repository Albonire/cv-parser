/**
 * Banco de precision del lector sobre la ruta de OCR.
 *
 * Levanta el servidor de desarrollo, abre `bench-ocr.html` en Chromium y pasa
 * los 40 escaneos de `test-scans/` por `processDocument`, que es exactamente la
 * funcion que usa la aplicacion. Despues compara contra la verdad de referencia
 * y reporta por campo, por plantilla y por perfil de degradado.
 *
 * No entra en `npm test`: tarda varios minutos. Se ejecuta a demanda con
 * `npm run bench:ocr`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cargarPlaywright, rutaChromium } from './navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const ESCANEOS = path.join(RAIZ, 'test-scans');
/** Banco a medir: hojas de vida por defecto, contratos con `--banco=contratos`. */
const BANCO = (process.argv.find((a) => a.startsWith('--banco=')) ?? '').split('=')[1] || 'escaneados';
const VERDAD = path.join(
  RAIZ,
  'src',
  'lib',
  'ocr',
  '__fixtures__',
  `ground-truth-${BANCO === 'contratos' ? 'contratos' : 'escaneados'}.json`
);

const INFORME = path.join(ESCANEOS, `resultados-bench-${BANCO}.json`);
const PUERTO = 5199;
/** Un escaneo de dos paginas con OCR puede tardar bastante mas que uno de una. */
const TIEMPO_MAXIMO_DOCUMENTO = 240_000;

function esperar(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function arrancarVite() {
  const proceso = spawn(
    process.execPath,
    [path.join(RAIZ, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PUERTO), '--strictPort'],
    { cwd: RAIZ, stdio: ['ignore', 'pipe', 'pipe'] }
  );

  proceso.stdout.on('data', () => {});
  proceso.stderr.on('data', (d) => process.stderr.write(`[vite] ${d}`));

  const limite = Date.now() + 60_000;
  while (Date.now() < limite) {
    try {
      const r = await fetch(`http://localhost:${PUERTO}/bench-ocr.html`);
      if (r.ok) return proceso;
    } catch {
      // El servidor todavia no acepta conexiones.
    }
    await esperar(400);
  }

  proceso.kill('SIGTERM');
  throw new Error('El servidor de desarrollo no respondio en 60 s.');
}

function porcentaje(valor) {
  return `${(valor * 100).toFixed(1).padStart(5)}%`;
}

/** Tabla de texto plano: el informe se lee en la terminal y se pega en el documento. */
function tabla(titulo, filas, columnas) {
  const anchos = columnas.map((c, i) =>
    Math.max(c.length, ...filas.map((f) => String(f[i]).length))
  );
  const linea = (celdas) =>
    celdas.map((c, i) => String(c).padEnd(anchos[i])).join('  ').trimEnd();

  console.log(`\n${titulo}`);
  console.log(linea(columnas));
  console.log(anchos.map((a) => '-'.repeat(a)).join('  '));
  for (const fila of filas) console.log(linea(fila));
}

function agrupar(resultados, clave) {
  const mapa = new Map();
  for (const r of resultados) {
    if (!mapa.has(r[clave])) mapa.set(r[clave], []);
    mapa.get(r[clave]).push(r);
  }
  return mapa;
}

function notaDocumento(documento) {
  const notas = documento.campos.map((c) => c.similitud);
  return notas.reduce((a, b) => a + b, 0) / Math.max(1, notas.length);
}

function reportar(resultados) {
  const tipos = new Map();
  for (const doc of resultados) {
    tipos.set(doc.tipoDetectado, (tipos.get(doc.tipoDetectado) ?? 0) + 1);
  }
  tabla(
    'TIPO DE DOCUMENTO DETECTADO (los 40 son hojas de vida)',
    [...tipos.entries()].map(([tipo, n]) => [tipo, String(n), porcentaje(n / resultados.length)]),
    ['Tipo detectado', 'Docs', '% del banco']
  );

  const campos = new Map();
  for (const doc of resultados) {
    for (const campo of doc.campos) {
      if (!campos.has(campo.campo)) {
        campos.set(campo.campo, { acierto: 0, casi: 0, error: 0, vacio: 0, suma: 0, total: 0 });
      }
      const acumulado = campos.get(campo.campo);
      acumulado[campo.estado]++;
      acumulado.suma += campo.similitud;
      acumulado.total++;
    }
  }

  tabla(
    'PRECISION POR CAMPO (40 escaneos)',
    [...campos.entries()].map(([nombre, a]) => [
      nombre,
      `${a.acierto}/${a.total}`,
      porcentaje(a.acierto / a.total),
      String(a.casi),
      String(a.error),
      String(a.vacio),
      porcentaje(a.suma / a.total),
    ]),
    ['Campo', 'Aciertos', '% acierto', 'Casi', 'Error', 'Vacio', 'Similitud media']
  );

  for (const [clave, titulo] of [
    ['plantilla', 'PRECISION POR PLANTILLA'],
    ['perfil', 'PRECISION POR PERFIL DE DEGRADADO'],
  ]) {
    const grupos = agrupar(resultados, clave);
    tabla(
      titulo,
      [...grupos.entries()]
        .map(([nombre, docs]) => {
          const nota = docs.reduce((a, d) => a + notaDocumento(d), 0) / docs.length;
          const ms = docs.reduce((a, d) => a + d.ms, 0) / docs.length;
          const motor = docs.reduce((a, d) => a + d.confianzaMotor, 0) / docs.length;
          return [nombre, String(docs.length), porcentaje(nota), porcentaje(motor), `${Math.round(ms)} ms`];
        })
        .sort((a, b) => Number(a[2].replace('%', '')) - Number(b[2].replace('%', ''))),
      [clave === 'plantilla' ? 'Plantilla' : 'Perfil', 'Docs', 'Precision real', 'Confianza motor', 'Tiempo medio']
    );
  }

  tabla(
    'DOCUMENTOS DE PEOR A MEJOR',
    resultados
      .map((d) => [d.archivo, d.plantilla, d.perfil, porcentaje(notaDocumento(d)), porcentaje(d.confianzaMotor), `${d.ms} ms`])
      .sort((a, b) => Number(a[3].replace('%', '')) - Number(b[3].replace('%', ''))),
    ['Archivo', 'Plantilla', 'Perfil', 'Precision real', 'Confianza motor', 'Tiempo']
  );

  // La pregunta central: cuando el motor dice que confia, .acierta de verdad?
  const puntos = resultados.map((d) => [d.confianzaMotor, notaDocumento(d)]);
  const medX = puntos.reduce((a, p) => a + p[0], 0) / puntos.length;
  const medY = puntos.reduce((a, p) => a + p[1], 0) / puntos.length;
  let cov = 0;
  let varX = 0;
  let varY = 0;
  for (const [x, y] of puntos) {
    cov += (x - medX) * (y - medY);
    varX += (x - medX) ** 2;
    varY += (y - medY) ** 2;
  }
  const correlacion = cov / Math.sqrt(Math.max(1e-9, varX * varY));

  const precisionGlobal = puntos.reduce((a, p) => a + p[1], 0) / puntos.length;
  const tiempoTotal = resultados.reduce((a, d) => a + d.ms, 0);

  console.log(`\nRESUMEN`);
  console.log(`  Precision global (similitud media de todos los campos): ${porcentaje(precisionGlobal)}`);
  console.log(`  Confianza media que reporta el motor:                   ${porcentaje(medX)}`);
  console.log(`  Correlacion entre confianza reportada y acierto real:   ${correlacion.toFixed(3)}`);
  console.log(`  Tiempo total de OCR: ${(tiempoTotal / 1000).toFixed(1)} s (${Math.round(tiempoTotal / resultados.length)} ms por documento)`);
  console.log(`  Proyeccion a 1.000 hojas de vida: ${((tiempoTotal / resultados.length) * 1000 / 3_600_000).toFixed(2)} h`);
}

async function main() {
  if (!fs.existsSync(VERDAD)) {
    throw new Error(`Falta la verdad de referencia. Ejecute antes: npm run gen:scans`);
  }

  const verdad = JSON.parse(fs.readFileSync(VERDAD, 'utf8'));
  const filtro = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const documentos = filtro
    ? verdad.documentos.filter((d) => d.archivo.includes(filtro))
    : verdad.documentos;

  if (documentos.length === 0) throw new Error(`Ningun documento coincide con "${filtro}".`);

  console.log(`Midiendo ${documentos.length} escaneos por la ruta de OCR...\n`);

  const vite = await arrancarVite();
  const { chromium } = await cargarPlaywright(RAIZ);
  const navegador = await chromium.launch({ executablePath: rutaChromium() });

  const resultados = [];

  try {
    const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await contexto.newPage();
    page.on('pageerror', (e) => console.error('  [pagina]', e.message));

    await page.goto(`http://localhost:${PUERTO}/bench-ocr.html`, { waitUntil: 'load' });
    await page.waitForSelector('body[data-banco-listo="1"]', { timeout: 120_000 });

    for (const documento of documentos) {
      const resultado = await page.evaluate(
        (registro) => window.bancoLector.medirDocumento(registro),
        documento,
        { timeout: TIEMPO_MAXIMO_DOCUMENTO }
      );

      resultados.push(resultado);

      const nota = notaDocumento(resultado);
      console.log(
        `  ${resultado.archivo.padEnd(42)} ${porcentaje(nota)} real  ${porcentaje(resultado.confianzaMotor)} motor  ${String(resultado.ms).padStart(6)} ms  ${resultado.metodo}`
      );
    }
  } finally {
    await navegador.close();
    vite.kill('SIGTERM');
  }

  fs.writeFileSync(INFORME, `${JSON.stringify(resultados, null, 2)}\n`);
  reportar(resultados);
  console.log(`\nDetalle campo por campo en ${path.relative(RAIZ, INFORME)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
