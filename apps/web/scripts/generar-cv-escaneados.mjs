/**
 * Genera el banco de hojas de vida ESCANEADAS para medir la ruta de OCR.
 *
 * El punto entero del banco es que los PDF resultantes NO tengan capa de texto:
 * `readPdfFile` los clasifica como escaneo (menos de 60 caracteres por pagina) y
 * los manda por Tesseract, que es la ruta que Rosimar va a usar de verdad y la
 * que nunca se habia medido con material representativo.
 *
 * Cadena: HTML -> Chromium -> captura PNG -> degradado de escaner en canvas ->
 * JPEG -> PDF de una sola imagen. No hace falta sharp ni jimp: el navegador ya
 * trae todo lo necesario.
 *
 * Uso: npm run gen:scans
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOJAS_DE_VIDA } from './datos-cv-sinteticos.mjs';
import { PLANTILLAS } from './plantillas-cv.mjs';
import { cargarPlaywright, rutaChromium } from './navegador.mjs';
import {
  ALTO_CSS,
  ANCHO_CSS,
  ESCALA,
  PERFILES,
  degradar,
  pdfDeImagenes,
} from './escaneo.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const SALIDA = path.join(RAIZ, 'test-scans');
const FIXTURES = path.join(RAIZ, 'src', 'lib', 'ocr', '__fixtures__');

/** Plantillas que reciben el registro expandido, para tener hojas de vida largas. */
const PLANTILLAS_LARGAS = new Set(['denso-2p', 'una-columna', 'tabla']);

const REPARTO = [
  'limpio', 'medio', 'limpio', 'duro', 'medio', 'limpio', 'medio', 'duro',
  'limpio', 'medio', 'girado90', 'duro', 'limpio', 'medio', 'medio', 'limpio',
  'duro', 'medio', 'limpio', 'girado180', 'medio', 'duro', 'limpio', 'medio',
  'limpio', 'duro', 'medio', 'limpio', 'medio', 'girado90', 'duro', 'medio',
  'limpio', 'medio', 'duro', 'limpio', 'medio', 'limpio', 'medio', 'duro',
];

/**
 * Empresas y titulos extra para construir hojas de vida largas sin inventar
 * datos incoherentes con el resto del registro. La verdad de referencia se
 * calcula sobre el registro YA expandido, asi que documento y verdad no pueden
 * desincronizarse.
 */
const EMPRESAS_EXTRA = [
  ['Distribuidora Nacional de Insumos SAS', 'Auxiliar de Servicios Generales', 'Febrero 2012 a Diciembre 2014'],
  ['Cooperativa Multiactiva del Oriente', 'Auxiliar Operativo', 'Marzo 2010 a Enero 2012'],
  ['Inversiones Santa Marta Ltda.', 'Asistente de Oficina', 'Julio 2008 a Febrero 2010'],
];
const ESTUDIOS_EXTRA = [
  { nivel: 'Curso', titulo: 'Manejo de Herramientas Ofimáticas', institucion: 'SENA Centro de Comercio', anio: '2014' },
  { nivel: 'Curso', titulo: 'Servicio al Cliente y Comunicación Efectiva', institucion: 'Cámara de Comercio de Bogotá', anio: '2012' },
];

/**
 * Devuelve una version larga del registro: cuatro empleos y hasta tres estudios.
 * Se aplica solo a las plantillas pensadas para hojas de vida extensas, para que
 * el banco tenga documentos largos y cortos como pidio el encargo.
 */
function expandirParaLargo(cv) {
  const faltan = Math.max(0, 4 - cv.experiencia.length);
  const experiencia = [
    ...cv.experiencia,
    ...EMPRESAS_EXTRA.slice(0, faltan).map(([empresa, cargo, fechas]) => ({ empresa, cargo, fechas })),
  ];

  const educacion = [...cv.educacion];
  for (const extra of ESTUDIOS_EXTRA) {
    if (educacion.length >= 3) break;
    educacion.push(extra);
  }

  return { ...cv, experiencia, educacion };
}

/** Convierte los datos de la hoja de vida en la verdad de referencia del banco. */
function verdadDe(cv, archivo, plantilla, perfilNombre) {
  return {
    archivo,
    plantilla: plantilla.clave,
    perfil: perfilNombre,
    nota: `${plantilla.nombre}, degradado ${perfilNombre}`,
    campos: {
      firstNames: cv.nombres,
      lastNames: cv.apellidos,
      documentNumber: cv.cedula,
      email: cv.correo,
      phone: cv.telefono,
      'cityResidence~': cv.ciudad.split(',')[0].trim(),
      'headline~': cv.titular,
      'experience#': cv.experiencia.length,
      'experience[].company': cv.experiencia.map((e) => e.empresa),
      'experience[].position': cv.experiencia.map((e) => e.cargo),
      'education#': cv.educacion.length,
      'education[].institution': cv.educacion.map((e) => e.institucion),
      'education[].degree': cv.educacion.map((e) => e.titulo),
      // Por NOMBRE, no por cantidad. Comparar un recuento daba por buena
      // cualquier coincidencia: la taxonomia incluye los lenguajes 'C', 'R' y
      // 'Go', y una letra suelta del OCR contaba como habilidad encontrada. Con
      // eso, doce hojas de vida administrativas puntuaban dos habilidades que
      // no tenian. Medido: el campo pasaba por 81,3% cuando de verdad estaba
      // en la mitad.
      'skills[].skillName': cv.habilidades,
    },
  };
}

async function main() {
  const { chromium } = await cargarPlaywright(RAIZ);

  fs.rmSync(SALIDA, { recursive: true, force: true });
  fs.mkdirSync(SALIDA, { recursive: true });

  const navegador = await chromium.launch({ executablePath: rutaChromium() });
  const contexto = await navegador.newContext({
    viewport: { width: ANCHO_CSS, height: ALTO_CSS },
    deviceScaleFactor: ESCALA,
  });
  const page = await contexto.newPage();

  const documentos = [];
  const inicio = Date.now();

  for (let i = 0; i < HOJAS_DE_VIDA.length; i++) {
    const cv = HOJAS_DE_VIDA[i];
    const plantilla = PLANTILLAS[i % PLANTILLAS.length];
    const perfilNombre = REPARTO[i % REPARTO.length];
    const perfil = PERFILES[perfilNombre];

    // Las plantillas largas reciben un registro expandido; el resto queda corto.
    const registro = PLANTILLAS_LARGAS.has(plantilla.clave) ? expandirParaLargo(cv) : cv;
    const { html, paginas } = plantilla.render(registro);

    await page.setViewportSize({ width: ANCHO_CSS, height: ALTO_CSS * paginas });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);

    const imagenes = [];
    for (let p = 0; p < paginas; p++) {
      const captura = await page.screenshot({
        type: 'png',
        clip: { x: 0, y: ALTO_CSS * p, width: ANCHO_CSS, height: ALTO_CSS },
      });
      const jpeg = await degradar(page, captura.toString('base64'), perfil, 1000 + i * 31 + p);
      imagenes.push(jpeg);
    }

    const numero = String(i + 1).padStart(2, '0');
    const archivo = `CV_${numero}_${plantilla.clave}_${perfilNombre}.pdf`;
    fs.writeFileSync(path.join(SALIDA, archivo), pdfDeImagenes(imagenes, perfil, i));

    documentos.push(verdadDe(registro, archivo, plantilla, perfilNombre));
    process.stdout.write(`  ${archivo}\n`);
  }

  await navegador.close();

  const verdad = {
    _convencion: {
      campo: 'igualdad tras normalizar espacios, mayusculas y tildes',
      'campo~': 'el valor esperado debe estar contenido en el extraido',
      'campo#': 'la lista extraida debe tener al menos esta cantidad de elementos',
      'campo[]': 'cada valor esperado debe aparecer en la lista extraida',
    },
    _origen:
      'Generado por scripts/generar-cv-escaneados.mjs a partir de scripts/datos-cv-sinteticos.mjs. No editar a mano.',
    documentos,
  };

  fs.mkdirSync(FIXTURES, { recursive: true });
  fs.writeFileSync(
    path.join(FIXTURES, 'ground-truth-escaneados.json'),
    `${JSON.stringify(verdad, null, 2)}\n`
  );

  const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log(`\n${documentos.length} escaneos generados en ${segundos} s -> ${SALIDA}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
