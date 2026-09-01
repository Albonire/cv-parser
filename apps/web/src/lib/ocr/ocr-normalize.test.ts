import { describe, it, expect } from 'vitest';
import { normalizarPalabraOcr } from './ocr-normalize';

/**
 * Regresion de la normalizacion de palabras del OCR de fotos.
 *
 * No es un arreglo exotico: son las confusiones sistematicas de Tesseract
 * (spa+eng) sobre fotos de WhatsApp, del tipo que producia salarios y NIT mal
 * leidos ("1.600.O0O", "900.123.456-7" con guion como "~", cedulas con la 'O'
 * grande por el cero).
 *
 * Regla de oro de la capa: es conservadora. Las palabras normales (nombres,
 * ciudades, cargos) NO se tocan; solo las cadenas que son claramente numericas
 * reciben la correccion de glifos.
 */
describe('normalizarPalabraOcr', () => {
  it('corrige el cero mal leido como letra O en montos', () => {
    const palabras = ['1.600.00O', '2.200.O00'];
    for (const p of palabras) expect(normalizarPalabraOcr(p)).not.toMatch(/O/);
    expect(normalizarPalabraOcr('1.600.00O')).toBe('1.600.000');
    expect(normalizarPalabraOcr('2.200.O00')).toBe('2.200.000');
  });

  it('corrige la cedula con ceros leidos como O o I', () => {
    expect(normalizarPalabraOcr('32.891.622')).toBe('32.891.622');
    expect(normalizarPalabraOcr('32.89O.62O')).toBe('32.890.620');
    expect(normalizarPalabraOcr('105O987654')).toBe('1050987654');
  });

  it('normaliza el guion del NIT leido como ~ o |', () => {
    expect(normalizarPalabraOcr('900.123.456~7')).toBe('900.123.456-7');
    expect(normalizarPalabraOcr('900.123.456|7')).toBe('900.123.456-7');
  });

  it('NO toca palabras normales como ciudades y nombres', () => {
    expect(normalizarPalabraOcr('Combarranquilla')).toBe('Combarranquilla');
    expect(normalizarPalabraOcr('AUXILIAR')).toBe('AUXILIAR');
    expect(normalizarPalabraOcr('calle')).toBe('calle');
  });

  it('no rompe una cadena mixta que no es puramente numerica', () => {
    // El piso de un salario en prosa ("$1.650.000") mezclado con texto no es
    // una cifra pura y no debe transformarse de mas.
    expect(normalizarPalabraOcr('Colombia')).toBe('Colombia');
  });
});
