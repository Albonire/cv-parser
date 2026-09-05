import { describe, it, expect } from 'vitest';
import { parsearMonto } from './parse-helpers';
import { extractSkillsFromText } from './skills-taxonomy';
import { extraerHabilidades } from './fields/skills';
import { parseCvText } from './parser-cv';
import { parseContractText } from './parser-contract';

describe('Plan Correccion Input/Output Real - Unit Tests', () => {
  describe('1. parsearMonto sin TypeError en comas y centavos', () => {
    it('parsea "$ 442,266.00" a 442266 sin lanzar TypeError', () => {
      expect(() => parsearMonto('$ 442,266.00')).not.toThrow();
      expect(parsearMonto('$ 442,266.00')).toBe(442266);
    });

    it('parsea montos con separadores de miles y centavos colombianos o anglosajones', () => {
      expect(parsearMonto('$ 442.266,00')).toBe(442266);
      expect(parsearMonto('$ 1.500.000')).toBe(1500000);
      expect(parsearMonto('$ 1,500,000')).toBe(1500000);
      expect(parsearMonto('$ 1,423,500.00')).toBe(1423500);
      expect(parsearMonto('$ 1.423.500,00')).toBe(1423500);
      expect(parsearMonto('1234.56')).toBe(1234);
      expect(parsearMonto('$ 442.266')).toBe(442266);
      expect(parsearMonto('$ 50.000,00')).toBe(50000);
      expect(parsearMonto('442266')).toBe(442266);
      expect(parsearMonto('')).toBeUndefined();
    });
  });

  describe('2. Exclusión de "C" como lenguaje desde bloques de cédula / C.C.', () => {
    it('no extrae "C" cuando proviene de C.C., C.C, CC o cédula', () => {
      const texto1 = 'C.C. 1098765432 expedida en Bucaramanga. Desarrollador web.';
      const skills1 = extractSkillsFromText(texto1);
      expect(skills1.some((s) => s.skillName === 'C')).toBe(false);

      const texto2 = 'C.C 98.765.432 de Medellín. Habilidades: Python, JavaScript.';
      const skills2 = extractSkillsFromText(texto2);
      expect(skills2.some((s) => s.skillName === 'C')).toBe(false);
      expect(skills2.some((s) => s.skillName === 'Python')).toBe(true);

      const texto3 = 'Identificación: CC 1234567890';
      const skills3 = extraerHabilidades(texto3);
      expect(skills3.some((s) => s.skillName === 'C')).toBe(false);

      const texto4 = 'Cedula de ciudadania: C. C. 1050234987';
      const skills4 = extractSkillsFromText(texto4);
      expect(skills4.some((s) => s.skillName === 'C')).toBe(false);

      // Espacios antes de los puntos generados comúnmente por OCR
      const texto5 = 'C . C . 1098765432 expedida en Bogota';
      const skills5 = extractSkillsFromText(texto5);
      expect(skills5.some((s) => s.skillName === 'C')).toBe(false);

      const texto6 = 'C . C 1098765432 de Cali';
      const skills6 = extractSkillsFromText(texto6);
      expect(skills6.some((s) => s.skillName === 'C')).toBe(false);
    });

    it('sí extrae "C" cuando está listado como lenguaje de programación real', () => {
      const textoC = 'Lenguajes de programación: C, Python, JavaScript.';
      const skillsC = extractSkillsFromText(textoC);
      expect(skillsC.some((s) => s.skillName === 'C')).toBe(true);
      expect(skillsC.some((s) => s.skillName === 'Python')).toBe(true);

      const textoCpp = 'Dominio de C/C++ y Rust para sistemas embebidos.';
      const skillsCpp = extractSkillsFromText(textoCpp);
      expect(skillsCpp.some((s) => s.skillName === 'C')).toBe(true);
      expect(skillsCpp.some((s) => s.skillName === 'C++')).toBe(true);
      expect(skillsCpp.some((s) => s.skillName === 'Rust')).toBe(true);

      // C# no debe activar C
      const textoCs = 'Experiencia en C# y .NET Core.';
      const skillsCs = extractSkillsFromText(textoCs);
      expect(skillsCs.some((s) => s.skillName === 'C')).toBe(false);
      expect(skillsCs.some((s) => s.skillName === 'C#')).toBe(true);
    });
  });

  describe('3. Protección de nombre de candidato ante página de referencias sin datos personales', () => {
    it('no asigna el nombre de una referencia como el del candidato cuando falta sección personal', () => {
      const textoReferencias = `
REFERENCIAS PERSONALES
Oliver Berrio Polo
Teléfono: 310 123 4567
Parentesco: Amigo

Jorge Marquez
Teléfono: 312 987 6543
Parentesco: Compañero de trabajo
      `;

      const parsed = parseCvText(textoReferencias);

      // El nombre del candidato no debe ser el de Oliver Berrio Polo
      expect(parsed.firstNames).not.toBe('Oliver');
      expect(parsed.lastNames).not.toContain('Berrio');
      expect(parsed.firstNames).toBe('');
      expect(parsed.lastNames).toBe('');

      // Las referencias sí deben haberse extraído en la lista de referencias
      expect(parsed.references.some((r) => r.name.includes('Oliver'))).toBe(true);
      expect(parsed.references.some((r) => r.name.includes('Jorge'))).toBe(true);
    });

    it('extrae el nombre de referencia multilínea que tiene cargo y empresa antes del teléfono', () => {
      const textoMulti = `
REFERENCIAS PERSONALES
Oliver Berrio Polo
Cargo: Ingeniero Civil
Empresa: Constructora del Norte S.A.S.
Teléfono: 310 123 4567
Parentesco: Amigo
      `;

      const parsed = parseCvText(textoMulti);
      expect(parsed.references.length).toBeGreaterThan(0);
      expect(parsed.references[0].name).toBe('Oliver Berrio Polo');
      expect(parsed.references[0].phone).toBe('310 123 4567');
    });

    it('no elimina el nombre del candidato cuando el CV tiene datos personales y una referencia comparte un nombre común', () => {
      const textoCvCompleto = `
CARLOS EDUARDO GOMEZ
carlos.gomez@email.com
Teléfono: 300 111 2233
Bogotá, Colombia

EXPERIENCIA LABORAL
Desarrollador de software en TechCorp

REFERENCIAS PERSONALES
Carlos Alberto Perez
Teléfono: 311 444 5566
      `;

      const parsed = parseCvText(textoCvCompleto);
      expect(parsed.firstNames.toUpperCase()).toContain('CARLOS');
      expect(parsed.lastNames.toUpperCase()).toContain('GOMEZ');
      expect(parsed.references.some((r) => r.name.includes('Carlos Alberto'))).toBe(true);
    });
  });

  describe('4. Refinamiento en parser-contract.ts', () => {
    it('descarta subtítulos de tabla, preaviso y cláusulas de workerName', () => {
      const textoClausulas = `
CONTRATO INDIVIDUAL DE TRABAJO A TERMINO FIJO
EMPLEADOR: DISTRIBUCIONES ROSIMAR S.A.S.
NIT: 901.167.955-4
GENERALIDADES DE LEY
CLAUSULA PRIMERA: OBJETO DEL CONTRATO
TERMINACION DEL CONTRATO
VENCIMIENTO: 04 DE ABRIL 2025
CONDICIONES
ISO DE TERMINACION
Trabajador: 15 dias. Empleador: 30 dias.
SALARIO: $ 1.423.500
FECHA DE INICIO: 04 DE ENERO 2025
      `;

      const parsed = parseContractText(textoClausulas);

      expect(parsed.workerName).not.toContain('GENERALIDADES');
      expect(parsed.workerName).not.toContain('TERMINACION');
      expect(parsed.workerName).not.toContain('VENCIMIENTO');
      expect(parsed.workerName).not.toContain('CONDICIONES');
      expect(parsed.workerName).not.toContain('CLAUSULA');
      expect(parsed.workerName).not.toContain('ISO DE TERMINACION');
      expect(parsed.workerName).not.toContain('15');
      expect(parsed.workerName).not.toContain('dias');
    });

    it('no asigna la fecha de vencimiento del contrato como workerDateOfBirth', () => {
      const textoContratoFechas = `
CONTRATO DE TRABAJO A TERMINO FIJO
EMPLEADOR: DISTRIBUCIONES ROSIMAR S.A.S.
TRABAJADOR: GUSTAVO MONTENEGRO
FECHA DE INICIACION: 04 DE ENERO 2025
FECHA DE VENCIMIENTO: 04 DE ABRIL 2025
SALARIO: $ 1.423.500
CARGO: CONDUCTOR
      `;

      const parsed = parseContractText(textoContratoFechas);

      expect(parsed.startDate).toBe('2025-01-04');
      expect(parsed.endDate).toBe('2025-04-04');
      expect(parsed.workerDateOfBirth).not.toBe('2025-04-04');
      expect(parsed.workerDateOfBirth).not.toBe('2025-01-04');
    });

    it('reconoce el salario 423500 como 1423500 por omisión del 1. en SMLMV 2025', () => {
      const textoSalarioOcr = `
CONTRATO DE TRABAJO A TERMINO FIJO
EMPLEADOR: DISTRIBUCIONES ROSIMAR S.A.S.
TRABAJADOR: GUSTAVO MONTENEGRO
CARGO: CONDUCTOR
ORAR A 423500
FECHA DE INICIACION: 04 DE ENERO 2025
FECHA DE VENCIMIENTO: 04 DE ABRIL 2025
      `;

      const parsed = parseContractText(textoSalarioOcr);
      expect(parsed.salary).toBe(1423500);
    });

    it('reconoce el salario con decimales .00 o ,00 sin multiplicarlo por 100', () => {
      const textoSalarioCentavos = `
CONTRATO DE TRABAJO A TERMINO FIJO
EMPLEADOR: DISTRIBUCIONES ROSIMAR S.A.S.
TRABAJADOR: GUSTAVO MONTENEGRO
CARGO: CONDUCTOR
SALARIO: $ 1.423.500,00
FECHA DE INICIACION: 04 DE ENERO 2025
FECHA DE VENCIMIENTO: 04 DE ABRIL 2025
      `;

      const parsed = parseContractText(textoSalarioCentavos);
      expect(parsed.salary).toBe(1423500);

      const textoSalario423Centavos = `
CONTRATO DE TRABAJO A TERMINO FIJO
EMPLEADOR: DISTRIBUCIONES ROSIMAR S.A.S.
TRABAJADOR: GUSTAVO MONTENEGRO
CARGO: CONDUCTOR
SALARIO: $ 423.500.00
FECHA DE INICIACION: 04 DE ENERO 2025
FECHA DE VENCIMIENTO: 04 DE ABRIL 2025
      `;

      const parsed423 = parseContractText(textoSalario423Centavos);
      expect(parsed423.salary).toBe(1423500);
    });

    it('no sobreescribe con Rosimar en contratos de terceros con correo corporativo no Rosimar', () => {
      const textoTercero = `
CONTRATO DE TRABAJO A TERMINO FIJO
EMPLEADOR: TEXTILES DEL VALLE
CORREO: TEXTILES@OUTLOOK.COM
TRABAJADOR: PEDRO PEREZ
CARGO: OPERARIO DE CORTE
SALARIO: $ 1.500.000
FECHA DE INICIO: 01 DE FEBRERO 2025
FECHA DE VENCIMIENTO: 31 DE JULIO 2025
      `;

      const parsed = parseContractText(textoTercero);

      expect(parsed.employerName).not.toMatch(/rosimar/i);
      expect(parsed.employerEmail).toBe('textiles@outlook.com');
      expect(parsed.employerNit).not.toBe('901.167.955-4');
    });
  });
});
