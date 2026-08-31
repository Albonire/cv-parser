/**
 * Resolucion de Playwright y de Chromium para los scripts de banco de pruebas.
 *
 * Se separa en su propio modulo porque lo usan tanto el generador de escaneos
 * como el banco de precision, y porque importar el generador solo para reusar
 * estas funciones dispararia su `main()`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Chromium ya viene instalado en el contenedor, pero con un numero de build que
 * no siempre coincide con el que espera la version de Playwright. Se busca el
 * binario en disco en vez de dejar que Playwright lo descargue: la descarga no
 * pasa por el proxy de salida.
 */
export function rutaChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!fs.existsSync(base)) return undefined;

  const relativos = ['chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome'];
  const carpetas = fs
    .readdirSync(base)
    .filter((n) => n.startsWith('chromium'))
    .sort()
    .reverse();

  for (const carpeta of carpetas) {
    for (const relativo of relativos) {
      const ruta = path.join(base, carpeta, relativo);
      if (fs.existsSync(ruta)) return ruta;
    }
  }

  return undefined;
}

export async function cargarPlaywright(raiz) {
  const candidatos = [
    path.join(raiz, 'node_modules', 'playwright', 'index.mjs'),
    path.join(raiz, '..', '..', 'node_modules', 'playwright', 'index.mjs'),
    '/tmp/node_modules/playwright/index.mjs',
  ];

  for (const ruta of candidatos) {
    if (fs.existsSync(ruta)) return import(pathToFileURL(ruta).href);
  }

  throw new Error(
    'No se encontro Playwright. Instalelo con `npm i -D playwright` o ejecute el script\n' +
      'en un entorno que lo tenga. Chromium ya viene en /opt/pw-browsers en este contenedor.'
  );
}
