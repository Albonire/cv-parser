/**
 * Prepara los archivos del motor OCR que la aplicacion debe servir por si misma:
 *
 * - `public/tesseract`: worker y nucleo WebAssembly de tesseract.js (desde node_modules).
 * - `public/tessdata`: modelos de idioma spa y eng (desde la raiz de la app).
 *
 * Sin esto el lector no funciona sin conexion ni en redes que bloqueen el CDN de
 * jsdelivr: la lectura se queda esperando indefinidamente.
 *
 * Ninguno de los dos directorios se versiona (estan en .gitignore): son copias
 * generadas antes de cada arranque o compilacion (scripts `predev` y `prebuild`).
 */
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const destino = join(raiz, 'public', 'tesseract');

/**
 * tesseract.js elige en tiempo de ejecucion una de estas variantes segun el
 * soporte de SIMD del navegador (ver tesseract.js/src/worker-script/browser/getCore.js),
 * asi que deben estar todas disponibles. Cada navegador descarga una sola.
 */
const VARIANTES_CORE = [
  'tesseract-core-relaxedsimd-lstm',
  'tesseract-core-relaxedsimd',
  'tesseract-core-simd-lstm',
  'tesseract-core-simd',
  'tesseract-core-lstm',
  'tesseract-core',
];

const archivos = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ...VARIANTES_CORE.flatMap((variante) => [
    [`tesseract.js-core/${variante}.wasm.js`, `${variante}.wasm.js`],
    [`tesseract.js-core/${variante}.wasm`, `${variante}.wasm`],
  ]),
];

mkdirSync(destino, { recursive: true });

let copiados = 0;
for (const [origen, nombre] of archivos) {
  const ruta = join(raiz, 'node_modules', origen);
  if (!existsSync(ruta)) {
    console.warn(`[ocr-assets] no se encontro ${origen}; el lector caeria al CDN.`);
    continue;
  }
  copyFileSync(ruta, join(destino, nombre));
  copiados++;
}

// Modelos de idioma: viven versionados en la raiz de la app y se publican en
// /tessdata, que es la ruta que consulta tesseract.js (`langPath`).
const destinoModelos = join(raiz, 'public', 'tessdata');
mkdirSync(destinoModelos, { recursive: true });

for (const modelo of ['spa.traineddata', 'eng.traineddata']) {
  const ruta = join(raiz, modelo);
  if (!existsSync(ruta)) {
    console.warn(`[ocr-assets] falta ${modelo}; el OCR no funcionaria sin conexion.`);
    continue;
  }
  copyFileSync(ruta, join(destinoModelos, modelo));
  copiados++;
}

console.log(`[ocr-assets] ${copiados} archivos preparados en public/tesseract y public/tessdata`);
