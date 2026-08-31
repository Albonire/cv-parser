import { describe, it, expect } from 'vitest';
import { parseContractText, normalizarFecha } from './parser-contract';

describe('normalizarFecha (formatos colombianos de contrato)', () => {
  it('normaliza DD/MM/YYYY', () => {
    expect(normalizarFecha('01-09-2023')).toBe('2023-09-01');
  });

  it('normaliza YYYY-MM-DD', () => {
    expect(normalizarFecha('2024-02-01')).toBe('2024-02-01');
  });

  it('normaliza año de dos digitos', () => {
    expect(normalizarFecha('31/08/24')).toBe('2024-08-31');
  });

  it('convierte "1 de septiembre de 2023"', () => {
    expect(normalizarFecha('1 de septiembre de 2023')).toBe('2023-09-01');
  });

  it('convierte "primero de septiembre de 2023"', () => {
    expect(normalizarFecha('primero de septiembre de 2023')).toBe('2023-09-01');
  });

  it('rechaza fechas invalidas', () => {
    expect(normalizarFecha('2024-13-45')).toBe('');
  });
});

describe('Parser de Contrato: fechas de inicio/fin robustas', () => {
  it('extrae fechas en formato textual espanol', () => {
    const text = [
      'CONTRATO DE TRABAJO A TERMINO FIJO',
      'TRABAJADOR: CARLOS ANDRES VEGA',
      'CEDULA: 1050234987',
      'CARGO: OPERADOR',
      'SALARIO: $ 1.500.000',
      'FECHA DE INICIO: primero de septiembre de 2023',
      'FECHA DE VENCIMIENTO: 31 de agosto de 2024',
    ].join('\n');

    const parsed = parseContractText(text);
    expect(parsed.startDate).toBe('2023-09-01');
    expect(parsed.endDate).toBe('2024-08-31');
  });

  it('deriva la fecha de fin cuando el contrato dice "termino de N meses"', () => {
    const text = [
      'CONTRATO DE TRABAJO A TERMINO FIJO',
      'TRABAJADOR: CARLOS ANDRES VEGA',
      'CEDULA: 1050234987',
      'CARGO: OPERADOR',
      'SALARIO: $ 1.500.000',
      'FECHA DE INICIO: 2023-09-01',
      'POR EL TERMINO DE 12 MESES',
    ].join('\n');

    const parsed = parseContractText(text);
    expect(parsed.startDate).toBe('2023-09-01');
    expect(parsed.endDate).toBe('2024-09-01');
  });

  it('utiliza el layout renglon a renglon para no cruzar etiquetas de otra seccion', () => {
    // Etiquetas y valores en lineas distintas (formato tabular dos columnas).
    const text = [
      'CONTRATO DE TRABAJO A TERMINO INDEFINIDO',
      'TRABAJADOR: MARIA CAMILA TORRES',
      'CEDULA 1090123456',
      'CARGO: AUXILIAR',
      'SALARIO 1.600.000',
      'FECHA DE INICIO:',
      '2024-02-01',
      'FECHA DE VENCIMIENTO:',
      '2030-01-31',
    ].join('\n');

    const parsed = parseContractText(text);
    // La fecha de inicio es la primera fecha despues de la etiqueta.
    expect(parsed.startDate).toBe('2024-02-01');
  });

  it('no pierde la fecha de fin aunque el contrato se detecte indefinido', () => {
    const text = [
      'CONTRATO DE TRABAJO A TERMINO INDEFINIDO',
      'TRABAJADOR: MARIA CAMILA TORRES',
      'CEDULA 1090123456',
      'CARGO: AUXILIAR',
      'SALARIO 1.600.000',
      'FECHA DE INICIO: 2024-02-01',
      'FECHA DE VENCIMIENTO: 2030-01-31',
    ].join('\n');

    const parsed = parseContractText(text);
    expect(parsed.contractType).toBe('indefinido');
    // El dato extraido no debe perderse (sigue siendo una fecha en el documento).
    expect(parsed.endDate).toBe('2030-01-31');
  });

  it('extrae el preaviso del documento si lo menciona', () => {
    const text = [
      'CONTRATO DE TRABAJO A TERMINO FIJO',
      'TRABAJADOR: CARLOS ANDRES VEGA',
      'CEDULA 1050234987',
      'CARGO: OPERADOR',
      'SALARIO 1.500.000',
      'FECHA DE INICIO: 2023-09-01',
      'PREAVISO: 45 dias',
    ].join('\n');

    const parsed = parseContractText(text);
    expect(parsed.noticeDays).toBe(45);
  });
});
