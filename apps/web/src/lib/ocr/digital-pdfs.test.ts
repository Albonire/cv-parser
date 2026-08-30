import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { parseCvText } from './parser-cv';
import { layoutFromPdfFile } from './__fixtures__/pdf-pipeline';
import { DocumentLayout } from './layout';

/**
 * Estas pruebas usan el pipeline real de la aplicacion (pdf.js -> palabras ->
 * maquetacion). Antes concatenaban `items.map(i => i.str)` en el orden crudo del
 * PDF, un orden que el parser nunca recibe en produccion: por eso pasaban en
 * verde mientras el lector fallaba con los mismos archivos.
 */
async function extractDigitalPdfText(pdfPath: string): Promise<DocumentLayout> {
  return layoutFromPdfFile(pdfPath);
}

describe('Pruebas exhaustivas con 8 PDFs digitales en español (sin OCR)', () => {
  const pdfDir = path.join(process.cwd(), 'test-pdfs');

  it('CV_01_DobleColumna_Ingeniero.pdf: debe extraer datos personales, posgrado, idiomas y certificaciones', async () => {
    const layout = await extractDigitalPdfText(path.join(pdfDir, 'CV_01_DobleColumna_Ingeniero.pdf'));
    const parsed = parseCvText(layout.text, layout);

    expect(parsed.firstNames).toBe('CAMILO ANDRÉS');
    expect(parsed.lastNames).toBe('VEGA ORTIZ');
    expect(parsed.documentNumber).toBe('1098765432');
    expect(parsed.email).toBe('camilo.vega@ingenieria.com');
    expect(parsed.phone).toBe('+57 318 456 7890');
    expect(parsed.cityResidence).toContain('Bucaramanga, Santander');
    expect(parsed.headline).toContain('Ingeniero de Automatización');

    // Idiomas
    expect(parsed.languages).toBeDefined();
    expect(parsed.languages?.some((l) => l.language === 'Inglés')).toBe(true);
    expect(parsed.languages?.some((l) => l.language === 'Francés')).toBe(true);

    // Certificaciones
    expect(parsed.certifications).toBeDefined();
    expect(parsed.certifications?.length).toBeGreaterThan(0);

    // Experiencia y Educacion
    expect(parsed.experience.length).toBeGreaterThan(0);
    expect(parsed.education.some((e) => e.level === 'Posgrado')).toBe(true);
    expect(parsed.references.length).toBeGreaterThan(0);
  });

  it('CV_02_Ejecutivo_Administrativo.pdf: debe extraer expectativa salarial, estado civil y disponibilidad', async () => {
    const layout = await extractDigitalPdfText(path.join(pdfDir, 'CV_02_Ejecutivo_Administrativo.pdf'));
    const parsed = parseCvText(layout.text, layout);

    expect(parsed.firstNames).toBe('VALERIA SOFÍA');
    expect(parsed.lastNames).toBe('RESTREPO HENAO');
    expect(parsed.documentNumber).toBe('1020304050');
    expect(parsed.email).toBe('valeria.restrepo@financiera.com');
    expect(parsed.cityResidence).toContain('Medellín, Antioquia');
    expect(parsed.maritalStatus).toBe('Casada');
    expect(parsed.salaryExpectation).toBe(5800000);
    expect(parsed.availability).toContain('Inmediata');
    expect(parsed.education.some((e) => e.level === 'Posgrado')).toBe(true);
    expect(parsed.languages?.some((l) => l.language === 'Inglés')).toBe(true);
  });

  it('CV_03_Tecnico_Industrial_SENA.pdf: debe extraer tecnico SENA, PAMPLONA y cursos de alturas', async () => {
    const layout = await extractDigitalPdfText(path.join(pdfDir, 'CV_03_Tecnico_Industrial_SENA.pdf'));
    const parsed = parseCvText(layout.text, layout);

    expect(parsed.firstNames).toBe('JORGE ELIÉCER');
    expect(parsed.lastNames).toBe('MORALES CASTRO');
    expect(parsed.documentNumber).toBe('1094876123');
    expect(parsed.cityResidence).toContain('Pamplona, Norte de Santander');
    expect(parsed.email).toBe('jorge.morales@tecnicos.co');
    expect(parsed.phone).toContain('314 567 8901');
    expect(parsed.maritalStatus).toBe('Soltero');
    expect(parsed.education.some((e) => e.level === 'Tecnico')).toBe(true);
    expect(parsed.certifications?.some((c) => c.name.includes('Alturas'))).toBe(true);
  });

  it('CV_04_Coordinadora_TalentoHumano.pdf: debe extraer psicologia, idiomas C1/B1 y aspiracion salarial', async () => {
    const layout = await extractDigitalPdfText(path.join(pdfDir, 'CV_04_Coordinadora_TalentoHumano.pdf'));
    const parsed = parseCvText(layout.text, layout);

    expect(parsed.firstNames).toBe('DIANA MARCELA');
    expect(parsed.lastNames).toBe('GUERRERO PARRA');
    expect(parsed.documentNumber).toBe('1092789456');
    expect(parsed.cityResidence).toContain('Bogotá, Cundinamarca');
    expect(parsed.salaryExpectation).toBe(4200000);
    expect(parsed.availability).toContain('15 días');
    expect(parsed.languages?.some((l) => l.language === 'Inglés')).toBe(true);
    expect(parsed.languages?.some((l) => l.language === 'Portugués')).toBe(true);
    expect(parsed.education.some((e) => e.degree.includes('Psicología'))).toBe(true);
  });

  it('CV_05_Diseno_Compacto_Multicursos.pdf: debe extraer multicursos AWS/PostgreSQL, Pereira e ingenieria', async () => {
    const layout = await extractDigitalPdfText(path.join(pdfDir, 'CV_05_Diseno_Compacto_Multicursos.pdf'));
    const parsed = parseCvText(layout.text, layout);

    expect(parsed.firstNames).toBe('SEBASTIÁN');
    expect(parsed.lastNames).toBe('QUINTERO ARDILA');
    expect(parsed.documentNumber).toBe('1088765432');
    expect(parsed.cityResidence).toContain('Pereira, Risaralda');
    expect(parsed.email).toBe('sebastian.quintero@devstack.org');
    expect(parsed.languages?.length).toBeGreaterThanOrEqual(2);
    expect(parsed.certifications?.length).toBeGreaterThanOrEqual(2);
    expect(parsed.experience.length).toBeGreaterThanOrEqual(2);
  });

  it('CV_06_SinTitulos_ParrafoDirecto.pdf: debe extraer resumen, experiencia, educacion y NIIF sin encabezados de seccion', async () => {
    const layout = await extractDigitalPdfText(path.join(pdfDir, 'CV_06_SinTitulos_ParrafoDirecto.pdf'));
    const parsed = parseCvText(layout.text, layout);

    expect(parsed.firstNames).toBe('MARÍA ALEJANDRA');
    expect(parsed.lastNames).toBe('OSORIO GÓMEZ');
    expect(parsed.documentNumber).toBe('1095678123');
    expect(parsed.headline).toContain('Contadora Pública');
    expect(parsed.cityResidence).toContain('Bucaramanga, Santander');
    // Resumen extraido sin encabezado 'RESUMEN'
    expect(parsed.summary).toContain('Contadora pública con 8 años de trayectoria');
    // Experiencia sin encabezado 'EXPERIENCIA'
    expect(parsed.experience.length).toBeGreaterThanOrEqual(1);
    // Educacion sin encabezado 'EDUCACION'
    expect(parsed.education.length).toBeGreaterThanOrEqual(1);
    // Idioma sin encabezado 'IDIOMAS'
    expect(parsed.languages?.some((l) => l.language === 'Inglés')).toBe(true);
    // Certificacion sin encabezado 'CERTIFICACIONES'
    expect(parsed.certifications?.some((c) => c.name.includes('Facturación'))).toBe(true);
  });

  it('CV_07_SinTitulos_EstiloMinimalista.pdf: debe extraer diseñador grafico, resumen y certificacion 3D sin encabezados', async () => {
    const layout = await extractDigitalPdfText(path.join(pdfDir, 'CV_07_SinTitulos_EstiloMinimalista.pdf'));
    const parsed = parseCvText(layout.text, layout);

    expect(parsed.firstNames).toBe('ANDRÉS FELIPE');
    expect(parsed.lastNames).toBe('CARMONA BEDOYA');
    expect(parsed.email).toBe('andres.carmona@creativo.com');
    expect(parsed.cityResidence).toContain('Medellín, Antioquia');
    expect(parsed.summary).toContain('Diseñador visual y productor multimedia');
    expect(parsed.experience.length).toBeGreaterThanOrEqual(1);
    expect(parsed.education.some((e) => e.degree.includes('Diseñador Gráfico'))).toBe(true);
    expect(parsed.certifications?.some((c) => c.name.includes('Animación 3D'))).toBe(true);
  });

  it('CV_08_SinTitulos_TecnicoOperativo.pdf: debe extraer tecnico Pamplona, calderas y alturas sin titulos', async () => {
    const layout = await extractDigitalPdfText(path.join(pdfDir, 'CV_08_SinTitulos_TecnicoOperativo.pdf'));
    const parsed = parseCvText(layout.text, layout);

    expect(parsed.firstNames).toBe('GUSTAVO ADOLFO');
    expect(parsed.lastNames).toBe('SILVA PEÑA');
    expect(parsed.documentNumber).toBe('1098456123');
    expect(parsed.cityResidence).toContain('Pamplona, Norte de Santander');
    expect(parsed.summary).toContain('Técnico electromecánico con 6 años de experiencia');
    expect(parsed.experience.length).toBeGreaterThanOrEqual(1);
    expect(parsed.education.some((e) => e.level === 'Tecnico')).toBe(true);
    expect(parsed.certifications?.some((c) => c.name.includes('Calderas') || c.name.includes('Alturas'))).toBe(true);
  });

  it('CV_09_Computrabajo_Junior.pdf: debe extraer licencia de conducción, libreta militar y perfil junior', async () => {
    const layout = await extractDigitalPdfText(path.join(pdfDir, 'CV_09_Computrabajo_Junior.pdf'));
    const parsed = parseCvText(layout.text, layout);

    expect(parsed.firstNames).toBe('JUAN DAVID');
    expect(parsed.lastNames).toBe('HERRERA RAMÍREZ');
    expect(parsed.driverLicense).toBe('C1');
    expect(parsed.militaryCard).toBe('Segunda clase');
    
    // Perfil Junior detectado
    expect(parsed.experience.length).toBe(1);
    expect(parsed.experience[0].company).toBe('Sin Experiencia / Perfil Junior');
  });

  it('CV_10_Formato_Publico_DAFP.pdf: debe extraer lugar de nacimiento, género, tarjeta profesional y redes', async () => {
    const layout = await extractDigitalPdfText(path.join(pdfDir, 'CV_10_Formato_Publico_DAFP.pdf'));
    const parsed = parseCvText(layout.text, layout);

    expect(parsed.firstNames).toBe('ANA MARÍA');
    expect(parsed.lastNames).toBe('PÉREZ LÓPEZ');
    expect(parsed.documentNumber).toBe('45987123');
    expect(parsed.gender).toBe('Femenino');
    expect(parsed.birthPlace).toBe('Bogotá D.C., Cundinamarca');
    expect(parsed.professionalCard).toBe('123456-T');
    
    // Redes
    expect(parsed.socialLinks?.length).toBeGreaterThanOrEqual(1);
    expect(parsed.socialLinks![0]).toContain('linkedin.com/in/anaperezlaw');
    
    expect(parsed.experience.length).toBeGreaterThanOrEqual(2);
  });
});
