import { describe, it, expect } from 'vitest';
import { parseCvText } from './parser-cv';
import { parseContractText } from './parser-contract';
import { parseIdCardText } from './parser-id';
import { parseHealthText } from './parser-health';
import { classifyDocumentType } from './document-classifier';
import { extractSkillsFromText } from './skills-taxonomy';
import { sortTextItemsByColumns, TextItemWithCoords } from './column-layout';

describe('Skills Taxonomy Extractor', () => {
  it('debe extraer habilidades tecnicas y blandas sin falsos positivos', () => {
    const text = 'Desarrollador con experiencia en Python, React, PostgreSQL, Docker y Trabajo en Equipo.';
    const skills = extractSkillsFromText(text);
    const names = skills.map((s) => s.skillName);

    expect(names).toContain('Python');
    expect(names).toContain('React');
    expect(names).toContain('PostgreSQL');
    expect(names).toContain('Docker');
    expect(names).toContain('Trabajo en Equipo');
  });
});

describe('Column Layout Segmenter', () => {
  it('debe ordenar bloques de 2 columnas separando la izquierda de la derecha', () => {
    const items: TextItemWithCoords[] = [
      { text: 'Datos Personales', x: 50, y: 100, width: 100, height: 12, fontSize: 12 },
      { text: 'Experiencia Laboral', x: 400, y: 100, width: 150, height: 12, fontSize: 12 },
      { text: 'Telefono: 3123456789', x: 50, y: 130, width: 120, height: 10, fontSize: 10 },
      { text: 'Empresa ABC - 2020 a 2023', x: 400, y: 130, width: 180, height: 10, fontSize: 10 },
    ];

    const result = sortTextItemsByColumns(items, 800);
    expect(result).toContain('Datos Personales');
    expect(result).toContain('Experiencia Laboral');
  });
});

describe('Document Classifier', () => {
  it('debe clasificar contratos de trabajo', () => {
    const contractText = 'CONTRATO INDIVIDUAL DE TRABAJO A TERMINO FIJO\nEntre el empleador Rosimar SAS y el trabajador con periodo de prueba de 60 dias.';
    expect(classifyDocumentType(contractText)).toBe('contract');
  });

  it('debe clasificar certificados de salud/EPS', () => {
    const healthText = 'CERTIFICADO DE AFILIACION EPS SANITAS\nSe certifica que el cotizante se encuentra en estado activo.';
    expect(classifyDocumentType(healthText)).toBe('health');
  });

  it('debe clasificar hojas de vida / CV', () => {
    const cvText = 'Juan Perez\nIngeniero de Sistemas\nExperiencia Laboral en desarrollo de software y bases de datos.';
    expect(classifyDocumentType(cvText)).toBe('cv');
  });
});

describe('Parser CV (Formulario 5.1)', () => {
  it('debe extraer datos personales, contacto y educacion de una hoja de vida', () => {
    const sampleCv = `
      ANDRES FELIPE ROJAS SUAREZ
      Ingeniero de Sistemas
      CC 1098765432
      Email: andres.rojas@gmail.com
      Celular: 315 876 5432
      Ciudad: Pamplona, Norte de Santander

      PERFIL PROFESIONAL
      Ingeniero de sistemas con 4 años de experiencia en desarrollo web con React, Node.js y PostgreSQL.

      EDUCACION
      Universitario: Ingenieria de Sistemas
      Universidad de Pamplona
      2021

      EXPERIENCIA LABORAL
      Empresa Soluciones Tech SAS
      Desarrollador Full Stack
      2021 - 2024
      Desarrollo de modulos y mantenimiento de bases de datos.
    `;

    const parsed = parseCvText(sampleCv);

    expect(parsed.firstNames).toBe('ANDRES FELIPE');
    expect(parsed.lastNames).toBe('ROJAS SUAREZ');
    expect(parsed.documentNumber).toBe('1098765432');
    expect(parsed.email).toBe('andres.rojas@gmail.com');
    expect(parsed.phone).toBe('315 876 5432');
    expect(parsed.education.length).toBeGreaterThan(0);
    expect(parsed.experience.length).toBeGreaterThan(0);
    expect(parsed.skills.some((s) => s.skillName === 'React')).toBe(true);
  });
});

describe('Parser Contrato (Formulario 5.2)', () => {
  it('debe extraer las condiciones contractuales en Colombia', () => {
    const sampleContract = `
      CONTRATO INDIVIDUAL DE TRABAJO A TERMINO FIJO
      EMPLEADOR: Rosimar S.A.S.
      NIT: 900.123.456-7
      TRABAJADOR: Maria Camila Torres Gomez
      CEDULA: 1090123456
      CARGO: Auxiliar Administrativo
      SALARIO: $ 1.600.000 COP
      FORMA DE PAGO: Mensual
      FECHA DE INICIO: 2024-02-01
      FECHA DE VENCIMIENTO: 2025-01-31
      PERIODO DE PRUEBA: 60 dias
      LUGAR DE TRABAJO: Pamplona, Norte de Santander
    `;

    const parsed = parseContractText(sampleContract);

    expect(parsed.employerName).toBe('Rosimar S.A.S.');
    expect(parsed.workerName).toBe('Maria Camila Torres Gomez');
    expect(parsed.workerDocumentNumber).toBe('1090123456');
    expect(parsed.position).toBe('Auxiliar Administrativo');
    expect(parsed.salary).toBe(1600000);
    expect(parsed.contractType).toBe('termino_fijo');
    expect(parsed.trialPeriodDays).toBe(60);
  });
});

describe('Parser Cedula e Identidad (Formulario 5.3)', () => {
  it('debe extraer cedula y nombres', () => {
    const sampleId = 'REPUBLICA DE COLOMBIA\nCEDULA DE CIUDADANIA\nNUMERO 1092837465\nNOMBRES CARLOS ANDRES\nAPELLIDOS RAMIREZ DUARTE';
    const parsed = parseIdCardText(sampleId);

    expect(parsed.documentNumber).toBe('1092837465');
    expect(parsed.firstNames).toBe('CARLOS ANDRES');
  });
});

describe('Parser Salud y Prestaciones (Formulario 5.4)', () => {
  it('debe identificar EPS y ARL', () => {
    const sampleHealth = 'CERTIFICADO DE AFILIACION\nEPS: SANITAS\nARL: SURA\nFONDO DE PENSIONES: PORVENIR\nCOTIZANTE: Pedro Perez\nDOCUMENTO: 1098123456';
    const parsed = parseHealthText(sampleHealth);

    expect(parsed.epsName).toBe('Sanitas');
    expect(parsed.arlName).toBe('ARL SURA');
    expect(parsed.pensionFund).toBe('Porvenir');
    expect(parsed.documentNumber).toBe('1098123456');
  });
});
