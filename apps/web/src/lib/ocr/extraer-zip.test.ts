import { describe, it, expect } from 'vitest';
import { zipSync } from 'fflate';
import { extraerArchivosDeZip, esZip } from './extraer-zip';

describe('Extraccion de archivos de ZIP', () => {
  it('esZip identifica archivos .zip', () => {
    expect(esZip(new File([], 'foto.zip'))).toBe(true);
    expect(esZip(new File([], 'foto.ZIP'))).toBe(true);
    expect(esZip(new File([], 'foto.jpg'))).toBe(false);
    expect(esZip(new File([], 'foto'))).toBe(false);
  });

  it('extrae imagenes de un ZIP y descarta archivos no soportados', async () => {
    const entradas: Record<string, Uint8Array> = {
      'foto1.jpg': new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
      'foto2.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      '__MACOSX/._foto1': new Uint8Array([0, 1, 2]),
      'documento.pdf': new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      'readme.txt': new Uint8Array([0x48, 0x6f, 0x6c, 0x61]),
    };
    const comprimido = zipSync(entradas);
    const zipFile = new File([comprimido], 'fotos.zip', { type: 'application/zip' });

    const archivos = await extraerArchivosDeZip(zipFile);

    // Solo jpg, png, pdf; se descarta __MACOSX y .txt
    expect(archivos).toHaveLength(3);
    const nombres = archivos.map((a) => a.name);
    expect(nombres).toContain('foto1.jpg');
    expect(nombres).toContain('foto2.png');
    expect(nombres).toContain('documento.pdf');
    expect(nombres).not.toContain('readme.txt');
    expect(nombres).not.toContain('_foto1');
  });

  it('preserva el contenido binario de los archivos extraidos', async () => {
    const contenido = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const comprimido = zipSync({ 'photo.jpeg': contenido });
    const zipFile = new File([comprimido], 'test.zip', { type: 'application/zip' });

    const archivos = await extraerArchivosDeZip(zipFile);
    expect(archivos).toHaveLength(1);
    expect(archivos[0].name).toBe('photo.jpeg');
    expect(archivos[0].type).toBe('image/jpeg');
    const leido = new Uint8Array(await archivos[0].arrayBuffer());
    expect(leido).toEqual(contenido);
  });

  it('maneja ZIP vacio sin errores', async () => {
    const comprimido = zipSync({});
    const zipFile = new File([comprimido], 'vacio.zip', { type: 'application/zip' });

    const archivos = await extraerArchivosDeZip(zipFile);
    expect(archivos).toHaveLength(0);
  });
});
