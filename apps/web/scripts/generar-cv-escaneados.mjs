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
import { jsPDF } from 'jspdf';
import { HOJAS_DE_VIDA } from './datos-cv-sinteticos.mjs';
import { PLANTILLAS } from './plantillas-cv.mjs';
import { cargarPlaywright, rutaChromium } from './navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const SALIDA = path.join(RAIZ, 'test-scans');
const FIXTURES = path.join(RAIZ, 'src', 'lib', 'ocr', '__fixtures__');

/** Hoja carta en pixeles CSS. Con deviceScaleFactor 2 quedan 1700x2200, unos 200 ppp. */
const ANCHO_CSS = 850;
const ALTO_CSS = 1100;
const ESCALA = 2;
/** Hoja carta en puntos PostScript, que es la unidad de jsPDF. */
const ANCHO_PT = 612;
const ALTO_PT = 792;

/**
 * Perfiles de degradado, de escaner de oficina a foto de celular.
 * `rotacion` en grados; `giro` es el giro grueso de 90 o 180 grados que hoy el
 * motor no corrige (hallazgo 6 del plan del motor).
 */
const PERFILES = {
  limpio: { contraste: 0.95, brillo: -2, ruido: 5, desenfoque: 0.3, rotacion: 0.3, vinieta: 0.06, franja: 0, motas: 0.00005, calidad: 0.86, giro: 0 },
  medio: { contraste: 0.78, brillo: 8, ruido: 11, desenfoque: 0.6, rotacion: 1.0, vinieta: 0.16, franja: 0.10, motas: 0.0004, calidad: 0.62, giro: 0 },
  duro: { contraste: 0.64, brillo: 13, ruido: 16, desenfoque: 0.9, rotacion: 2.2, vinieta: 0.28, franja: 0.20, motas: 0.0011, calidad: 0.45, giro: 0 },
  girado90: { contraste: 0.80, brillo: 6, ruido: 10, desenfoque: 0.6, rotacion: 0.8, vinieta: 0.14, franja: 0.08, motas: 0.0003, calidad: 0.62, giro: 90 },
  girado180: { contraste: 0.80, brillo: 6, ruido: 10, desenfoque: 0.6, rotacion: 0.8, vinieta: 0.14, franja: 0.08, motas: 0.0003, calidad: 0.62, giro: 180 },
};

/**
 * Reparto de perfiles sobre los 40 documentos. Se escribe a mano en vez de
 * sortearse para que el banco sea siempre el mismo y las comparaciones entre
 * ejecuciones signifiquen algo.
 */
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

/** Generador pseudoaleatorio con semilla: el ruido tiene que ser reproducible. */
function mulberry32(semilla) {
  return function () {
    semilla |= 0;
    semilla = (semilla + 0x6d2b79f5) | 0;
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Degradado de escaner, ejecutado dentro del navegador.
 * Se define como cadena y se evalua con page.evaluate para que quede claro que
 * corre en el contexto de la pagina, no en Node.
 */
async function degradar(page, pngBase64, perfil, semilla) {
  return page.evaluate(
    async ({ pngBase64, perfil, semilla }) => {
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = `data:image/png;base64,${pngBase64}`;
      });

      const giroRad = (perfil.giro * Math.PI) / 180;
      const trasponer = perfil.giro === 90 || perfil.giro === 270;
      const W = trasponer ? img.height : img.width;
      const H = trasponer ? img.width : img.height;

      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      // Giro grueso (90/180) mas la inclinacion fina del papel en el cristal.
      const rnd0 = (function (s) {
        return function () {
          s |= 0;
          s = (s + 0x6d2b79f5) | 0;
          let t = Math.imul(s ^ (s >>> 15), 1 | s);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      })(semilla);

      const inclinacion = (rnd0() * 2 - 1) * perfil.rotacion;
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(giroRad + (inclinacion * Math.PI) / 180);
      ctx.filter = `blur(${perfil.desenfoque}px)`;
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();

      const datos = ctx.getImageData(0, 0, W, H);
      const px = datos.data;
      const rnd = rnd0;
      const cx = W / 2;
      const cy = H / 2;
      const radioMax = Math.hypot(cx, cy);
      // Direccion de la sombra lateral, como cuando la hoja no queda plana.
      const dirFranja = rnd() > 0.5 ? 1 : -1;

      for (let y = 0; y < H; y++) {
        const ny = (y - cy) / radioMax;
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          const nx = (x - cx) / radioMax;

          // Iluminacion desigual: vinieta radial mas una franja lateral.
          const dist2 = nx * nx + ny * ny;
          const posFranja = dirFranja > 0 ? x / W : 1 - x / W;
          const luz = 1 - perfil.vinieta * dist2 - perfil.franja * posFranja * posFranja;

          let v = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
          v *= luz;
          // Perdida de contraste tipica de fotocopia, alrededor del gris medio.
          v = (v / 255 - 0.5) * perfil.contraste * 255 + 127.5 + perfil.brillo;

          // Ruido gaussiano por Box-Muller.
          const u1 = Math.max(1e-6, rnd());
          const u2 = rnd();
          const g = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
          v += g * perfil.ruido;

          // Motas de polvo y suciedad del cristal.
          if (rnd() < perfil.motas) v -= 90;

          const c = v < 0 ? 0 : v > 255 ? 255 : v;
          px[i] = px[i + 1] = px[i + 2] = c;
          px[i + 3] = 255;
        }
      }

      ctx.putImageData(datos, 0, 0);
      return canvas.toDataURL('image/jpeg', perfil.calidad);
    },
    { pngBase64, perfil, semilla }
  );
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
      'skills#': Math.min(2, cv.habilidades.length),
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

    const apaisado = perfil.giro === 90 || perfil.giro === 270;
    const anchoPt = apaisado ? ALTO_PT : ANCHO_PT;
    const altoPt = apaisado ? ANCHO_PT : ALTO_PT;

    const doc = new jsPDF({
      orientation: apaisado ? 'landscape' : 'portrait',
      unit: 'pt',
      format: 'letter',
    });

    imagenes.forEach((jpeg, k) => {
      if (k > 0) doc.addPage('letter', apaisado ? 'landscape' : 'portrait');
      doc.addImage(jpeg, 'JPEG', 0, 0, anchoPt, altoPt, `esc${i}_${k}`, 'NONE');
    });

    const numero = String(i + 1).padStart(2, '0');
    const archivo = `CV_${numero}_${plantilla.clave}_${perfilNombre}.pdf`;
    fs.writeFileSync(path.join(SALIDA, archivo), Buffer.from(doc.output('arraybuffer')));

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
