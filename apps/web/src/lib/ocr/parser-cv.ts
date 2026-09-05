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

  const lineasReferencias = linesOfKind(secciones, 'referencias');
  const encabezado = lineasEncabezado(secciones, documento.lines);
  const todas = documento.lines;

  const personales = extraerDatosPersonales(encabezado, todas, lineasReferencias);

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
    lineasReferencias,
    todas,
    conEncabezados && secciones.some((s) => s.kinds.includes('referencias'))
  );

  // Prevenir que nombres de referencias personales se asignen como nombre del candidato
  // cuando la página carece de sección de datos personales.
  const nombreCompleto = `${personales.firstNames} ${personales.lastNames}`.trim().toLowerCase();
  const haySeccionPersonal = secciones.some(
    (s) =>
      s.kinds.includes('contacto') ||
      (s.kinds.includes('encabezado') && s.heading === null && s.lines.length > 0)
  );
  const coincideConReferencia =
    nombreCompleto.length >= 3 &&
    referencias.some((r) => {
      if (!r.name || r.name === 'Referencia') return false;
      const refNorm = r.name.trim().toLowerCase();
      if (refNorm === nombreCompleto) return true;
      if (!haySeccionPersonal) {
        const palabrasNombre = nombreCompleto.split(/\s+/).filter(Boolean);
        const palabrasRef = refNorm.split(/\s+/).filter(Boolean);
        return (
          palabrasNombre.length >= 2 &&
          palabrasNombre.every((w) => palabrasRef.includes(w))
        );
      }
      return false;
    });
  if (coincideConReferencia || (!haySeccionPersonal && lineasReferencias.length > 0 && !personales.email && !personales.phone)) {
    personales.firstNames = '';
    personales.lastNames = '';
  }

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
  const lineasReferencias = new Set(linesOfKind(secciones, 'referencias'));

  const propias = new Set(
    secciones
      .filter((s) => s.kinds.includes('encabezado') || s.kinds.includes('contacto'))
      .flatMap((s) => s.lines)
      .filter((l) => !lineasReferencias.has(l))
  );

  const franjaSuperior = todas.filter((l) => l.page === 0 && l.topOfPage && !lineasReferencias.has(l));
  for (const linea of franjaSuperior) propias.add(linea);

  const seleccion = todas.filter((l) => propias.has(l));
  if (seleccion.length >= 3) return seleccion;

  // Si no hay seccion de encabezado ni de contacto, descartar lineas de referencias
  const fallback = todas.slice(0, 12).filter((l) => !lineasReferencias.has(l));
  if (fallback.length === 0) return [];
  return fallback;
}
