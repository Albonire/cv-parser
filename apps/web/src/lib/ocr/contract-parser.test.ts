import { describe, it, expect } from 'vitest';
import { parseContractText } from './parser-contract';

describe('Parser de Contrato Laboral', () => {
  it('Debe extraer los datos clave de un contrato a término fijo', () => {
    const text = `
    CONTRATO DE TRABAJO A TÉRMINO FIJO
    
    EMPLEADOR: ROSIMAR S.A.S.
    NIT: 900.123.456-7
    TRABAJADOR: CARLOS ALBERTO MARTINEZ
    CÉDULA DE CIUDADANÍA NO.: 1.050.234.987
    
    CARGO: OPERADOR LOGÍSTICO
    SALARIO: $ 1.500.000
    FORMA DE PAGO: QUINCENAL
    
    FECHA DE INICIACIÓN: 01-09-2023
    FECHA DE VENCIMIENTO: 31-08-2024
    PERÍODO DE PRUEBA: 2 MESES
    CIUDAD DE TRABAJO: BOGOTA
    `;

    const parsed = parseContractText(text);

    expect(parsed.employerName).toBe('ROSIMAR S.A.S.');
    expect(parsed.employerNit).toBe('900.123.456-7');
    expect(parsed.workerName).toBe('CARLOS ALBERTO MARTINEZ');
    expect(parsed.workerDocumentNumber).toBe('1050234987');
    expect(parsed.position).toBe('OPERADOR LOGÍSTICO');
    expect(parsed.salary).toBe(1500000);
    expect(parsed.paymentFrequency).toBe('quincenal');
    expect(parsed.contractType).toBe('termino_fijo');
    expect(parsed.trialPeriodDays).toBe(60);
    expect(parsed.executionPlace).toBe('BOGOTA');
  });
});
