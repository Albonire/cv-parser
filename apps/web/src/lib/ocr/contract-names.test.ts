import { describe, expect, it } from 'vitest';
import { parseContractText } from './parser-contract';

/**
 * Los tres casos vienen del banco de contratos escaneados, con los renglones
 * tal como los deja el OCR. Un nombre equivocado es peor que uno vacio: quien
 * revisa un lote ve el hueco y no ve el error.
 */
describe('nombre del trabajador', () => {
  it('no toma la fila de preaviso, que empieza por "Trabajador:"', () => {
    const texto = [
      'CONTRATO INDIVIDUAL DE TRABAJO',
      'Empleador:   DISTRIBUCIONES ROSIMAR S.A.S',
      'Preaviso de terminacion / vencimiento   Trabajador: 30 dias. Empleador: 30 dias',
      'Lugar de ejecucion del contrato   PAMPLONA',
    ].join('\n');

    expect(parseContractText(texto).workerName).toBe('');
  });

  it('toma el renglon huerfano de encima cuando el rotulo no se leyo', () => {
    // CT_06: el OCR no leyo "Trabajador:" y el nombre quedo solo en su renglon.
    const texto = [
      'Correo electronico del empleador   contacto@rosimar.com.co',
      'MARTHA LUCIA CAICEDO BERMUDEZ',
      'Fecha de nacimiento:   03 MARZO 1991',
      'Identificacion:   C.C 1.098.234.567',
      'Preaviso de terminacion / vencimiento   Trabajador: 30 dias. Empleador: 30 dias',
    ].join('\n');

    expect(parseContractText(texto).workerName).toBe('MARTHA LUCIA CAICEDO BERMUDEZ');
  });

  it('no confunde el ancla del trabajador con la del empleador', () => {
    // "domicilio del empleado" es prefijo de "Domicilio del empleador": sin
    // frontera de palabra el ancla se iba al bloque de la empresa.
    const texto = [
      'Empleador:   DISTRIBUCIONES ROSIMAR S.A.S',
      'Domicilio del empleador   CALLE 11 No. 39 - 37',
      'Trabajador:   JHON FREDY OSPINA CARDONA',
      'Fecha de nacimiento:   22 JULIO 1988',
    ].join('\n');

    expect(parseContractText(texto).workerName).toBe('JHON FREDY OSPINA CARDONA');
  });

  it('no da una direccion por nombre', () => {
    const texto = [
      'Trabajador:   AV 68 x 40-15',
      'Fecha de nacimiento:   22 JULIO 1988',
    ].join('\n');

    expect(parseContractText(texto).workerName).toBe('');
  });
});
