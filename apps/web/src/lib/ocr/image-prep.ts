/**
 * Preprocesamiento de imagenes en Canvas para mejorar la precision del OCR.
 *
 * Aplica, en este orden: reescalado a una resolucion util para Tesseract,
 * escala de grises, binarizacion con umbral LOCAL (Sauvola) y correccion de
 * inclinacion.
 * Todo con Canvas puro: sin dependencias nuevas y sin costo.
 */

/** Ancho minimo en pixeles. Tesseract degrada bastante por debajo de este valor. */
const ANCHO_OBJETIVO = 2000;
/** Tope de pixeles para no agotar la memoria del navegador en fotos grandes. */
const MAX_PIXELES = 6_000_000;
/** Rango de busqueda de inclinacion, en grados. */
const MAX_INCLINACION = 5;
const PASO_INCLINACION = 0.5;
/**
 * Lado de la ventana del umbral local, como fraccion del ancho de la imagen.
 * Debe ser holgadamente mayor que un caracter y menor que un bloque de texto.
 */
const FRACCION_VENTANA = 1 / 50;
const VENTANA_MINIMA = 15;
/** Sensibilidad de Sauvola. Mas alto adelgaza el trazo; mas bajo ensucia el fondo. 
 * Valores: 0.15-0.35. Usamos adaptativo basado en contraste.
 */
const K_SAUVOLA = 0.22;
const K_SAUVOLA_BAJO_CONTRASTE = 0.28;  // Más agresivo para documentos oscuros
/** Dinamica de la desviacion tipica en la formula de Sauvola. */
const R_SAUVOLA = 128;
/**
 * Media local por debajo de la cual la vecindad se considera invertida: fondo
 * oscuro con letra clara, como la barra lateral de color o la cabecera a sangre
 * que traen muchas plantillas de hoja de vida.
 */
const MEDIA_REGION_OSCURA = 110;

export interface OpcionesPreproceso {
  binarizar?: boolean;
  corregirInclinacion?: boolean;
}

/** Giros gruesos que se prueban para detectar la orientacion de la pagina. */
export type GiroPagina = 0 | 90 | 180 | 270;

/**
 * Devuelve la imagen girada, en escala de grises y reducida al ancho pedido.
 *
 * Se usa para sondear la orientacion: el giro grueso no se puede estimar con el
 * perfil de proyeccion de `estimarInclinacion()`, que solo cubre mas o menos
 * cinco grados, y sondear la pagina a resolucion completa costaria mas que el
 * propio OCR.
 */
export async function muestraGirada(
  fuente: File | Blob | HTMLCanvasElement,
  grados: GiroPagina,
  anchoObjetivo: number
): Promise<HTMLCanvasElement> {
  const bitmap =
    fuente instanceof HTMLCanvasElement
      ? fuente
      : await cargarImagen(fuente);

  const trasponer = grados === 90 || grados === 270;
  const anchoOrigen = trasponer ? bitmap.height : bitmap.width;
  const escala = Math.min(1, anchoObjetivo / anchoOrigen);

  const ancho = Math.round((trasponer ? bitmap.height : bitmap.width) * escala);
  const alto = Math.round((trasponer ? bitmap.width : bitmap.height) * escala);

  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ancho, alto);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(ancho / 2, alto / 2);
  ctx.rotate((grados * Math.PI) / 180);
  ctx.drawImage(
    bitmap,
    (-bitmap.width * escala) / 2,
    (-bitmap.height * escala) / 2,
    bitmap.width * escala,
    bitmap.height * escala
  );

  return canvas;
}

/**
 * Aplica un giro grueso a la imagen completa, sin reducirla. Devuelve siempre un
 * Blob para que el resto del preprocesado tenga un solo tipo de entrada.
 */
export async function girarImagen(
  fuente: File | Blob,
  grados: GiroPagina
): Promise<File | Blob> {
  if (grados === 0) return fuente;

  const canvas = await muestraGirada(fuente, grados, Number.MAX_SAFE_INTEGER);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), 'image/png'));
  return blob ?? fuente;
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
  let gris = aEscalaDeGrises(imageData);

  // Aplica CLAHE SOLO para documentos con bajo contraste (foto de celular)
  // Aqui vivia una llamada a CLAHE para las fotos de bajo contraste. Se retira
  // con el numero delante: nunca llego a ejecutarse (el limite de recorte estaba
  // mal calculado y la medida de contraste saturaba), y al corregir ambas cosas
  // resulto que HUNDE el perfil duro del banco de escaneos, de 51,0% a 3,9%, y
  // duplica el tiempo por documento.
  //
  // El motivo es que no era CLAHE: pese al comentario, no interpolaba entre
  // bloques, asi que dejaba costuras duras cada 64 px que el OCR no perdona, y
  // recalculaba la funcion acumulada para cada pixel. Si alguna vez hace falta,
  // hay que interpolar bilinealmente entre los centros de los bloques y medirlo
  // con `npm run bench:ocr` antes de darlo por bueno.
  const contraste = calcularContraste(gris);

  if (binarizar) {
    binarizarLocal(imageData, gris, canvas.width, canvas.height);
  } else {
    escribirGris(imageData, gris);
  }

  ctx.putImageData(imageData, 0, 0);

  const listo = corregirInclinacion ? await enderezar(canvas, gris) : canvas;

  const blob = await new Promise<Blob | null>((res) => listo.toBlob((b) => res(b), 'image/png'));
  return blob ?? imageFile;
}

/** Calcula el contraste global como diferencia max-min en la escala de grises */
function calcularContraste(gris: Uint8ClampedArray): number {
  // Por percentiles, no por maximo menos minimo: una sola mota negra y otra
  // blanca -- garantizadas en cualquier foto -- llevaban la medida a 255 y la
  // condicion de bajo contraste no se cumplia nunca. Es la misma tecnica que ya
  // usa `ecualizarContraste()` mas abajo en este archivo.
  const histograma = new Uint32Array(256);
  for (let i = 0; i < gris.length; i++) histograma[gris[i]]++;

  const total = gris.length;
  const objetivoBajo = total * 0.02;
  const objetivoAlto = total * 0.98;

  let acumulado = 0;
  let p2 = 0;
  let p98 = 255;
  let bajoHecho = false;

  for (let v = 0; v < 256; v++) {
    acumulado += histograma[v];
    if (!bajoHecho && acumulado >= objetivoBajo) {
      p2 = v;
      bajoHecho = true;
    }
    if (acumulado >= objetivoAlto) {
      p98 = v;
      break;
    }
  }

  return p98 - p2;
}

async function cargarImagen(
  file: File | Blob
): Promise<CanvasImageSource & { width: number; height: number }> {
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
 *
 * Se conserva como referencia y como respaldo para imagenes muy pequenas, pero
 * ya NO es lo que se aplica a la pagina completa. Otsu elige UN solo umbral
 * para toda la imagen, asi que en un escaneo con vinieta o con la sombra del
 * pliegue inunda de negro los bordes y borra los bloques de fondo gris. Medido
 * sobre el banco de escaneos: con Otsu global, cuatro documentos del perfil
 * duro devolvian entre 0 y 101 caracteres; con el umbral local de abajo, los
 * mismos devuelven entre 451 y 2.528.
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
 * Erosión morfológica: reduce áreas blancas.
 * Útil para separar texto pegado o eliminar ruido.
 */
function erosionar(
  imageData: ImageData,
  width: number,
  height: number,
  radio: number = 1
): void {
  const { data } = imageData;
  const temporal = new Uint8ClampedArray(width * height);
  
  for (let i = 0; i < data.length; i += 4) {
    temporal[i / 4] = data[i];
  }
  
  for (let y = radio; y < height - radio; y++) {
    for (let x = radio; x < width - radio; x++) {
      let minValor = 255;
      for (let dy = -radio; dy <= radio; dy++) {
        for (let dx = -radio; dx <= radio; dx++) {
          const idx = (y + dy) * width + (x + dx);
          minValor = Math.min(minValor, temporal[idx]);
        }
      }
      const idx = y * width + x;
      data[idx * 4] = data[idx * 4 + 1] = data[idx * 4 + 2] = minValor;
      data[idx * 4 + 3] = 255;
    }
  }
}

/**
 * Dilatación morfológica: expande áreas blancas.
 * Útil para conectar caracteres quebrados.
 */
function dilatar(
  imageData: ImageData,
  width: number,
  height: number,
  radio: number = 1
): void {
  const { data } = imageData;
  const temporal = new Uint8ClampedArray(width * height);
  
  for (let i = 0; i < data.length; i += 4) {
    temporal[i / 4] = data[i];
  }
  
  for (let y = radio; y < height - radio; y++) {
    for (let x = radio; x < width - radio; x++) {
      let maxValor = 0;
      for (let dy = -radio; dy <= radio; dy++) {
        for (let dx = -radio; dx <= radio; dx++) {
          const idx = (y + dy) * width + (x + dx);
          maxValor = Math.max(maxValor, temporal[idx]);
        }
      }
      const idx = y * width + x;
      data[idx * 4] = data[idx * 4 + 1] = data[idx * 4 + 2] = maxValor;
      data[idx * 4 + 3] = 255;
    }
  }
}

/**
 * Umbral local de Sauvola calculado con imagenes integrales.
 *
 * Cada pixel se compara contra la media y la desviacion tipica de su vecindad
 * en vez de contra un umbral unico de toda la pagina, que es lo que permite
 * leer una hoja con sombra lateral o iluminacion desigual. Las sumas
 * acumuladas hacen que el coste no dependa del tamano de la ventana: dos
 * recorridos de la imagen y nada mas.
 *
 * Si la imagen es demasiado pequena para una ventana util, se cae a Otsu.
 * Para documentos con bajo contraste (fotos de celular, escaneos antiguos),
 * se adapta el parametro K de Sauvola para ser más agresivo.
 */
export function binarizarLocal(
  imageData: ImageData,
  gris: Uint8ClampedArray,
  width: number,
  height: number
): void {
  const ventana = Math.max(VENTANA_MINIMA, Math.round(width * FRACCION_VENTANA) | 1);

  if (width < ventana * 2 || height < ventana * 2) {
    binarizarEnSitio(imageData, gris, umbralOtsu(gris));
    return;
  }

  // Detecta contraste global para adaptar sensibilidad
  let minVal = 255;
  let maxVal = 0;
  for (let i = 0; i < gris.length; i++) {
    minVal = Math.min(minVal, gris[i]);
    maxVal = Math.max(maxVal, gris[i]);
  }
  const contraste = maxVal - minVal;
  const kAdaptativo = contraste < 100 ? K_SAUVOLA_BAJO_CONTRASTE : K_SAUVOLA;

  const radio = Math.floor(ventana / 2);
  const ancho = width + 1;
  const suma = new Float64Array(ancho * (height + 1));
  const sumaCuadrados = new Float64Array(ancho * (height + 1));

  for (let y = 1; y <= height; y++) {
    for (let x = 1; x <= width; x++) {
      const valor = gris[(y - 1) * width + (x - 1)];
      const i = y * ancho + x;
      suma[i] = valor + suma[i - 1] + suma[i - ancho] - suma[i - ancho - 1];
      sumaCuadrados[i] =
        valor * valor + sumaCuadrados[i - 1] + sumaCuadrados[i - ancho] - sumaCuadrados[i - ancho - 1];
    }
  }

  const { data } = imageData;

  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radio);
    const y1 = Math.min(height - 1, y + radio);

    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radio);
      const x1 = Math.min(width - 1, x + radio);

      const abajo = (y1 + 1) * ancho;
      const arriba = y0 * ancho;
      const derecha = x1 + 1;
      const izquierda = x0;
      const n = (y1 - y0 + 1) * (x1 - x0 + 1);

      const total =
        suma[abajo + derecha] - suma[arriba + derecha] - suma[abajo + izquierda] + suma[arriba + izquierda];
      const total2 =
        sumaCuadrados[abajo + derecha] -
        sumaCuadrados[arriba + derecha] -
        sumaCuadrados[abajo + izquierda] +
        sumaCuadrados[arriba + izquierda];

      const media = total / n;
      const desviacion = Math.sqrt(Math.max(0, total2 / n - media * media));
      const p = y * width + x;

      // En una vecindad oscura se invierte antes de umbralizar. Sauvola supone
      // tinta oscura sobre papel claro: aplicado tal cual a una barra lateral
      // de color, deja el fondo en blanco y se lleva por delante la letra
      // clara. Invertir es una transformacion afin, asi que la media se
      // refleja y la desviacion no cambia.
      const invertir = media < MEDIA_REGION_OSCURA;
      const valorPixel = invertir ? 255 - gris[p] : gris[p];
      const mediaUtil = invertir ? 255 - media : media;
      const umbral = mediaUtil * (1 + kAdaptativo * (desviacion / R_SAUVOLA - 1));

      const i = p * 4;
      const valor = valorPixel > umbral ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = valor;
      data[i + 3] = 255;
    }
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

/**
 * Tamaño de imagen consolidada para el expediente: se busca que la foto quede
 * con resolucion util de lectura (minimo de 1600 px en el lado corto) sin
 * superar el tope de pixeles, para no inflar el IndexedDB.
 */
const ANCHO_LADO_CORTO = 1600;
const MAX_PIXELES_GUARDADO = 5_000_000;
/** Calidad JPEG de la imagen guardada: compensa un poco el tamanio tras el upscale. */
const CALIDAD_JPEG_GUARDADO = 0.88;

/**
 * Realza una foto para guardarla en el expediente: sube la resolucion con
 * interpolacion de alta calidad, ecualiza el contraste sin llegar a binarizar y
 * aplica una nitidez suave. Pensado sobre todo para la cedula: el dato que se
 * guarda es la IMAGEN legible, no su OCR.
 */
export async function realzarImagen(imageFile: File | Blob): Promise<Blob> {
  const bitmap = await cargarImagen(imageFile);

  let ladoCorto = Math.min(bitmap.width, bitmap.height);
  let escala = ladoCorto >= ANCHO_LADO_CORTO ? 1 : ANCHO_LADO_CORTO / ladoCorto;
  if (bitmap.width * bitmap.height * escala * escala > MAX_PIXELES_GUARDADO) {
    escala = Math.sqrt(MAX_PIXELES_GUARDADO / (bitmap.width * bitmap.height));
  }
  escala = Math.max(0.25, escala);

  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return imageFile;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);

  let imageData = ctx.getImageData(0, 0, w, h);
  imageData = ecualizarContraste(imageData);
  imageData = nitidezSuave(imageData);

  ctx.putImageData(imageData, 0, 0);

  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob((b) => res(b), 'image/jpeg', CALIDAD_JPEG_GUARDADO)
  );
  return blob ?? imageFile;
}

/** Extiende el histograma de luminancia para recuperar contraste en fotos planas. */
function ecualizarContraste(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const gris = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gris[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  const orden = Float32Array.from(gris).sort();
  const pMin = orden[Math.floor(orden.length * 0.02)];
  const pMax = orden[Math.min(orden.length - 1, Math.floor(orden.length * 0.98))];
  const rango = Math.max(1, pMax - pMin);
  const factor = 255 / rango;

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    for (let c = 0; c < 3; c++) {
      const v = Math.round((data[i + c] - pMin) * factor);
      data[i + c] = Math.max(0, Math.min(255, v));
    }
  }
  return imageData;
}

/** Nitidez ligera (mascara de desenfoque con vecindad 3x3) para definir bordes. */
function nitidezSuave(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const orig = new Uint8ClampedArray(data);
  const peso = 0.35;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const o = 4 * (y * width + x) + c;
        const media =
          (orig[o - 4 - width * 4] + orig[o - width * 4] + orig[o + 4 - width * 4] +
           orig[o - 4] + orig[o + 4] +
           orig[o - 4 + width * 4] + orig[o + width * 4] + orig[o + 4 + width * 4]) / 8;
        const v = orig[o] + peso * (orig[o] - media);
        data[i + c] = Math.max(0, Math.min(255, Math.round(v)));
      }
    }
  }
  return imageData;
}
