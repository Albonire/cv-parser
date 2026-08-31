import { unzipSync } from 'fflate';

/**
 * Extraccion de archivos de lectura desde un ZIP en el navegador (costo $0).
 *
 * El lector acepta un ZIP con varias fotos/escaneos del mismo empleado (p. ej.
 * su hoja de vida partida, su contrato y su EPS). Esto descomprime el archivo
 * en la CPU del usuario y devuelve los archivos de lectura contenidos para que
 * el lote se procese igual que las fotos sueltas.
 */

const EXTENSIONES_VALIDAS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'bmp',
  'gif',
  'tif',
  'tiff',
  'pdf',
  'docx',
];

const MIME_POR_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  bmp: 'image/bmp',
  gif: 'image/gif',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

function extensionDe(nombre: string): string {
  const parts = nombre.split('.');
  return parts.length > 1 ? (parts[parts.length - 1]?.toLowerCase() ?? '') : '';
}

function mimeDe(nombre: string): string {
  return MIME_POR_EXTENSION[extensionDe(nombre)] ?? 'application/octet-stream';
}

/**
 * Descomprime un archivo ZIP y devuelve los archivos de lectura validos que
 * contiene, en el orden en que el ZIP los define. Los directorios y archivos
 * de soporte (p. ej. .DS_Store, __MACOSX) se ignoran.
 *
 * La funcion es asincrona porque necesita leer el ArrayBuffer del archivo
 * antes de descomprimirlo en la CPU del navegador (fflate corre local).
 */
export async function extraerArchivosDeZip(file: File): Promise<File[]> {
  const buf = await file.arrayBuffer();
  const entradas = unzipSync(new Uint8Array(buf));

  const salida: File[] = [];
  for (const [ruta, data] of Object.entries(entradas)) {
    const nombreArchivo = ruta.split('/').pop() ?? '';
    if (!nombreArchivo) continue;

    // Ignora entradas que no son un archivo de lectura (directorios, metadatos).
    const ext = extensionDe(nombreArchivo);
    if (!EXTENSIONES_VALIDAS.includes(ext)) continue;
    if (nombreArchivo.startsWith('.')) continue;
    if (ruta.toUpperCase().includes('__MACOSX')) continue;

    salida.push(
      new File([data.slice()], nombreArchivo, { type: mimeDe(nombreArchivo) })
    );
  }

  return salida;
}

/** Indica si el archivo es un ZIP. */
export function esZip(file: File): boolean {
  return file.name.toLowerCase().endsWith('.zip');
}
