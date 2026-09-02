/**
 * Piezas compartidas para generar bancos de documentos escaneados.
 *
 * El degradado y el montaje del PDF los usan tanto el banco de hojas de vida
 * como el de contratos, asi que viven aqui en vez de duplicarse. Cambiar algo de
 * este archivo cambia LOS DOS bancos: es deliberado, para que las mediciones de
 * uno y otro sigan siendo comparables.
 */

import { jsPDF } from 'jspdf';

/** Hoja carta en pixeles CSS. Con deviceScaleFactor 2 quedan 1700x2200, unos 200 ppp. */
export const ANCHO_CSS = 850;
export const ALTO_CSS = 1100;
export const ESCALA = 2;
/** Hoja carta en puntos PostScript, que es la unidad de jsPDF. */
export const ANCHO_PT = 612;
export const ALTO_PT = 792;

/**
 * Perfiles de degradado, de escaner de oficina a foto de celular.
 * `rotacion` en grados; `giro` es el giro grueso de 90 o 180 grados que hoy el
 * motor no corrige (hallazgo 6 del plan del motor).
 */
export const PERFILES = {
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
/** Generador pseudoaleatorio con semilla: el ruido tiene que ser reproducible. */
export function mulberry32(semilla) {
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
export async function degradar(page, pngBase64, perfil, semilla) {
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


/** Empotra las imagenes degradadas en un PDF de una sola imagen por pagina. */
export function pdfDeImagenes(imagenes, perfil, semillaBase) {
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
    doc.addImage(jpeg, 'JPEG', 0, 0, anchoPt, altoPt, `esc${semillaBase}_${k}`, 'NONE');
  });

  return Buffer.from(doc.output('arraybuffer'));
}
