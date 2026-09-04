import { describe, it, expect } from 'vitest';
import { detectarTextoIninteligible } from './index';
import { tesseractWordsToWords } from './tesseract-worker';

describe('Motor OCR mejorado', () => {
  describe('detectarTextoIninteligible', () => {
    it('detecta caracteres repetidos (ruido)', () => {
      const resultado = detectarTextoIninteligible(
        'aaaaaaaa\nbbbbbbbb\nsonido\nconsonante\nestructural\n'
      );
      expect(resultado.esIninteligible).toBe(true);
      expect(resultado.razon).toMatch(/repetidos/i);
    });

    it('detecta palabras largas sin vocales (gibberish)', () => {
      const resultado = detectarTextoIninteligible(
        'XQZRBTN LMNOPFGH JKQWRTY PLMNBCV ZXQWERTY PLMNBXCV QZRTYMNV ' +
          'QWPLMNBD FGHJKLPR QWZXCVBN PLMNBVCX ZXRWVQTP KLMNBVCD ZQWPLMNB'
      );
      expect(resultado.esIninteligible).toBe(true);
      expect(resultado.razon).toMatch(/vocales/i);
    });

    it('acepta texto normal y legible', () => {
      const resultado = detectarTextoIninteligible(
        'Hoja de vida de Juan Perez\nCiudad de residencia: Medellin\nTelefono: 3101234567'
      );
      expect(resultado.esIninteligible).toBe(false);
      expect(resultado.factorConfianza).toBe(1);
    });

    it('no confunde numeros, fechas y telefonos con gibberish', () => {
      // Cedula con puntos, telefonos, fechas y montos NO son gibberish.
      const resultado = detectarTextoIninteligible(
        'Cedula: 72.222.293\nTelefonos: 320 230 0957 / 314 825 4909\n' +
          'Nacido el 04/08/1970\nSalario: $1.300.000\nexpide al 08-10-2029'
      );
      expect(resultado.esIninteligible).toBe(false);
    });

    it('detecta texto vacio', () => {
      const resultado = detectarTextoIninteligible('   \n   \n');
      expect(resultado.esIninteligible).toBe(true);
      expect(resultado.razon).toMatch(/vacio/i);
      expect(resultado.factorConfianza).toBeLessThan(0.5);
    });

    it('no marca ilegible un texto de origen nativo aunque parezca ruido', () => {
      const resultado = detectarTextoIninteligible(
        'XQZRBTN LMNOPFGH JKQWRTY PLMNBCV ZXQWERTY PLMNBXCV QZRTYMNV\n' +
          'Quedan muchas palabras con vocales y el documento es un .txt limpio',
        'nativo'
      );
      expect(resultado.esIninteligible).toBe(false);
      expect(resultado.factorConfianza).toBe(1);
    });

    it('nativo con texto abundante tampoco dispara falsa alarma de palabras reconocibles', () => {
      const resultado = detectarTextoIninteligible(
        'Datos Personales y de Contrato\nNombre: Ana Carina Mieles Molina\n' +
          'Cedula de Ciudadania: 1.002.153.173\nSeguridad Social: EPS Sanitas | AFP Porvenir | ARL Positiva',
        'nativo'
      );
      expect(resultado.esIninteligible).toBe(false);
    });
  });

  describe('tesseractWordsToWords marca palabras inciertas', () => {
    it('marca con uncertain las palabras de baja confianza', () => {
      const palabras = [
        { text: 'Hola', confidence: 95, bbox: { x0: 0, y0: 0, x1: 20, y1: 10 } },
        { text: 'mundo', confidence: 40, bbox: { x0: 25, y0: 0, x1: 45, y1: 10 } },
      ];
      const words = tesseractWordsToWords(palabras as never);
      const hola = words.find((w) => w.text === 'Hola');
      const mundo = words.find((w) => w.text === 'mundo');
      expect(hola?.uncertain).toBe(false);
      expect(mundo?.uncertain).toBe(true);
    });
  });
});
