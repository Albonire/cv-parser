import { describe, it, expect } from 'vitest';
import { parseCvText } from './parser-cv';
import { layoutFromPlainText } from './layout';
import { extractSkillsFromText } from './skills-taxonomy';
import { detectarTextoIninteligible } from './index';

/**
 * Regresion de la extraccion sobre el escaneo real "Datos Personales y de
 * Contrato.pdf" (candidato Dagoberto Fuentes, conductor de Rosimar).
 * Estos bug fixes cubren:
 *
 * 1. Falsa alarma de "gibberish" por numeros/cedula/telefonos con separadores.
 * 2. Correo tomado de una referencia personal en vez del candidato.
 * 3. Etiqueta "Educacion:" colada al titulo e institucion.
 * 4. Encabezado de seccion ("Formacion Academica y Perfil Profesional") como titular.
 * 5. Skills falsas ("C", "Seguridad Social").
 * 6. Nombres de referencia con basura "(Telefono: )".
 * 7. Experiencia previa "Empresa: Cargo (año - año)" no extraida.
 */

const TEXTO = [
  'Datos Personales y de Identificación',
  'Nombre: Dagoberto Enrique Fuentes Palacio',
  'Cédula de Ciudadanía: 72.222.293 (nacido en Barranquilla el 4 de agosto de 1970)',
  'Estado Civil: Unión libre',
  'Dirección de Residencia: Cra. 6 # 134 - 80, Bloque 7, Torre 3, Apto. 411, Barranquilla',
  'Teléfonos de Contacto: 320 230 0957 / 314 825 4909',
  'Licencia de Conducción: Categorías B4 (Particular) y C2 (Público)',
  'Formación Académica y Perfil Profesional',
  'Educación: Básica Primaria - Institución Educativa Distrital La Comunal (1982).',
  'Historial Laboral y Experiencia',
  'Distribuciones Rosimar S.A.S.:',
  'Cargo: Conductor - Repartidor',
  'Salario: $1.300.000',
  'Experiencia Previa:',
  'Transportadora Distransa: Conductor (2022 - 2023)',
  'Transportadora TSCC: Conductor (2012 - 2021)',
  'Molino Barranquillita: Conductor (2000 - 2012)',
  'Seguridad Social y Afiliaciones',
  'Referencias',
  'Luis Sotto (Teléfono: 324 578 0115)',
  'Eucaris Guete Medrano (Teléfono: 314 825 4909 / E-mail: eucarisguete8@gmail.com)',
].join('\n');

describe('Extraccion del escaneo real "Datos Personales y de Contrato"', () => {
  it('no marca numeros, cedula y telefonos como gibberish', () => {
    const r = detectarTextoIninteligible(
      'Cedula: 72.222.293\nTelefonos: 320 230 0957 / 314 825 4909\nNacido el 04/08/1970\nSalario: $1.300.000'
    );
    expect(r.esIninteligible).toBe(false);
  });

  it('extrae datos personales correctamente y sin basura', () => {
    const parsed = parseCvText(TEXTO, layoutFromPlainText(TEXTO));
    expect(parsed.firstNames).toBe('Dagoberto Enrique');
    expect(parsed.lastNames).toBe('Fuentes Palacio');
    expect(parsed.documentNumber).toBe('72222293');
    expect(parsed.cityResidence).toBe('Barranquilla');
    expect(parsed.driverLicense).toBe('C2');
  });

  it('no toma el correo de una referencia personal', () => {
    const parsed = parseCvText(TEXTO, layoutFromPlainText(TEXTO));
    expect(parsed.email ?? '').not.toContain('eucarisguete8@gmail.com');
    expect(parsed.email ?? '').not.toContain('@');
  });

  it('no usa un encabezado de seccion como titular', () => {
    const parsed = parseCvText(TEXTO, layoutFromPlainText(TEXTO));
    expect(parsed.headline ?? '').not.toMatch(/formaci[oó]n acad[eé]mica/i);
    expect(parsed.headline ?? '').not.toMatch(/perfil profesional/i);
  });

  it('no contamina la educacion con la etiqueta "Educacion:"', () => {
    const parsed = parseCvText(TEXTO, layoutFromPlainText(TEXTO));
    const edu = parsed.education[0];
    expect(edu.institution.toLowerCase()).toContain('la comunal');
    expect(edu.institution.toLowerCase()).not.toContain('educación:');
    expect(edu.degree.toLowerCase()).toBe('básica primaria');
  });

  it('extrae la experiencia previa "Empresa: Cargo (año - año)"', () => {
    const parsed = parseCvText(TEXTO, layoutFromPlainText(TEXTO));
    const distransa = parsed.experience.find((e) => e.company.includes('Distransa'));
    expect(distransa).toBeTruthy();
    expect(distransa?.position).toBe('Conductor');
    expect(distransa?.startDate).toBe('2022');
    expect(distransa?.endDate).toBe('2023');
    const molino = parsed.experience.find((e) => e.company.includes('Molino'));
    expect(molino?.position).toBe('Conductor');
  });

  it('limpia los nombres de referencias', () => {
    const parsed = parseCvText(TEXTO, layoutFromPlainText(TEXTO));
    const luises = parsed.references.find((r) => r.name.includes('Luis'));
    expect(luises?.name).toBe('Luis Sotto');
    const eucaris = parsed.references.find((r) => r.name.includes('Eucaris'));
    expect(eucaris?.name).toBe('Eucaris Guete Medrano');
    for (const r of parsed.references) {
      expect(r.name).not.toMatch(/Tel[eé]fono|E-mail|\(\)/i);
    }
  });

  it('no inventa skills como "C" ni "Seguridad Social" desde encabezados', () => {
    const skills = extractSkillsFromText(TEXTO);
    const nombres = skills.map((s) => s.skillName);
    expect(nombres).not.toContain('C');
    expect(nombres).not.toContain('R');
    expect(nombres).not.toContain('Seguridad Social');
  });
});
