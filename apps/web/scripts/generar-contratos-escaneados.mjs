/**
 * Banco de contratos laborales ESCANEADOS.
 *
 * Reproduce el contrato en papel de Rosimar: titulo centrado que cruza el canal
 * entre columnas y una tabla de dos columnas cuyas celdas van desfasadas. El
 * banco anterior (`Contrato_01_2Columnas.pdf`) era un PDF digital con las filas
 * perfectamente alineadas y el titulo acortado a proposito para que
 * `detectGutter` encontrara las columnas: pasaba la prueba sin ejercitar lo que
 * de verdad falla.
 *
 * Uso: npm run gen:contratos
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarPlaywright, rutaChromium } from './navegador.mjs';
import { ALTO_CSS, ANCHO_CSS, ESCALA, PERFILES, degradar, pdfDeImagenes } from './escaneo.mjs';
import { CONTRATOS } from './datos-contratos.mjs';
import { PLANTILLAS_CONTRATO } from './plantillas-contrato.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const SALIDA = path.join(RAIZ, 'test-scans');
const FIXTURES = path.join(RAIZ, 'src', 'lib', 'ocr', '__fixtures__');

/** Un perfil por plantilla, de limpio a duro, para separar layout de degradado. */
const PERFILES_CONTRATO = ['limpio', 'medio', 'limpio', 'duro'];

/** Meses en numero para derivar la duracion esperada del texto del contrato. */
function mesesDeTexto(texto) {
  const enCifra = texto.match(/\((\d{1,2})\)/);
  if (enCifra) return Number(enCifra[1]);
  return undefined;
}

function soloDigitos(valor) {
  return String(valor).replace(/\D+/g, '');
}

function montoDeTexto(texto) {
  return Number(soloDigitos(texto));
}

/** Verdad de referencia, en los nombres de campo de `ContractFormData`. */
function verdadDe(contrato, archivo, plantilla, perfil) {
  return {
    archivo,
    plantilla: plantilla.clave,
    perfil,
    formulario: 'contrato',
    nota: `${plantilla.nombre}, degradado ${perfil}`,
    campos: {
      'employerName~': 'ROSIMAR',
      employerNit: soloDigitos(contrato.nit),
      workerName: contrato.trabajador,
      workerDocumentNumber: soloDigitos(contrato.cedula),
      'workerEmail~': contrato.correoTrabajador.split('@')[1],
      'position~': contrato.cargo,
      salary: String(montoDeTexto(contrato.salario)),
      'executionPlace~': contrato.lugar.split(' - ')[0],
      startDate: contrato.inicioIso,
      ...(contrato.vencimientoIso ? { endDate: contrato.vencimientoIso } : {}),
      ...(mesesDeTexto(contrato.duracion) ? { durationMonths: String(mesesDeTexto(contrato.duracion)) } : {}),
    },
  };
}

async function main() {
  const { chromium } = await cargarPlaywright(RAIZ);
  fs.mkdirSync(SALIDA, { recursive: true });

  const navegador = await chromium.launch({ executablePath: rutaChromium() });
  const contexto = await navegador.newContext({
    viewport: { width: ANCHO_CSS, height: ALTO_CSS },
    deviceScaleFactor: ESCALA,
  });
  const page = await contexto.newPage();

  const documentos = [];
  let n = 0;

  for (const plantilla of PLANTILLAS_CONTRATO) {
    for (let i = 0; i < CONTRATOS.length; i++) {
      const contrato = CONTRATOS[i];
      const perfilNombre = PERFILES_CONTRATO[i % PERFILES_CONTRATO.length];
      const perfil = PERFILES[perfilNombre];

      const { html, paginas } = plantilla.render(contrato);
      await page.setViewportSize({ width: ANCHO_CSS, height: ALTO_CSS * paginas });
      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);

      const imagenes = [];
      for (let p = 0; p < paginas; p++) {
        const captura = await page.screenshot({
          type: 'png',
          clip: { x: 0, y: ALTO_CSS * p, width: ANCHO_CSS, height: ALTO_CSS },
        });
        imagenes.push(await degradar(page, captura.toString('base64'), perfil, 5000 + n * 37 + p));
      }

      const archivo = `CT_${String(n + 1).padStart(2, '0')}_${plantilla.clave}_${perfilNombre}.pdf`;
      fs.writeFileSync(path.join(SALIDA, archivo), pdfDeImagenes(imagenes, perfil, n));
      documentos.push(verdadDe(contrato, archivo, plantilla, perfilNombre));
      process.stdout.write(`  ${archivo}\n`);
      n++;
    }
  }

  await navegador.close();

  fs.mkdirSync(FIXTURES, { recursive: true });
  fs.writeFileSync(
    path.join(FIXTURES, 'ground-truth-contratos.json'),
    `${JSON.stringify(
      {
        _convencion: {
          campo: 'igualdad tras normalizar espacios, mayusculas y tildes',
          'campo~': 'el valor esperado debe estar contenido en el extraido',
        },
        _origen:
          'Generado por scripts/generar-contratos-escaneados.mjs. No editar a mano.',
        documentos,
      },
      null,
      2
    )}\n`
  );

  console.log(`\n${documentos.length} contratos escaneados -> ${SALIDA}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
