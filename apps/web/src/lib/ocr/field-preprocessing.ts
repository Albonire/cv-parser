/**
 * Preprocesamiento selectivo para campos débiles que son destruidos por OCR
 * Aplica transformaciones específicas ANTES de que el OCR vea la imagen
 */
import { preprocessImage } from './image-prep';

/**
 * Detecta región probable de contacto (email/teléfono) en la imagen
 * Usualmente están en los primeros renglones o en un encabezado
 * @returns área de imagen [x, y, width, height] o null si no se detecta
 */
export function detectarRegionContacto(canvas: HTMLCanvasElement): [number, number, number, number] | null {
  // Los contactos suelen estar en el top 30% de la página
  const height = canvas.height;
  const topHeight = Math.min(height * 0.3, 300); // Max 300px o 30% del alto
  
  return [0, 0, canvas.width, topHeight];
}

/**
 * Extrae y realza la región probable de contacto
 * Aplica CLAHE más agresivo solo a esta región
 */
export function extraerYRealzarContacto(canvas: HTMLCanvasElement): HTMLCanvasElement | null {
  const region = detectarRegionContacto(canvas);
  if (!region) return null;

  const [x, y, w, h] = region;
  
  // Crear canvas de la región
  const regionCanvas = document.createElement('canvas');
  regionCanvas.width = w;
  regionCanvas.height = h;
  const ctx = regionCanvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);

  // Aplicar preprocessing más agresivo a región de contacto
  const imageData = ctx.getImageData(0, 0, w, h);
  
  // CLAHE más agresivo (contraste < 120 en lugar de < 90)
  const claheAgresivo = aplicarCLAHEAgresivo(imageData);
  ctx.putImageData(claheAgresivo, 0, 0);

  return regionCanvas;
}

/**
 * CLAHE más agresivo para regiones específicas
 */
function aplicarCLAHEAgresivo(imageData: ImageData): ImageData {
  const data = imageData.data;
  const w = imageData.width;
  const h = imageData.height;
  
  // Parámetros más agresivos
  const blockSize = 16; // Más pequeño = más local, más agresivo
  const clipLimit = 2.5; // Más alto = más contraste
  
  // Implementación simplificada de CLAHE
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      
      // Calcular histograma local del bloque
      const bx = Math.max(0, x - blockSize / 2);
      const by = Math.max(0, y - blockSize / 2);
      const bw = Math.min(w - bx, blockSize);
      const bh = Math.min(h - by, blockSize);
      
      const hist = new Array(256).fill(0);
      
      for (let yy = by; yy < by + bh; yy++) {
        for (let xx = bx; xx < bx + bw; xx++) {
          const grayIdx = (yy * w + xx) * 4;
          const gray = (data[grayIdx] + data[grayIdx + 1] + data[grayIdx + 2]) / 3;
          hist[Math.floor(gray)]++;
        }
      }
      
      // Aplicar clip y normalizar
      const binSize = bw * bh / 256;
      const clipped = hist.map(h => Math.min(h, clipLimit * binSize));
      
      // CDF
      const cdf = [];
      let sum = 0;
      for (let i = 0; i < 256; i++) {
        sum += clipped[i];
        cdf[i] = (sum / (bw * bh)) * 255;
      }
      
      // Mapeo del píxel
      const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      const mapped = Math.round(cdf[Math.floor(gray)]);
      
      data[idx] = mapped;
      data[idx + 1] = mapped;
      data[idx + 2] = mapped;
    }
  }
  
  return imageData;
}

/**
 * Detecta campos sospechosos que podrían beneficiarse de preprocesamiento adicional
 */
export interface FieldSuspicion {
  email: {
    confidence: number; // 0-1, qué tan confiado está el OCR
    suspicion: string[]; // ["missing_at", "invalid_domain", etc]
  };
  phone: {
    confidence: number;
    suspicion: string[];
  };
  company: {
    confidence: number;
    suspicion: string[];
  };
  position: {
    confidence: number;
    suspicion: string[];
  };
}

/**
 * Analiza los campos extraídos y marca cuáles son sospechosos
 */
export function analizarSospecha(datosExtraidos: {
  email?: string;
  phone?: string;
  company?: string;
  position?: string;
}): FieldSuspicion {
  return {
    email: {
      confidence: datosExtraidos.email ? 0.8 : 0,
      suspicion: [
        !datosExtraidos.email ? 'missing_completely' : '',
        datosExtraidos.email && !datosExtraidos.email.includes('@') ? 'missing_at' : '',
        datosExtraidos.email && !/\.[a-z]{2,}$/.test(datosExtraidos.email) ? 'invalid_domain' : '',
      ].filter(x => x)
    },
    phone: {
      confidence: datosExtraidos.phone ? 0.75 : 0,
      suspicion: [
        !datosExtraidos.phone ? 'missing_completely' : '',
        datosExtraidos.phone && datosExtraidos.phone.length < 7 ? 'too_short' : '',
        datosExtraidos.phone && !/\d{7,}/.test(datosExtraidos.phone) ? 'insufficient_digits' : '',
      ].filter(x => x)
    },
    company: {
      confidence: datosExtraidos.company ? 0.7 : 0,
      suspicion: [
        !datosExtraidos.company ? 'missing_completely' : '',
        datosExtraidos.company && datosExtraidos.company.length < 2 ? 'too_short' : '',
        datosExtraidos.company && /^\d+$/.test(datosExtraidos.company) ? 'all_numbers' : '',
      ].filter(x => x)
    },
    position: {
      confidence: datosExtraidos.position ? 0.65 : 0,
      suspicion: [
        !datosExtraidos.position ? 'missing_completely' : '',
        datosExtraidos.position && datosExtraidos.position.length < 3 ? 'too_short' : '',
        datosExtraidos.position && /^\d+$/.test(datosExtraidos.position) ? 'all_numbers' : '',
      ].filter(x => x)
    }
  };
}

/**
 * Estrategia para mejorar campos débiles:
 * 1. Si el OCR tiene baja confianza en email/phone, aplicar preprocessing más agresivo
 * 2. Si no se detectaron, buscar en regiones alternativas
 * 3. Usar validación selectiva para eliminar imposibilidades
 */
export function estrategiaExtraccionCampoDebil(
  tipoDocumento: string,
  datosExtraidos: any
): {
  necesitaReprocesamiento: boolean;
  razon: string;
  recomendaciones: string[];
} {
  const suspicion = analizarSospecha(datosExtraidos);
  
  const problemas: string[] = [];
  
  if (suspicion.email.suspicion.length > 0) {
    problemas.push(`Email sospechoso: ${suspicion.email.suspicion.join(', ')}`);
  }
  
  if (suspicion.phone.suspicion.length > 0) {
    problemas.push(`Phone sospechoso: ${suspicion.phone.suspicion.join(', ')}`);
  }
  
  if (suspicion.company.suspicion.length > 0) {
    problemas.push(`Company sospechoso: ${suspicion.company.suspicion.join(', ')}`);
  }
  
  if (suspicion.position.suspicion.length > 0) {
    problemas.push(`Position sospechoso: ${suspicion.position.suspicion.join(', ')}`);
  }
  
  return {
    necesitaReprocesamiento: problemas.length >= 2,
    razon: problemas[0] || 'Sin problemas detectados',
    recomendaciones: [
      suspicion.email.suspicion.includes('missing_completely') ? 'Buscar email en encabezado' : '',
      suspicion.phone.suspicion.includes('missing_completely') ? 'Buscar teléfono en sección contacto' : '',
      suspicion.company.suspicion.includes('all_numbers') ? 'Company es probablemente un error OCR' : '',
      suspicion.position.suspicion.includes('all_numbers') ? 'Position es probablemente un error OCR' : '',
    ].filter(x => x)
  };
}
