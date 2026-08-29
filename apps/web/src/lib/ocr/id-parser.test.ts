import { describe, it, expect } from 'vitest';
import { parseIdCardText } from './parser-id';

describe('Parser de Cédula de Ciudadanía (ID Card)', () => {
  it('Debe extraer todos los datos de una cédula colombiana estándar', () => {
    const text = `
    REPÚBLICA DE COLOMBIA
    IDENTIFICACIÓN PERSONAL
    CÉDULA DE CIUDADANÍA
    NÚMERO 1.098.765.432
    
    APELLIDOS
    PEREZ GOMEZ
    NOMBRES
    JUAN DAVID
    
    NACIONALIDAD
    COL
    ESTATURA
    1.75
    G.S. RH
    O+
    
    FECHA DE NACIMIENTO
    15-MAY-1995
    LUGAR DE NACIMIENTO
    BOGOTA D.C. (BOGOTA D.C.)
    
    FECHA DE EXPEDICIÓN
    20-JUN-2013
    LUGAR DE EXPEDICIÓN
    BOGOTA D.C.
    `;

    const parsed = parseIdCardText(text);

    expect(parsed.documentNumber).toBe('1098765432');
    expect(parsed.firstNames).toBe('JUAN DAVID');
    expect(parsed.lastNames).toBe('PEREZ GOMEZ');
    expect(parsed.expeditionPlace).toBe('BOGOTA D.C.');
  });
});
