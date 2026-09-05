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

  it('extrae correctamente ficha compuesta con datos personales y contrato sin tomar Historial Disciplinario como nombre', () => {
    const text = `
    Datos Personales y de Contrato 
    • Nombre: Adonis Guette Gonzalez 
    • Cédula de Ciudadanía: 1.140.867.614 
    • Cargo: Auxiliar de Bodega / Ayudante de Bodega 
    • Empresa Empleadora: Distribuciones Rosimar S.A.S. (NIT 901.167.955-4) 
    • Salario: $1.423.500 
    • Forma de Pago: Quincenal 
    • Tipo de Contrato: Término fijo inferior a un año (3 meses iniciales) 
    • Fecha de Inicio: 23 de mayo de 2025 
    • Lugar de Trabajo: Calle 10 # 38 - 93, Barranquilla 
    • Dirección de Notificación: Carrera 29 # 12 - 10 
    Historial Disciplinario 
    • 24 de marzo de 2026 (Memorando No. 102): Amonestación por "Abuso de confianza" tras tomar dinero del cobro sin autorización. 
    • 8 de mayo de 2026 (Llamado de atención No. 104): Llamado de atención por "Toma de decisiones sin consultar" e incumplimiento de funciones durante la jornada laboral. 
    Novedades de Nómina y Prestaciones 
    • 1 de junio de 2026 (Comprobante de Egreso No. 8509): Liquidación y pago de $859.111 por concepto de Vacaciones Consolidadas. 
    Desvinculación 
    • Fecha de Retiro: 13 de agosto de 2026 
    • Motivo: Renuncia voluntaria al cargo por motivos personales.
    `;

    const parsed = parseContractText(text);

    expect(parsed.workerName).toBe('Adonis Guette Gonzalez');
    expect(parsed.workerDocumentNumber).toBe('1140867614');
    expect(parsed.employerName).toBe('Distribuciones Rosimar S.A.S.');
    expect(parsed.employerNit).toBe('901.167.955-4');
    expect(parsed.salary).toBe(1423500);
    expect(parsed.startDate).toBe('2025-05-23');
    expect(parsed.paymentFrequency).toBe('quincenal');
    expect(parsed.contractType).toBe('termino_fijo');
    expect(parsed.workerAddress).toBe('Carrera 29 # 12 - 10');
    expect(parsed.executionPlace).toBe('Calle 10 # 38 - 93, Barranquilla');
    expect(parsed.trialPeriodDays).toBe(0);
    expect(parsed.durationMonths).toBe(3);
  });

  it('tolera rótulos de fecha de inicio degradados o sin la palabra Fecha', () => {
    const text = `
    CONTRATO INDIVIDUAL DE TRABAJO
    EMPLEADOR: DISTRIBUCIONES ROSIMAR S.A.S.
    TRABAJADOR: GUSTAVO SEGUNDO MONTENEGRO CABALLERO
    CÉDULA: 9876527
    CARGO: CONDUCTOR
    SALARIO: $ 1.423.500
    FORMA DE PAGO: QUINCENAL
    de iniciación del contrato: 04 ENERO 2025
    `;

    const parsed = parseContractText(text);
    expect(parsed.startDate).toBe('2025-01-04');
    expect(parsed.workerName).toBe('GUSTAVO SEGUNDO MONTENEGRO CABALLERO');
    expect(parsed.salary).toBe(1423500);
  });

  it('extrae correctamente la ficha real desde el archivo Datos Personales y de Contrato.pdf', async () => {
    const fs = await import('fs');
    const path = '/home/fabian/Downloads/Datos Personales y de Contrato.pdf';
    if (!fs.existsSync(path)) return;
    const { layoutFromPdfFile } = await import('./__fixtures__/pdf-pipeline');
    const layout = await layoutFromPdfFile(path);
    const text = layout.text;

    const { clasificarHistorial, classifyDocumentType } = await import('./document-classifier');
    expect(clasificarHistorial(text)).toBe('contrato');
    expect(classifyDocumentType(text)).toBe('contract');

    const parsed = parseContractText(text, layout);
    expect(parsed.workerName).toBe('Adonis Guette Gonzalez');
    expect(parsed.workerDocumentNumber).toBe('1140867614');
    expect(parsed.employerName).toBe('Distribuciones Rosimar S.A.S.');
    expect(parsed.employerNit).toBe('901.167.955-4');
    expect(parsed.salary).toBe(1423500);
    expect(parsed.startDate).toBe('2025-05-23');
    expect(parsed.paymentFrequency).toBe('quincenal');
    expect(parsed.contractType).toBe('termino_fijo');
    expect(parsed.workerAddress).toBe('Carrera 29 # 12 - 10');
    expect(parsed.executionPlace).toBe('Calle 10 # 38 - 93, Barranquilla');
    expect(parsed.durationMonths).toBe(3);
    expect(parsed.endDate).toBe('2025-08-23');
  });

  it('extrae correctamente el contrato 2022 de Carmelo Baltazar (salario $1.000.000)', () => {
    const text = `
    CONTRATO INDIVIDUAL DE TRABAJO A TÉRMINO FIJO
    EMPLEADOR: DISTRIBUCIONES ROSIMAR S.A.S.
    NIT: 901.167.955-4
    TRABAJADOR: CARMELO ANTONIO BALTAZAR YEPEZ
    C.C. 98.650.992
    CARGO: CONDUCTOR
    SALARIO: $ 1.000.000
    FORMA DE PAGO: QUINCENAL
    FECHA DE INICIACIÓN: 01 DE SEPTIEMBRE DE 2022
    FECHA DE VENCIMIENTO: 01 DE DICIEMBRE DE 2022
    DURACIÓN: TRES (3) MESES
    LUGAR DE EJECUCIÓN: BARRANQUILLA
    `;
    const parsed = parseContractText(text);
    expect(parsed.employerName).toBe('DISTRIBUCIONES ROSIMAR S.A.S.');
    expect(parsed.employerNit).toBe('901.167.955-4');
    expect(parsed.workerName.toUpperCase()).toBe('CARMELO ANTONIO BALTAZAR YEPEZ');
    expect(parsed.workerDocumentNumber).toBe('98650992');
    expect(parsed.position.toUpperCase()).toBe('CONDUCTOR');
    expect(parsed.salary).toBe(1000000);
    expect(parsed.startDate).toBe('2022-09-01');
    expect(parsed.endDate).toBe('2022-12-01');
    expect(parsed.paymentFrequency).toBe('quincenal');
  });

  it('extrae correctamente el contrato 2025 de Carmelo Baltazar (salario $1.423.500)', () => {
    const text = `
    CONTRATO INDIVIDUAL DE TRABAJO A TÉRMINO FIJO
    EMPLEADOR: DISTRIBUCIONES ROSIMAR S.A.S.
    NIT: 901.167.955-4
    TRABAJADOR: CARMELO ANTONIO BALTAZAR YEPEZ
    C.C. 98.650.992
    CARGO: CONDUCTOR
    SALARIO: $ 1.423.500
    FORMA DE PAGO: QUINCENAL
    FECHA DE INICIACIÓN: 04 DE ENERO DE 2025
    FECHA DE VENCIMIENTO: 04 DE ABRIL DE 2025
    DURACIÓN: TRES (3) MESES
    LUGAR DE EJECUCIÓN: BARRANQUILLA
    `;
    const parsed = parseContractText(text);
    expect(parsed.employerName).toBe('DISTRIBUCIONES ROSIMAR S.A.S.');
    expect(parsed.employerNit).toBe('901.167.955-4');
    expect(parsed.workerName.toUpperCase()).toBe('CARMELO ANTONIO BALTAZAR YEPEZ');
    expect(parsed.workerDocumentNumber).toBe('98650992');
    expect(parsed.position.toUpperCase()).toBe('CONDUCTOR');
    expect(parsed.salary).toBe(1423500);
    expect(parsed.startDate).toBe('2025-01-04');
    expect(parsed.endDate).toBe('2025-04-04');
    expect(parsed.paymentFrequency).toBe('quincenal');
  });

  it('preserva empleador de terceros en contrato de prestación de servicios sin sobreescribir con Rosimar', () => {
    const text = `
    CONTRATO DE PRESTACIÓN DE SERVICIOS
    ENTIDAD CONTRATANTE: Inversiones del Norte S.A.S.
    NIT: 800.987.654-3
    CONTRATISTA: CARMELO ANTONIO BALTAZAR YEPEZ
    DOCUMENTO: 98.650.992
    OBJETO: Transporte y distribución de mercancías en ruta nacional
    HONORARIOS: $ 5.000.000
    FORMA DE PAGO: MENSUAL
    FECHA DE INICIO: 15 DE ENERO DE 2024
    FECHA DE TERMINACIÓN: 15 DE JULIO DE 2024
    CIUDAD: BARRANQUILLA
    `;
    const parsed = parseContractText(text);
    expect(parsed.employerName).toBe('Inversiones del Norte S.A.S.');
    expect(parsed.employerNit).toBe('800.987.654-3');
    expect(parsed.employerName).not.toContain('Rosimar');
    expect(parsed.workerName.toUpperCase()).toBe('CARMELO ANTONIO BALTAZAR YEPEZ');
    expect(parsed.workerDocumentNumber).toBe('98650992');
    expect(parsed.salary).toBe(5000000);
    expect(parsed.startDate).toBe('2024-01-15');
    expect(parsed.endDate).toBe('2024-07-15');
    expect(parsed.paymentFrequency).toBe('mensual');
  });
});
