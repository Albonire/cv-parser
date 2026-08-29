/**
 * Preprocesamiento de imagenes en Canvas para mejorar la precision del OCR.
 *
 * Aplica, en este orden: reescalado a una resolucion util para Tesseract,
 * escala de grises, binarizacion de Otsu y correccion de inclinacion.
 * Todo con Canvas puro: sin dependencias nuevas y sin costo.
 */

/** Ancho minimo en pixeles. Tesseract degrada bastante por debajo de este valor. */
const ANCHO_OBJETIVO = 2000;
/** Tope de pixeles para no agotar la memoria del navegador en fotos grandes. */
const MAX_PIXELES = 6_000_000;
/** Rango de busqueda de inclinacion, en grados. */
const MAX_INCLINACION = 5;
const PASO_INCLINACION = 0.5;

export interface OpcionesPreproceso {
  binarizar?: boolean;
  corregirInclinacion?: boolean;
}

export async function preprocessImage(
  imageFile: File | Blob,
  opciones: OpcionesPreproceso = {}
): Promise<Blob> {
  const { binarizar = true, corregirInclinacion = true } = opciones;

  const bitmap = await cargarImagen(imageFile);
  const escala = escalaDeTrabajo(bitmap.width, bitmap.height);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return imageFile;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const gris = aEscalaDeGrises(imageData);

  if (binarizar) {
    const umbral = umbralOtsu(gris);
    binarizarEnSitio(imageData, gris, umbral);
  } else {
    escribirGris(imageData, gris);
  }

  ctx.putImageData(imageData, 0, 0);

  const listo = corregirInclinacion ? await enderezar(canvas, gris) : canvas;

  const blob = await new Promise<Blob | null>((res) => listo.toBlob((b) => res(b), 'image/png'));
  return blob ?? imageFile;
}

async function cargarImagen(file: File | Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

/** Escala la imagen hacia el ancho objetivo sin pasarse del tope de pixeles. */
function escalaDeTrabajo(width: number, height: number): number {
  let escala = width >= ANCHO_OBJETIVO ? 1 : ANCHO_OBJETIVO / width;
  if (width * height * escala * escala > MAX_PIXELES) {
    escala = Math.sqrt(MAX_PIXELES / (width * height));
  }
  return Math.max(0.25, escala);
}

function aEscalaDeGrises(imageData: ImageData): Uint8ClampedArray {
  const { data } = imageData;
  const gris = new Uint8ClampedArray(data.length / 4);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    // Luminancia ITU-R BT.601
    gris[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  return gris;
}

function escribirGris(imageData: ImageData, gris: Uint8ClampedArray): void {
  const { data } = imageData;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    data[i] = data[i + 1] = data[i + 2] = gris[p];
  }
}

/**
 * Umbral de Otsu: separa texto y fondo maximizando la varianza entre clases.
 * Es lo que el codigo anterior prometia en su comentario pero no hacia: solo
 * aplicaba un realce de contraste fijo, insuficiente para fotos con sombra.
 */
export function umbralOtsu(gris: Uint8ClampedArray): number {
  const histograma = new Array<number>(256).fill(0);
  for (let i = 0; i < gris.length; i++) histograma[gris[i]]++;

  const total = gris.length;
  let sumaTotal = 0;
  for (let t = 0; t < 256; t++) sumaTotal += t * histograma[t];

  let sumaFondo = 0;
  let pesoFondo = 0;
  let mejorVarianza = -1;
  let mejorUmbral = 128;

  for (let t = 0; t < 256; t++) {
    pesoFondo += histograma[t];
    if (pesoFondo === 0) continue;

    const pesoFrente = total - pesoFondo;
    if (pesoFrente === 0) break;

    sumaFondo += t * histograma[t];
    const mediaFondo = sumaFondo / pesoFondo;
    const mediaFrente = (sumaTotal - sumaFondo) / pesoFrente;
    const varianza = pesoFondo * pesoFrente * (mediaFondo - mediaFrente) ** 2;

    if (varianza > mejorVarianza) {
      mejorVarianza = varianza;
      mejorUmbral = t;
    }
  }

  return mejorUmbral;
}

function binarizarEnSitio(imageData: ImageData, gris: Uint8ClampedArray, umbral: number): void {
  const { data } = imageData;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const valor = gris[p] > umbral ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = valor;
    data[i + 3] = 255;
  }
}

/**
 * Estima la inclinacion por perfil de proyeccion: el angulo correcto es el que
 * maximiza el contraste entre renglones de texto y espacios en blanco.
 */
export function estimarInclinacion(
  gris: Uint8ClampedArray,
  width: number,
  height: number
): number {
  let mejorAngulo = 0;
  let mejorPuntaje = -1;

  for (let angulo = -MAX_INCLINACION; angulo <= MAX_INCLINACION; angulo += PASO_INCLINACION) {
    const puntaje = puntajeProyeccion(gris, width, height, (angulo * Math.PI) / 180);
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejorAngulo = angulo;
    }
  }

  return mejorAngulo;
}

function puntajeProyeccion(
  gris: Uint8ClampedArray,
  width: number,
  height: number,
  radianes: number
): number {
  const tan = Math.tan(radianes);
  const filas = new Float64Array(height);
  // Se muestrea la imagen para que la busqueda sea rapida en fotos grandes.
  const pasoX = Math.max(1, Math.floor(width / 400));
  const pasoY = Math.max(1, Math.floor(height / 400));

  for (let y = 0; y < height; y += pasoY) {
    for (let x = 0; x < width; x += pasoX) {
      const yr = Math.round(y + (x - width / 2) * tan);
      if (yr < 0 || yr >= height) continue;
      // Pixel oscuro = tinta
      if (gris[y * width + x] < 128) filas[yr]++;
    }
  }

  let puntaje = 0;
  for (let y = 1; y < height; y++) {
    const delta = filas[y] - filas[y - 1];
    puntaje += delta * delta;
  }
  return puntaje;
}

async function enderezar(canvas: HTMLCanvasElement, gris: Uint8ClampedArray): Promise<HTMLCanvasElement> {
  const angulo = estimarInclinacion(gris, canvas.width, canvas.height);
  if (Math.abs(angulo) < PASO_INCLINACION) return canvas;

  const destino = document.createElement('canvas');
  destino.width = canvas.width;
  destino.height = canvas.height;

  const ctx = destino.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, destino.width, destino.height);
  ctx.translate(destino.width / 2, destino.height / 2);
  ctx.rotate((-angulo * Math.PI) / 180);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

  return destino;
}
