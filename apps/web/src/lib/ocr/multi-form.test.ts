import { describe, it, expect } from 'vitest';
import { processDocument } from './index';

/**
 * Regresion del expediente consolidado Rosimar ("Datos Personales y de Contrato").
 *
 * Un solo archivo mezcla datos de candidato, contrato, seguridad social y
 * liquidacion final. El lector debe llenar TODOS los formularios que el texto
 * contenga de forma independiente (no elige UNO y descarta el resto) para que
 * ninguna informacion del documento se pierda (ver shortlist del usuario).
 */

const DOC1 = `Datos Personales y de Contrato
Nombre: Ana Carina Mieles Molina
Cédula de Ciudadanía: 1.002.153.173
Cargo / Perfil: Asistente Administrativo (Contrato de Prestación de Servicios)
Empresa Empleadora: Distribuciones Rosimar S.A.S. (NIT 901.167.955-4)
Representante Legal: Gonzalo Gualdrón (C.C. 91.153.115)
Fecha de Nacimiento: 13 de junio de 2000
Dirección: Calle 62 # 1D - 44 (Barrio Santo Domingo), Barranquilla
Contacto: Cel. 3218055469 - 3002808775 | Correo: ancamimo06@gmail.com
Seguridad Social: EPS Sanitas | AFP Porvenir | ARL Positiva
Educación y Experiencia
Educación:
Bachiller Comercial y Técnico en Seguridad Ocupacional (Institución Educativa Distrital José Consuegra Higgins, 2017)
Asistente Administrativo (SENA - Centro Para El Desarrollo Agroecológico y Agroindustrial, 2018)
Experiencia Laboral: Prácticas en DIRECTV (6 meses)
Novedades y Pagos
3 de septiembre de 2022 (Comprobante de Egreso No. 17209): Pago por valor de $103.717 por concepto de servicios temporales.`;

const DOC2 = `Datos Personales y de Contrato
Nombre: Angel Reynel Becerra Cuellar
Cédula de Ciudadanía: 8.731.108
Cargo: Vendedor(a)
Empresa Empleadora: Distribuciones Rosimar S.A.S. (NIT 901.167.955-4)
Salario: $1.160.000 + $12 por cada 1 Kg vendido
Forma de Pago: Quincenal
Tipo de Contrato: Término fijo inferior a un año (3 meses iniciales)
Fecha de Inicio: 8 de marzo de 2023
Lugar de Trabajo: Barranquilla
Dirección de Notificación: Carrera 41 # 27C - 75, Barrio Costa Hermosa, Soledad
Historial Disciplinario
(No se registran memorandos ni llamados de atención en los documentos presentados)
Novedades de Nómina y Liquidación Final
27 de marzo de 2024 (Comprobante de Egreso): Liquidación y pago total por concepto de retiro por valor de $1.832.686, discriminado de la siguiente manera:
Vacaciones consolidadas: $1.215.905
Prima de servicios: $304.583
Cesantías consolidadas: $304.583
Intereses sobre cesantías: $7.615
Desvinculación
Fecha de Retiro: 8 de marzo de 2024
Motivo: Terminación del contrato de trabajo por vencimiento del plazo convenido (Art. 159 # 4 del Código Sustantivo del Trabajo).`;

const DOC3 = `Datos Personales y de Contrato
Nombre: Avis Manuel Ortiz Perez
Cédula de Ciudadanía: 19.895.754 (Expedida el 18 de agosto de 1985 en Soplaviento; nacido en Calamar, Bolívar el 4 de diciembre de 1965)
Estado Civil: Casado
Cargo: Vigilante
Empresa Empleadora: Distribuciones Rosimar S.A.S. (NIT 901.167.955-4)
Salario: $1.160.000
Forma de Pago: Quincenal
Tipo de Contrato: Término fijo inferior a un año (3 meses), con Otro Sí de Pacto de Exclusión Salarial
Fecha de Inicio: 16 de noviembre de 2023
Lugar de Trabajo: Barranquilla, Atlántico
Dirección de Residencia: Calle 77D # 8 - 138, Ciudad Bonita, Soledad
Contacto: Tel. 3207847858 | Correo: avismortizperez@gmail.com
Seguridad Social y Afiliaciones
EPS: Mutualser (Activo)
AFP: Colpensiones
ARL: Positiva
Caja de Compensación: Combarranquilla (Activo - Categoría A, afiliado desde el 16 de noviembre de 2023 a través de Distribuciones Rosimar S.A.S.)
Educación y Referencias
Estudios: Bachiller. Cursos cortos en el SENA (Electricidad y Cultivo de hortalizas).
Referencia Familiar: José Francisco Ortiz Pérez (Pastor) – Tel: 3107414542
Referencia Personal: Alberto Sepúlveda (Comerciante) – Tel: 3003349261
Historial Disciplinario y Desvinculación
(No se registran memorandos, llamados de atención ni documentos de retiro o liquidación en este expediente)`;

const procesar = (texto: string) =>
  processDocument(new File([texto], 'expediente.txt', { type: 'text/plain' }));

describe('Llenar todos los formularios de un expediente consolidado', () => {
  it('DOC1: candidato + salud (sin contrato ni liquidacion inventados)', async () => {
    const r = await procesar(DOC1);

    // Candidato completo.
    expect(r.candidateData?.documentNumber).toBe('1002153173');
    expect(r.candidateData?.phone).toMatch(/^3218055469/);
    expect(r.candidateData?.firstNames).toBe('Ana Carina');

    // Salud real.
    expect(r.healthData?.epsName).toBe('Sanitas');
    expect(r.healthData?.pensionFund).toBe('Porvenir');

    // DOC1 NO es un contrato ni una liquidacion: no se fuerza el formulario.
    expect(r.contractData).toBeUndefined();
    expect(r.liquidacionData).toBeUndefined();
  });

  it('DOC2: candidato + contrato + liquidacion final', async () => {
    const r = await procesar(DOC2);

    expect(r.candidateData?.documentNumber).toBe('8731108');
    expect(r.candidateData?.lastNames).toBe('Becerra Cuellar');

    // Contrato: nombre correcto (no "Historial Disciplinario"), tipo y salario.
    expect(r.contractData?.workerName).toBe('Angel Reynel Becerra Cuellar');
    expect(r.contractData?.contractType).toBe('termino_fijo');
    expect(r.contractData?.salary).toBe(1160000);

    // Liquidacion real: la nota de pago de servicios NO genera formulario.
    expect(r.liquidacionData?.totalLiquidacion).toBe(1832686);
    expect(r.liquidacionData?.vacaciones).toBe(1215905);
    expect(r.liquidacionData?.prima).toBe(304583);
    expect(r.liquidacionData?.cesantias).toBe(304583);
    expect(r.liquidacionData?.interesesCesantias).toBe(7615);

    // DOC2 no tiene afiliaciones de salud reales.
    expect(r.healthData).toBeUndefined();
  });

  it('DOC3: candidato + contrato + salud con Mutualser/Combarranquilla', async () => {
    const r = await procesar(DOC3);

    expect(r.candidateData?.documentNumber).toBe('19895754');
    expect(r.candidateData?.firstNames).toBe('Avis Manuel');
    expect(r.candidateData?.phone).toBe('3207847858');

    expect(r.contractData?.workerName).toBe('Avis Manuel Ortiz Perez');
    expect(r.contractData?.workerDocumentNumber).toBe('19895754');
    expect(r.contractData?.contractType).toBe('termino_fijo');

    // Salud del formato Rosimar: EPS Mutualser y caja Combarranquilla.
    expect(r.healthData?.epsName).toBe('Mutualser');
    expect(r.healthData?.compensationBox).toBe('Combarranquilla');
    expect(r.healthData?.pensionFund).toBe('Colpensiones');

    // DOC3 no lleva liquidacion final.
    expect(r.liquidacionData).toBeUndefined();
  });
});
