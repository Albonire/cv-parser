import { describe, expect, it } from 'vitest';
import { reconstruirCorreoOcr } from './correo-ocr';

/**
 * Los tres casos vienen del banco de escaneos, tal como los deja Tesseract.
 * Los negativos importan igual: inventar una direccion es peor que dejar el
 * campo vacio, porque quien revisa ve el hueco y no ve el error.
 */
describe('reconstruirCorreoOcr', () => {
  it('resuelve el glifo pegado al dominio', () => {
    expect(reconstruirCorreoOcr('Correo electronico del empleador   gerencia Qrosimar.com.co')).toBe(
      'gerencia@rosimar.com.co'
    );
  });

  it('resuelve el glifo pegado al usuario', () => {
    expect(reconstruirCorreoOcr('Correo del trabajador   jhon.ospinaQ gmail.com')).toBe(
      'jhon.ospina@gmail.com'
    );
  });

  it('resuelve el glifo dentro de una sola palabra', () => {
    expect(reconstruirCorreoOcr('demurilloGhotmail.com')).toBe('demurillo@hotmail.com');
  });

  it('resuelve los casos medidos en el banco de hojas de vida', () => {
    expect(reconstruirCorreoOcr('martha.caicedoOQ correo.com')).toBe('martha.caicedo@correo.com');
    expect(reconstruirCorreoOcr('monica.salazarO correo.com')).toBe('monica.salazar@correo.com');
  });

  it('no inventa una direccion donde no la hay', () => {
    expect(reconstruirCorreoOcr('Domicilio del trabajador CALLE 30 # 76-12 APTO 302')).toBe('');
    expect(reconstruirCorreoOcr('Duracion SEIS (6) MESES')).toBe('');
    expect(reconstruirCorreoOcr('DISTRIBUCIONES ROSIMAR S.A.S')).toBe('');
  });
});

describe('reconstruirCorreoOcr en modo estricto', () => {
  it('no acepta una direccion que solo tiene forma de tal', () => {
    // Medido en CT_04, perfil duro: sin etiqueta que respalde la lectura, el
    // barrido de texto degradado producia "conacivtusimat@om.co".
    expect(reconstruirCorreoOcr('conacivtusimat Oom.co', { estricto: true })).toBe('');
    expect(reconstruirCorreoOcr('conacivtusimat Oom.co')).toBe('conacivtusimat@om.co');
  });

  it('sigue aceptando un dominio conocido o un usuario con punto', () => {
    expect(reconstruirCorreoOcr('gustavomontenegro7 @gmail.com', { estricto: true })).toBe(
      'gustavomontenegro7@gmail.com'
    );
    expect(reconstruirCorreoOcr('gerencia Qrosimar.com.co', { estricto: true })).toBe('');
    expect(reconstruirCorreoOcr('area.gerencia Qrosimar.com.co', { estricto: true })).toBe(
      'area.gerencia@rosimar.com.co'
    );
  });
});
