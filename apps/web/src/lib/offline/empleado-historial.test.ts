import { describe, it, expect } from 'vitest';
import {
  determinarEvidenciaLaboral,
  candidateDataDesdeHistorial,
} from './empleado-historial';
import { ExtractedDocumentData } from '../../types/reader';

function baseResult(over: Partial<ExtractedDocumentData>): ExtractedDocumentData {
  return {
    detectedType: 'unknown',
    fileName: 'doc.jpg',
    fileSize: 1,
    fileType: 'image/jpeg',
    extractedText: '',
    confidenceScore: 0.5,
    processingTimeMs: 10,
    method: 'image_ocr',
    ...over,
  };
}

describe('determinarEvidenciaLaboral', () => {
  it('NO infiere empleado cuando no hay documentos laborales', () => {
    const r = baseResult({
      detectedType: 'cv',
      extractedText: 'HOJA DE VIDA\nEXPERIENCIA LABORAL\nPERFIL PROFESIONAL',
      candidateData: {
        firstNames: 'Ana',
        lastNames: 'Perez',
        documentType: 'CC',
        documentNumber: '1090123456',
        nationality: 'Colombiana',
        phone: '',
        email: '',
        status: 'nuevo',
        education: [],
        experience: [],
        skills: [],
        references: [],
      },
    });
    const ev = determinarEvidenciaLaboral([r]);
    expect(ev.esEmpleado).toBe(false);
    expect(ev.estado).toBe('activo');
  });

  it('infiere EMPLEADO ACTIVO cuando hay un contrato', () => {
    const r = baseResult({
      detectedType: 'contract',
      extractedText: 'CONTRATO DE TRABAJO A TERMINO FIJO\nTRABAJADOR: CARLOS VEGA',
      contractData: {
        employerName: 'Rosimar S.A.S.',
        employerNit: '900.123.456-7',
        workerName: 'Carlos Vega',
        workerDocumentNumber: '1050234987',
        position: 'Operador',
        salary: 1500000,
        currency: 'COP',
        paymentFrequency: 'mensual',
        contractType: 'termino_fijo',
        startDate: '2023-09-01',
        trialPeriodDays: 60,
        noticeDays: 30,
        executionPlace: 'Pamplona',
        status: 'vigente',
      },
    });
    const ev = determinarEvidenciaLaboral([r]);
    expect(ev.esEmpleado).toBe(true);
    expect(ev.estado).toBe('activo');
    expect(ev.cedula).toBe('1050234987');
  });

  it('infiere EMPLEADO INACTIVO cuando hay una liquidacion', () => {
    const r = baseResult({
      detectedType: 'liquidacion',
      extractedText: 'LIQUIDACION FINAL DE CONTRATO\nCESANTIAS\nTOTAL LIQUIDACION',
      liquidacionData: {
        workerName: 'Carlos Vega',
        workerDocumentNumber: '1050234987',
        fechaRetiro: '2024-08-31',
        totalLiquidacion: 3000000,
      },
    });
    const ev = determinarEvidenciaLaboral([r]);
    expect(ev.esEmpleado).toBe(true);
    expect(ev.estado).toBe('inactivo');
    expect(ev.fechaSalida).toBe('2024-08-31');
    expect(ev.razonSalida).toBe('terminacion_unilateral_empleador');
  });

  it('infiere EMPLEADO INACTIVO cuando hay una renuncia', () => {
    const r = baseResult({
      detectedType: 'unknown',
      extractedText: 'CARTA DE RENUNCIA\n20/06/2024\nPARA: ROSIMAR S.A.S.',
    });
    const ev = determinarEvidenciaLaboral([r]);
    expect(ev.esEmpleado).toBe(true);
    expect(ev.estado).toBe('inactivo');
    expect(ev.razonSalida).toBe('renuncia');
  });

  it('una salida tiene prioridad sobre un contrato (activo -> inactivo)', () => {
    const contrato = baseResult({
      detectedType: 'contract',
      extractedText: 'CONTRATO DE TRABAJO A TERMINO FIJO',
      contractData: {
        employerName: 'Rosimar S.A.S.',
        employerNit: '900.123.456-7',
        workerName: 'Carlos Vega',
        workerDocumentNumber: '1050234987',
        position: 'Operador',
        salary: 1500000,
        currency: 'COP',
        paymentFrequency: 'mensual',
        contractType: 'termino_fijo',
        startDate: '2023-09-01',
        trialPeriodDays: 60,
        noticeDays: 30,
        executionPlace: 'Pamplona',
        status: 'terminado',
      },
    });
    const liquidacion = baseResult({
      detectedType: 'liquidacion',
      extractedText: 'LIQUIDACION FINAL\nCESANTIAS\nTOTAL LIQUIDACION',
      liquidacionData: {
        workerDocumentNumber: '1050234987',
        fechaRetiro: '2024-08-31',
      },
    });
    const ev = determinarEvidenciaLaboral([contrato, liquidacion]);
    expect(ev.esEmpleado).toBe(true);
    expect(ev.estado).toBe('inactivo');
  });
});

describe('candidateDataDesdeHistorial', () => {
  it('consolida identidad desde la cedula y el contrato', () => {
    const r = baseResult({
      detectedType: 'contract',
      contractData: {
        employerName: 'Rosimar S.A.S.',
        employerNit: '900.123.456-7',
        workerName: 'MARIA CAMILA TORRES GARCIA',
        workerDocumentNumber: '1090123456',
        position: 'Auxiliar',
        salary: 1300000,
        currency: 'COP',
        paymentFrequency: 'mensual',
        contractType: 'indefinido',
        startDate: '2024-02-01',
        trialPeriodDays: 60,
        noticeDays: 30,
        executionPlace: 'Pamplona',
        status: 'vigente',
      },
    });
    const c = candidateDataDesdeHistorial([r], '1090123456');
    expect(c.documentNumber).toBe('1090123456');
    expect(c.firstNames.toLowerCase()).toContain('maria');
    expect(c.lastNames.toLowerCase()).toContain('torres');
  });
});
