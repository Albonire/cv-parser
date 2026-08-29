import { DocumentLayout, LayoutLine } from './layout';
import { bestMatch, normalize, wordCount } from './text-utils';

export type SectionKind =
  | 'contacto'
  | 'perfil'
  | 'experiencia'
  | 'educacion'
  | 'habilidades'
  | 'idiomas'
  | 'certificaciones'
  | 'referencias'
  | 'encabezado'
  | 'otros';

export interface Section {
  kinds: SectionKind[];
  heading: LayoutLine | null;
  lines: LayoutLine[];
}

/**
 * Lexico de encabezados. Un mismo titulo puede cubrir varias secciones
 * ("IDIOMAS Y CERTIFICACIONES"), por eso cada seccion guarda una lista de tipos.
 */
const HEADING_LEXICON: { kind: SectionKind; terms: string[] }[] = [
  {
    kind: 'perfil',
    terms: [
      'perfil', 'perfil profesional', 'perfil laboral', 'perfil personal',
      'resumen', 'resumen ejecutivo', 'resumen profesional', 'resumen laboral',
      'objetivo', 'objetivo profesional', 'objetivo laboral', 'acerca de mi',
      'sobre mi', 'presentacion', 'summary', 'personal summary', 'profile',
      'professional profile', 'objective', 'career objective', 'job objective', 'about me',
    ],
  },
  {
    kind: 'experiencia',
    terms: [
      'experiencia', 'experiencia laboral', 'experiencia profesional',
      'experiencia de trabajo', 'trayectoria laboral', 'historial laboral',
      'antecedentes laborales', 'work experience', 'employment history',
      'experience', 'my experience', 'professional experience',
    ],
  },
  {
    kind: 'educacion',
    terms: [
      'educacion', 'educacion superior', 'formacion', 'formacion academica',
      'formacion academica y complementaria', 'estudios', 'estudios realizados',
      'nivel educativo', 'escolaridad', 'education', 'academic background', 'studies',
    ],
  },
  {
    kind: 'habilidades',
    terms: [
      'habilidades', 'competencias', 'aptitudes', 'conocimientos',
      'habilidades y competencias', 'competencias laborales', 'perfil de competencias',
      'skills', 'core skills', 'key skills', 'highlights', 'strengths',
    ],
  },
  { kind: 'idiomas', terms: ['idiomas', 'idioma', 'languages', 'language skills'] },
  {
    kind: 'certificaciones',
    terms: [
      'certificaciones', 'certificados', 'cursos', 'diplomados', 'capacitaciones',
      'talleres', 'seminarios', 'cursos y certificaciones', 'formacion complementaria',
      'certifications', 'courses', 'training',
    ],
  },
  {
    kind: 'referencias',
    terms: [
      'referencias', 'referencias personales', 'referencias familiares',
      'referencias laborales', 'references', 'personal references',
    ],
  },
  {
    kind: 'contacto',
    terms: [
      'contacto', 'datos personales', 'datos de contacto', 'informacion personal',
      'datos basicos', 'informacion de contacto', 'contact', 'personal information',
      'personal details',
    ],
  },
];

const ALL_TERMS = HEADING_LEXICON.flatMap((entry) => entry.terms);

/** Quita la numeracion de formularios oficiales ("1. DATOS PERSONALES"). */
function headingCandidateText(line: string): string {
  return line
    .replace(/^\s*\d+\s*[.)-]\s*/, '')
    .replace(/[:.]+\s*$/, '')
    .trim();
}

/**
 * Decide si un renglon es un encabezado de seccion combinando el lexico con las
 * señales de formato (negrita, mayusculas, tamaño de fuente, renglon corto).
 * Una expresion regular sola falla en cuanto el CV usa un sinonimo o el OCR
 * introduce ruido.
 */
export function detectHeadingKinds(line: LayoutLine, medianFontSize: number): SectionKind[] {
  const candidate = headingCandidateText(line.text);
  if (candidate.length < 4 || wordCount(candidate) > 6) return [];

  // Un renglon con datos no es un encabezado, aunque empiece con la palabra correcta.
  if (/[@]|https?:|\d{5,}/.test(candidate)) return [];

  const looksLikeHeading =
    line.isUpper || line.isBold || line.fontSize > medianFontSize * 1.08 || /^\d+\s*[.)-]/.test(line.text);

  const normalized = normalize(candidate);
  const kinds: SectionKind[] = [];

  // Titulos compuestos: "IDIOMAS Y CERTIFICACIONES", "CERTIFICACIONES Y CURSOS"
  const parts = normalized.split(/\s+y\s+|\s*&\s*|\s*\/\s*/).filter((p) => p.length >= 4);
  const pieces = parts.length > 1 ? parts : [normalized];

  for (const piece of pieces) {
    const match = bestMatch(piece, ALL_TERMS, 0.85);
    if (!match) continue;
    const entry = HEADING_LEXICON.find((e) => e.terms.includes(match.term));
    if (entry && !kinds.includes(entry.kind)) kinds.push(entry.kind);
  }

  if (kinds.length === 0) return [];
  // Con lexico exacto basta; si solo hay parecido, exigimos señal de formato.
  const exact = pieces.some((p) => ALL_TERMS.includes(p));
  return exact || looksLikeHeading ? kinds : [];
}

/**
 * Parte el documento en secciones. Las lineas anteriores al primer encabezado
 * quedan en la seccion `encabezado`, donde viven nombre, titular y contacto.
 */
export function detectSections(layout: DocumentLayout): Section[] {
  const sections: Section[] = [];
  let current: Section = { kinds: ['encabezado'], heading: null, lines: [] };

  for (const line of layout.lines) {
    const kinds = detectHeadingKinds(line, layout.medianFontSize);

    if (kinds.length > 0) {
      if (current.lines.length > 0 || current.heading) sections.push(current);
      current = { kinds, heading: line, lines: [] };
    } else {
      current.lines.push(line);
    }
  }

  if (current.lines.length > 0 || current.heading) sections.push(current);

  return sections;
}

/** Devuelve las lineas de todas las secciones de un tipo dado. */
export function linesOfKind(sections: Section[], kind: SectionKind): LayoutLine[] {
  return sections.filter((s) => s.kinds.includes(kind)).flatMap((s) => s.lines);
}

/** Indica si el documento trae encabezados de seccion reconocibles. */
export function hasExplicitHeadings(sections: Section[]): boolean {
  return sections.some((s) => s.heading !== null && !s.kinds.includes('encabezado'));
}
