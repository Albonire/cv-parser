import { describe, expect, it } from 'vitest';
import { parseContractText } from './parser-contract';

/**
 * En un contrato en dos columnas el OCR puede leer la columna de valores y
 * perder entera la de rotulos, porque las celdas de etiqueta llevan fondo gris
 * y el preprocesado se las come. Los renglones de aqui son los que devolvio el
 * lector para CT_04, del perfil duro, con la plantilla borrada.
 */
describe('contrato sin la columna de rotulos', () => {
  const soloValores = [
    'CONTRATO INDIVIDUAL DE TRABAJO',
    'A TERMINO FIJO INFERIOR A UN ANO',
    'DISTRIBUCIONES ROSIMAR SAS',
    'NIT No. 901.167.955-4',
    'DIANA CAROLINA MURILLO ESCOBAR',
    '11 NOVIEMBRE 1985',
    'C.C 52.987.654',
    'AV 68 # 40-15',
    'demurilloGhotmail.com',
    'COORDINADORA DE TALENTO HUMANO',
    '$ 3.200.000',
    'BOGOTA D.C.',
  ].join('\n');

  it('identifica cada valor por su forma', () => {
    const contrato = parseContractText(soloValores);

    expect(contrato.employerName).toBe('DISTRIBUCIONES ROSIMAR SAS');
    expect(contrato.workerName).toBe('DIANA CAROLINA MURILLO ESCOBAR');
    expect(contrato.workerDocumentNumber).toBe('52987654');
    expect(contrato.workerAddress).toBe('AV 68 # 40-15');
    expect(contrato.workerEmail).toBe('demurillo@hotmail.com');
    expect(contrato.position).toBe('COORDINADORA DE TALENTO HUMANO');
    expect(contrato.salary).toBe(3200000);
  });

  it('no toma el titulo del documento ni el cargo por nombre de la persona', () => {
    const contrato = parseContractText(soloValores);

    expect(contrato.workerName).not.toBe('CONTRATO INDIVIDUAL DE TRABAJO');
    expect(contrato.workerName).not.toBe('COORDINADORA DE TALENTO HUMANO');
  });

  it('no pisa lo que la via de etiquetas ya encontro', () => {
    // Aqui los rotulos si estan, y ademas hay una linea que por forma podria
    // confundirse con el nombre del trabajador.
    const conRotulos = [
      'Empleador:   DISTRIBUCIONES ROSIMAR SAS',
      'Trabajador:   JHON FREDY OSPINA CARDONA',
      'MARIA FERNANDA GOMEZ SILVA',
      'Cargo:   OPERARIO DE PRODUCCION',
    ].join('\n');

    const contrato = parseContractText(conRotulos);

    expect(contrato.workerName).toBe('JHON FREDY OSPINA CARDONA');
    expect(contrato.position).toBe('OPERARIO DE PRODUCCION');
  });
});
