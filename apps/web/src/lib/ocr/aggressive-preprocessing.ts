/**
 * Estrategia de mejora agresiva para campos débiles:
 * Aplica preprocesamiento más fuerte cuando detecta documentos problemáticos
 */

/**
 * Clasificador rápido de documentos problemáticos
 * Retorna level 0 (fácil) a 3 (muy difícil)
 */
export function clasificarDificultadDocumento(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 1;

  // Muestreo: tomar puntos en la imagen
  const w = canvas.width;
  const h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Calcular contraste global
  let minGray = 255, maxGray = 0;
  let sumGray = 0;
  let pixelCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
    minGray = Math.min(minGray, gray);
    maxGray = Math.max(maxGray, gray);
    sumGray += gray;
    pixelCount++;
  }

  const contraste = maxGray - minGray;
  const promedioGray = sumGray / pixelCount;

  // Clasificar por contraste
  if (contraste < 50) return 3; // Muy bajo contraste
  if (contraste < 100) return 2; // Bajo contraste
  if (contraste < 150) return 1; // Contraste normal
  return 0; // Alto contraste (fácil)
}

/**
 * Aplica preprocesamiento selectivo basado en dificultad
 */
export function aplicarPreprocesamientoSelectivo(
  canvas: HTMLCanvasElement,
  dificultad: number
): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Dificultad 0-1: Sin cambios (documentos claros)
  if (dificultad <= 1) return canvas;

  // Dificultad 2: CLAHE selectivo
  if (dificultad === 2) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const mejorado = aplicarCLAHEAgresivo(imageData, 80); // clipLimit moderado
    ctx.putImageData(mejorado, 0, 0);
    return canvas;
  }

  // Dificultad 3: CLAHE muy agresivo + erosión
  if (dificultad === 3) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let mejorado = aplicarCLAHEAgresivo(imageData, 150); // clipLimit muy alto
    ctx.putImageData(mejorado, 0, 0);

    // Aplicar erosión leve para separar caracteres
    const imageData2 = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const erosionado = aplicarErosion(imageData2, 1);
    ctx.putImageData(erosionado, 0, 0);
  }

  return canvas;
}

/**
 * CLAHE agresivo (versión simplificada pero efectiva)
 */
function aplicarCLAHEAgresivo(imageData: ImageData, clipLimit: number): ImageData {
  const data = imageData.data;
  const w = imageData.width;
  const h = imageData.height;

  // Parámetros adaptativos basados en clipLimit
  const blockSize = Math.max(8, Math.floor(w / 20)); // Bloques más grandes en documentos pequeños
  const numBlocks = Math.ceil(w / blockSize) * Math.ceil(h / blockSize);

  // Para cada píxel, calcular un histograma local
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;

      // Bloque local alrededor del píxel
      const bx = Math.max(0, x - blockSize / 2);
      const by = Math.max(0, y - blockSize / 2);
      const bw = Math.min(w - bx, blockSize);
      const bh = Math.min(h - by, blockSize);

      // Contar píxeles por nivel de gris
      const hist = new Array(256).fill(0);
      for (let yy = by; yy < by + bh; yy++) {
        for (let xx = bx; xx < bx + bw; xx++) {
          const gray = Math.round((data[(yy * w + xx) * 4] + data[(yy * w + xx) * 4 + 1] + data[(yy * w + xx) * 4 + 2]) / 3);
          hist[gray]++;
        }
      }

      // Aplicar clip
      const binSize = (bw * bh) / 256;
      const clipped = hist.map(h => Math.min(h, (clipLimit * binSize) / 100));

      // Calcular CDF
      const cdf = [];
      let sum = 0;
      for (let i = 0; i < 256; i++) {
        sum += clipped[i];
        cdf[i] = Math.round((sum / (bw * bh)) * 255);
      }

      // Mapear píxel actual
      const gray = Math.round((data[idx] + data[idx + 1] + data[idx + 2]) / 3);
      const mapped = cdf[Math.min(255, gray)];

      data[idx] = mapped;
      data[idx + 1] = mapped;
      data[idx + 2] = mapped;
    }
  }

  return imageData;
}

/**
 * Erosión: reduce píxeles blancos (útil para separar caracteres tocados)
 */
function aplicarErosion(imageData: ImageData, radio: number): ImageData {
  const data = imageData.data;
  const w = imageData.width;
  const h = imageData.height;
  const output = new Uint8ClampedArray(data);

  for (let y = radio; y < h - radio; y++) {
    for (let x = radio; x < w - radio; x++) {
      const idx = (y * w + x) * 4;

      // Encontrar mínimo en ventana
      let minGray = 255;
      for (let yy = y - radio; yy <= y + radio; yy++) {
        for (let xx = x - radio; xx <= x + radio; xx++) {
          const grayIdx = (yy * w + xx) * 4;
          const gray = (data[grayIdx] + data[grayIdx + 1] + data[grayIdx + 2]) / 3;
          minGray = Math.min(minGray, gray);
        }
      }

      output[idx] = minGray;
      output[idx + 1] = minGray;
      output[idx + 2] = minGray;
    }
  }

  imageData.data.set(output);
  return imageData;
}

/**
 * Integración con el pipeline OCR existente
 */
export function aplicarPreprocesamientoPrimary(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const dificultad = clasificarDificultadDocumento(canvas);
  
  if (dificultad > 1) {
    console.log(`[OCR] Documento dificultad ${dificultad}, aplicando preprocesamiento agresivo`);
    return aplicarPreprocesamientoSelectivo(canvas, dificultad);
  }

  return canvas;
}
