import { describe, it, expect } from 'vitest';
import { parseCvText } from './parser-cv';
import { parseContractText } from './parser-contract';
import { parseIdCardText } from './parser-id';
import { parseHealthText } from './parser-health';
import { classifyDocumentType, clasificarHistorial } from './document-classifier';
import { buscarCedulaEnTexto } from '../offline/expediente';
import { extractSkillsFromText } from './skills-taxonomy';
import { buildLayout, Word } from './layout';

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

describe('Motor de maquetacion', () => {
  function palabra(text: string, x: number, y: number, width: number, fontSize = 10): Word {
    return { text, x, y, width, height: fontSize, fontSize, confidence: 1 };
  }

  it('lee primero la columna izquierda completa y despues la derecha', () => {
    // Caso real de CV_01: barra lateral estrecha a la izquierda y contenido a la
    // derecha. Los titulos cortos de la derecha ("EDUCACION") caian antes en la
    // columna izquierda porque la pagina se partia por la mitad exacta.
    const words: Word[] = [
      palabra('CONTACTO', 40, 40, 60, 11),
      palabra('Celular: 318 456 7890', 40, 60, 100),
      palabra('HABILIDADES', 40, 90, 70, 11),
      palabra('Python', 40, 110, 40),
      palabra('IDIOMAS', 40, 140, 50, 11),
      palabra('Ingles: C1', 40, 160, 45),
      palabra('Frances: B1', 40, 180, 50),
      palabra('CERTIFICACIONES', 40, 210, 90, 11),
      palabra('Scrum Master', 40, 230, 65),
      palabra('CAMILO ANDRES VEGA ORTIZ', 300, 40, 200, 16),
      palabra('EXPERIENCIA LABORAL', 300, 90, 120, 11),
      palabra('Soluciones Mecatronicas SAS', 300, 110, 160),
      palabra('EDUCACION', 300, 140, 70, 11),
      palabra('Universidad Industrial de Santander', 300, 160, 190),
      palabra('REFERENCIAS', 300, 210, 80, 11),
      palabra('Ing. Rodrigo Perez - 310 987 6543', 300, 230, 185),
    ];

    const layout = buildLayout([{ words, width: 595, height: 842 }]);
    const lineas = layout.lines.map((l) => l.text);

    expect(layout.columnsPerPage).toEqual([2]);
    // Ningun renglon mezcla las dos columnas.
    expect(lineas).not.toContain('IDIOMAS EDUCACION');
    expect(lineas.some((l) => l.includes('IDIOMAS') && l.includes('EDUCACION'))).toBe(false);
    // La columna izquierda va completa antes de la derecha.
    expect(lineas.indexOf('IDIOMAS')).toBeLessThan(lineas.indexOf('CAMILO ANDRES VEGA ORTIZ'));
    // Cada titulo queda pegado a su propio contenido.
    expect(lineas.indexOf('EXPERIENCIA LABORAL') + 1).toBe(
      lineas.indexOf('Soluciones Mecatronicas SAS')
    );
    expect(lineas.indexOf('EDUCACION') + 1).toBe(
      lineas.indexOf('Universidad Industrial de Santander')
    );
  });

  it('no parte en columnas un formulario con etiqueta y valor en el mismo renglon', () => {
    // Caso real de CV_10 (formato DAFP): una sola columna con dos campos por
    // renglon. Partirla separaba cada "Cargo:" de su "Empresa:".
    const words: Word[] = [
      palabra('NOMBRES: ANA MARIA', 45, 40, 150, 9),
      palabra('APELLIDOS: PEREZ LOPEZ', 255, 40, 160, 9),
      palabra('Cedula de ciudadania No.: 45987123', 45, 60, 195, 9),
      palabra('Sexo: Femenino', 255, 60, 100, 9),
      palabra('Lugar de nacimiento: Bogota D.C.', 45, 80, 195, 9),
      palabra('Nacionalidad: Colombiana', 297, 80, 150, 9),
      palabra('Empresa: Ministerio de Justicia', 45, 100, 190, 9),
      palabra('Cargo: Asesora Juridica', 340, 100, 140, 9),
      palabra('Titulo: Especialista en Derecho Administrativo', 198, 120, 250, 9),
    ];

    const layout = buildLayout([{ words, width: 595, height: 842 }]);

    expect(layout.columnsPerPage).toEqual([1]);
    // Etiqueta y valor permanecen en el mismo renglon.
    expect(layout.lines[0].text).toContain('NOMBRES: ANA MARIA');
    expect(layout.lines[0].text).toContain('APELLIDOS: PEREZ LOPEZ');
    expect(layout.lines.some((l) => l.text.includes('Empresa') && l.text.includes('Cargo'))).toBe(
      true
    );
  });

  it('no confunde una columna de fechas alineada a la derecha con dos columnas', () => {
    const words: Word[] = [
      palabra('Soluciones Mecatronicas SAS', 40, 40, 200),
      palabra('2021-2023', 480, 40, 60),
      palabra('Lider tecnico de automatizacion', 40, 60, 220),
      palabra('Robotica Andina Ltda', 40, 90, 180),
      palabra('2018-2021', 480, 90, 60),
      palabra('Desarrollador de firmware', 40, 110, 190),
    ];

    const layout = buildLayout([{ words, width: 595, height: 842 }]);

    expect(layout.columnsPerPage).toEqual([1]);
    expect(layout.lines[0].text).toContain('Soluciones Mecatronicas SAS');
    expect(layout.lines[0].text).toContain('2021-2023');
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

describe('Clasificador historico (expediente por empleado)', () => {
  /**
   * Texto OCR real de fotos de WhatsApp de empleados antiguos de Rosimar
   * (carpeta ALIBIS CALLEJAS). Verifican que documentos que NO son hoja de
   * vida no se fuerzan a un CV vacio y se asignan a su categoria de historial.
   */

  it('contrato degradado (palabras pegadas) -> contract / contrato', () => {
    const texto =
      'AA MPILEADOR y ELA) ... INFERIOR ... TÉRMINOACONTRATO 1 A | INFERIORFIJOINDIVIDUAL ErinFIOINQUINCENAL$2.059.089 NIT€D1.1097€DSTACENA GALAPA';
    expect(clasificarHistorial(texto)).toBe('contrato');
    expect(classifyDocumentType(texto)).toBe('contract');
  });

  it('contrato degradado (foto real pegada por el usuario) -> contract', () => {
    // Texto OCR real, muy degradado, que el usuario vio como "hoja de vida vacia".
    const texto =
      'AA / -MPILEADOR / y ELA) ula al piedede las Me,s, J se INFERIOR PION rs-CS LsmegEpaAma oeEASUSTANTNANIC(YO) enemiesOIveueAi1TERRI EEAGIAUYrT E PG TÉRMINOACONTRATO 1 A | INFERIORFIJOINDIVIDUAL ErinFIOINQUINCENAL$2.059.089TRACIONAOSsd~ALMSCALLEJASOSOCMANL.COM CALLESHE:325VILLA OLIMPICA ALTCALLEJAS NIT€D1.1097 AÑO GALAPA';
    expect(classifyDocumentType(texto)).toBe('contract');
    expect(clasificarHistorial(texto)).toBe('contrato');
  });

  it('contrato OCR limpio -> contract / contrato', () => {
    const texto =
      'CONTRATO INDIVIDUAL DE TRABAJO A TÉRMINO FIJO INFERIOR A UN AÑO ... EMPLEADOR ... CC No. 32.891.622';
    expect(clasificarHistorial(texto)).toBe('contrato');
    expect(classifyDocumentType(texto)).toBe('contract');
  });

  it('memorando -> unknown / memorando (no CV) ni formulario', () => {
    const texto =
      'MEMORANDO No. 026\nPARA: ALIBIS CALLEJAS NAVARRO\nDE: DISTRIBUCIONES ROSIMAR SAS\nASUNTO: NO HACER SOPORTE DE RECIBIDO DE MERCANCIA\nFECHA: 24/05/2021';
    expect(clasificarHistorial(texto)).toBe('memorando');
    expect(classifyDocumentType(texto)).toBe('unknown');
  });

  it('llamado de atencion -> unknown / llamado_atencion', () => {
    const texto =
      'LLAMADO DE ATENCIÓN No. 033\nPARA: ALIBIS CALLEJAS\nDE: DISTRIBUCIONES ROSIMAR SAS\nASUNTO: NO COLOCAR FECHA A CONSIGNACIONES';
    expect(clasificarHistorial(texto)).toBe('llamado_atencion');
    expect(classifyDocumentType(texto)).toBe('unknown');
  });

  it('consulta de Seguridad Social -> health / salud', () => {
    const texto =
      'Resultados de la consulta de Seguridad Social\nInformación Básica del Afiliado\nNÚMERO DE IDENTIFICACION 32891622\nNOMBRES ALIBIS\nAPELLIDOS CALLEJAS NAVARRO\nMUNICIPIO BARRANQUILLA';
    expect(clasificarHistorial(texto)).toBe('salud');
    expect(classifyDocumentType(texto)).toBe('health');
  });

  it('funciones de cargo -> unknown / funciones', () => {
    const texto =
      'DISTRIBUCIONES ROSIMAR SAS\nFUNCIONES\nADMINISTRADORA PUNTO DE VENTA\nRealizar apertura y cierre del almacén\nCuadre diario de caja';
    expect(clasificarHistorial(texto)).toBe('funciones');
    expect(classifyDocumentType(texto)).toBe('unknown');
  });

  it('renuncia -> unknown / renuncia', () => {
    const texto = 'CARTA DE RENUNCIA\nPor medio de la presente presento mi renuncia al cargo de Auxiliar.';
    expect(clasificarHistorial(texto)).toBe('renuncia');
    expect(classifyDocumentType(texto)).toBe('unknown');
  });

  it('localiza la cedula dentro del texto OCR del documento', () => {
    const texto = 'CC No. 32.891.622 CALLE 84 # 56 - 36 VILLA OLIMPICA GALAPA';
    expect(buscarCedulaEnTexto(texto)).toBe('32891622');
  });

  it('no toma un telefono largo como cedula', () => {
    const texto = 'Telefonos: 3138587655 WhatsApp 3001234567';
    const cedula = buscarCedulaEnTexto(texto);
    // No debe devolver ningun numero de telefono como cedula de documento.
    expect(cedula).toBeUndefined();
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
