/**
 * Diagnostico de las fotos reales de WhatsApp en `fotos-usuario/`.
 *
 * Pasa cada foto por el pipeline REAL de OCR (`processDocument` dentro de
 * Chromium) y muestra el texto reconocido, la confianza y el metodo, para ver
 * con los propios ojos el "texto basura" que reporta el usuario.
 *
 * No entra en `npm test`. Se ejecuta a demanda con `node scripts/diag-fotos.mjs`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cargarPlaywright } from './navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const FOTOS = path.join(RAIZ, 'fotos-usuario');
const PUERTO = 5199;

function esperar(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function arrancarVite() {
  const proceso = spawn(
    process.execPath,
    [path.join(RAIZ, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PUERTO), '--strictPort'],
    { cwd: RAIZ, stdio: ['ignore', 'pipe', 'pipe'] }
  );
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
  proceso.kill();
  throw new Error('El servidor de desarrollo no respondio en 60 s.');
}

function resumir(texto) {
  const compacto = texto.replace(/\s+/g, ' ').trim();
  return compacto.length > 700 ? `${compacto.slice(0, 700)}...` : compacto;
}

/** Variantes de preprocesado para el modo `--variantes`. */
const VARIANTES = ['gris', 'plano', 'desenfumado', 'contraste', 'binarizado', 'original'];

/** Cuenta cuantas palabras parecen espanol para separar texto limpio de basura. */
function proporcionLegible(texto) {
  const palabras = texto.split(/\s+/).filter((p) => p.length > 2);
  if (palabras.length === 0) return 0;
  const legibles = palabras.filter((p) => {
    const vocales = (p.match(/[aeiouáéíóú]/gi) || []).length;
    return vocales >= 1 && /[a-záéíóú]/i.test(p) && !/[\[\]{}<>@#$%^&*=_|]/.test(p);
  });
  return legibles.length / palabras.length;
}

const ES_VARIANTES = process.argv.includes('--variantes');

async function main() {
  const fotos = fs
    .readdirSync(FOTOS)
    .filter((f) => /\.(jpe?g|png|webp|bmp|gif|tiff?)$/i.test(f))
    .sort();

  if (fotos.length === 0) {
    throw new Error('No hay fotos en fotos-usuario/');
  }

  console.log(`Midiendo ${fotos.length} fotos de expediente por la ruta real de OCR...\n`);

  const vite = await arrancarVite();
  const { chromium } = await cargarPlaywright(RAIZ);
  const navegador = await chromium.launch();

  try {
    const page = await (await navegador.newContext()).newPage();
    page.on('pageerror', (e) => console.error('  [pagina]', e.message));

    await page.goto(`http://localhost:${PUERTO}/bench-ocr.html`, { waitUntil: 'load' });
    await page.waitForSelector('body[data-banco-listo="1"]', { timeout: 120_000 });

    for (const foto of fotos) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`FOTO: ${foto}`);

      if (ES_VARIANTES) {
        for (const variante of VARIANTES) {
          console.log(`\n  --- variante: ${variante} ---`);
          try {
            const resultado = await page.evaluate(
              ({ nombre, v }) => window.bancoLector.medirImagen(nombre, v),
              { nombre: foto, v: variante },
              { timeout: 240_000 }
            );
            const legible = proporcionLegible(resultado.texto);
            console.log(`  Confianza: ${(resultado.confidenceScore * 100).toFixed(1)}% | Caracteres: ${resultado.caracteres} | Legible: ${(legible * 100).toFixed(0)}% | ${resultado.ms} ms`);
            console.log(`  TEXTO: ${resumir(resultado.texto) || '(vacío)'}`);
          } catch (error) {
            console.log(`  ERROR: ${error.message}`);
          }
        }
        continue;
      }

      const resultado = await page.evaluate(
        (nombre) => window.bancoLector.medirImagen(nombre),
        foto,
        { timeout: 240_000 }
      );
      console.log(`  Metodo: ${resultado.method} | Confianza: ${(resultado.confidenceScore * 100).toFixed(1)}% | Caracteres: ${resultado.caracteres} | ${resultado.ms} ms`);
      console.log(`  Avisos: ${resultado.warnings.join(' | ') || '(ninguno)'}`);
      console.log(`  TEXTO RECONOCIDO:`);
      console.log(`    ${resumir(resultado.texto) || '(vacío)'}`);
    }
  } finally {
    await navegador.close();
    vite.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});