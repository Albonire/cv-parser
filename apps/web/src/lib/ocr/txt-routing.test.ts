import { describe, it, expect } from 'vitest';
import { processDocument } from './index';

/**
 * Un documento de texto nativo (.txt) debe processarse SIN OCR: el texto es
 * autoritativo, no hay ruido optico que medir y no deben saltar falsas alarmas
 * de "documento ilegible". El resultado debe mapear los campos del candidato.
 */
const TEXTO_CV = `Datos Personales y de Contrato

Nombre: Ana Carina Mieles Molina
Cedula de Ciudadania: 1.002.153.173
Cargo / Perfil: Asistente Administrativo
Empresa Empleadora: Distribuciones Rosimar S.A.S.
Representante Legal: Gonzalo Gualdron
Fecha de Nacimiento: 13 de junio de 2000
Direccion: Calle 62 # 1D - 44, Barranquilla
Contacto: cel 3218055469 | Correo: ancamimo06@gmail.com
Seguridad Social: EPS Sanitas | AFP Porvenir | ARL Positiva

Formacion Academica
Bachiller Comercial - Jose Consuegra Higgins, 2017

Experiencia Laboral
Asistente Administrativo - DRECTV, 2018
`;

describe('Lectura de documentos de texto nativo (.txt)', () => {
  it('procesa el .txt sin OCR y llena el formulario de candidato', async () => {
    const file = new File([TEXTO_CV], 'perfil-candidato.txt', { type: 'text/plain' });
    const resultado = await processDocument(file);

    expect(resultado.method).toBe('txt');
    expect(resultado.detectedType).toBe('cv');
    expect(resultado.candidateData?.firstNames).toBe('Ana Carina');
    expect(resultado.candidateData?.lastNames).toBe('Mieles Molina');
    expect(resultado.candidateData?.documentNumber).toBe('1002153173');
    expect(resultado.candidateData?.email).toBe('ancamimo06@gmail.com');
    expect(resultado.candidateData?.phone).toMatch(/^3218055469/);
  });

  it('no dispara la falsa alarma de documento ilegible en texto nativo', async () => {
    const file = new File([TEXTO_CV], 'perfil-candidato.txt', { type: 'text/plain' });
    const resultado = await processDocument(file);

    const warnings = resultado.warnings ?? [];
    expect(warnings.some((w) => /ilegible/i.test(w))).toBe(false);
  });

  it('soporta la extension .text como alias de texto plano', async () => {
    const file = new File([TEXTO_CV], 'curriculum.text', { type: 'text/plain' });
    const resultado = await processDocument(file);
    expect(resultado.method).toBe('txt');
  });
});
