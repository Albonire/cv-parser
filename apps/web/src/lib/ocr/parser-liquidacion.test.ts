import { describe, it, expect } from 'vitest';
import { parseLiquidacionText } from './parser-liquidacion';

describe('Parser de Liquidacion Final', () => {
  it('Debe extraer los datos clave de una liquidacion con texto limpio', () => {
    const text = `
    LIQUIDACION FINAL DE CONTRATO DE TRABAJO
    EMPLEADOR: ROSIMAR S.A.S.
    TRABAJADOR: CARLOS ALBERTO MARTINEZ
    CEDULA DE CIUDADANIA: 1050234987
    CARGO: OPERADOR LOGISTICO
    FECHA DE INGRESO: 01/09/2023
    FECHA DE RETIRO: 31/08/2024
    DIAS TRABAJADOS: 365
    SALARIO BASE: $1.500.000
    CESANTIAS: $1.250.000
    INTERESES SOBRE CESANTIAS: $150.000
    PRESTACIONES/PRIMA DE SERVICIOS: $1.250.000
    VACACIONES PROPORCIONALES: $320.000
    TOTAL LIQUIDACION A PAGAR: $2.970.000
    `;

    const parsed = parseLiquidacionText(text);

    expect(parsed.employerName).toMatch(/rosimar/i);
    expect(parsed.workerName).toBe('Carlos Alberto Martinez');
    expect(parsed.workerDocumentNumber).toBe('1050234987');
    expect(parsed.cargo).toBe('Operador Logistico');
    expect(parsed.fechaIngreso).toBe('2023-09-01');
    expect(parsed.fechaRetiro).toBe('2024-08-31');
    expect(parsed.diasTrabajados).toBe(365);
    expect(parsed.salarioBase).toBe(1500000);
    expect(parsed.cesantias).toBe(1250000);
    expect(parsed.interesesCesantias).toBe(150000);
    expect(parsed.totalLiquidacion).toBe(2970000);
    expect(parsed.rawText).toBe(text);
  });

  it('Debe conservar undefined cuando el OCR no reconoce un dato (No encontrado)', () => {
    const parsed = parseLiquidacionText('fotografia borrosa sin texto');
    expect(parsed.workerName).toBeUndefined();
    expect(parsed.workerDocumentNumber).toBeUndefined();
    expect(parsed.fechaRetiro).toBeUndefined();
    expect(parsed.totalLiquidacion).toBeUndefined();
    expect(parsed.otrosConceptos).toEqual([]);
  });

  it('Debe extraer conceptos adicionales del desglose sin duplicar los conceptos clasicos', () => {
    const text = `
    LIQUIDACION
    TRABAJADOR: MARIA FERNANDA GOMEZ
    CEDULA: 1045678901
    CESANTIAS: $1.000.000
    Desglose de liquidacion:
    Bonificacion no constitutiva: $200.000
    Auxilio de transporte: $117.172
    TOTAL: $1.317.172
    Firma del trabajador
    `;

    const parsed = parseLiquidacionText(text);

    expect((parsed.otrosConceptos ?? []).some((c) => /bonificacion/i.test(c.concepto))).toBe(true);
    expect((parsed.otrosConceptos ?? []).some((c) => /auxilio de transporte/i.test(c.concepto))).toBe(true);
    expect((parsed.otrosConceptos ?? []).every((c) => !/cesantias/i.test(c.concepto))).toBe(true);
    expect(parsed.cesantias).toBe(1000000);
  });
});
