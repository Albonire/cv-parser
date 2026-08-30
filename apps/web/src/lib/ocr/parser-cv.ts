import { CandidateFormData } from '../../types/candidate';
import { DocumentLayout, LayoutLine, layoutFromPlainText } from './layout';
import { detectSections, hasExplicitHeadings, linesOfKind, Section } from './sections';
import { extraerDatosPersonales } from './fields/personal';
import { extraerExperiencia } from './fields/experience';
import { extraerEducacion } from './fields/education';
import { extraerCertificaciones, extraerIdiomas, extraerReferencias, extraerResumen } from './fields/extras';
import { extractSkillsFromText } from './skills-taxonomy';

/**
 * Parser determinista de hojas de vida.
 *
 * Trabaja sobre la maquetacion reconstruida (`DocumentLayout`), no sobre texto
 * plano: primero segmenta el documento en secciones usando el lexico de titulos
 * junto con las señales de formato (negrita, mayusculas, tamaño de fuente) y
 * despues aplica un extractor por campo. Cuando solo se dispone de texto plano
 * (documentos Word o pruebas), se construye una maquetacion equivalente.
 *
 * Sin llamadas a modelos de lenguaje: todo sale de reglas, gazetteers y del
 * diccionario configurable de cargos.
 */
export function parseCvText(text: string, layout?: DocumentLayout): CandidateFormData {
  const documento = layout ?? layoutFromPlainText(text);
  const secciones = detectSections(documento);
  const conEncabezados = hasExplicitHeadings(secciones);

  const encabezado = lineasEncabezado(secciones, documento.lines);
  const todas = documento.lines;

  const personales = extraerDatosPersonales(encabezado, todas);

  const experiencia = extraerExperiencia(
    linesOfKind(secciones, 'experiencia'),
    todas,
    conEncabezados
  );

  const educacion = extraerEducacion(
    linesOfKind(secciones, 'educacion'),
    todas,
    conEncabezados
  );

  const idiomas = extraerIdiomas(linesOfKind(secciones, 'idiomas'), todas);

  const certificaciones = extraerCertificaciones(
    linesOfKind(secciones, 'certificaciones'),
    todas,
    conEncabezados
  );

  const referencias = extraerReferencias(
    linesOfKind(secciones, 'referencias'),
    todas,
    conEncabezados && secciones.some((s) => s.kinds.includes('referencias'))
  );

  const resumen = extraerResumen(
    linesOfKind(secciones, 'perfil'),
    encabezado,
    personales.headline
  );

  const habilidades = extractSkillsFromText(documento.text).map((s) => ({
    category: s.category,
    skillName: s.skillName,
    level: 'Intermedio',
  }));

  return {
    firstNames: personales.firstNames,
    lastNames: personales.lastNames,
    documentType: personales.documentType,
    documentNumber: personales.documentNumber,
    birthDate: personales.birthDate,
    birthPlace: personales.birthPlace,
    nationality: personales.nationality,
    cityResidence: personales.cityResidence,
    address: personales.address,
    maritalStatus: personales.maritalStatus,
    gender: personales.gender,
    phone: personales.phone,
    email: personales.email,
    headline: personales.headline,
    summary: resumen,
    salaryExpectation: personales.salaryExpectation,
    availability: personales.availability,
    driverLicense: personales.driverLicense,
    militaryCard: personales.militaryCard,
    professionalCard: personales.professionalCard,
    socialLinks: personales.socialLinks,
    status: 'nuevo',
    education: educacion,
    experience: experiencia,
    skills: habilidades,
    languages: idiomas.length > 0 ? idiomas : undefined,
    certifications: certificaciones.length > 0 ? certificaciones : undefined,
    references: referencias,
  };
}

/**
 * Renglones donde viven nombre, titular y contacto.
 *
 * Se combinan tres fuentes, siempre en orden de lectura: la seccion previa al
 * primer encabezado, la seccion de contacto cuando el CV la declara aparte, y la
 * franja superior de la primera pagina. Esa ultima es indispensable en los CV de
 * dos columnas: alli el nombre vive arriba de la columna derecha y, en orden de
 * lectura, aparece despues de toda la barra lateral, de modo que caeria dentro de
 * la ultima seccion de esa barra en vez de en el encabezado.
 */
function lineasEncabezado(secciones: Section[], todas: LayoutLine[]): LayoutLine[] {
  const propias = new Set(
    secciones
      .filter((s) => s.kinds.includes('encabezado') || s.kinds.includes('contacto'))
      .flatMap((s) => s.lines)
  );

  const franjaSuperior = todas.filter((l) => l.page === 0 && l.topOfPage);
  for (const linea of franjaSuperior) propias.add(linea);

  const seleccion = todas.filter((l) => propias.has(l));
  if (seleccion.length >= 3) return seleccion;

  return todas.slice(0, 12);
}
