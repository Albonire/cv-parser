import { CertificationItem, LanguageItem, ReferenceItem } from '../../../types/candidate';
import { LayoutLine } from '../layout';
import { normalize, stripBullets, stripYears } from '../text-utils';
import { buscarTelefono } from './phone';

const IDIOMAS: { canonico: string; patron: RegExp }[] = [
  { canonico: 'Español', patron: /\b(?:espa[nñ]ol|castellano|spanish)\b/i },
  { canonico: 'Inglés', patron: /\b(?:ingl[eé]s|english)\b/i },
  { canonico: 'Francés', patron: /\b(?:franc[eé]s|french)\b/i },
  { canonico: 'Alemán', patron: /\b(?:alem[aá]n|german)\b/i },
  { canonico: 'Portugués', patron: /\b(?:portugu[eé]s|portuguese)\b/i },
  { canonico: 'Italiano', patron: /\b(?:italiano|italian)\b/i },
  { canonico: 'Mandarín', patron: /\b(?:mandar[ií]n|chino|chinese)\b/i },
  { canonico: 'Ruso', patron: /\b(?:ruso|russian)\b/i },
  { canonico: 'Japonés', patron: /\b(?:japon[eé]s|japanese)\b/i },
];

const NIVEL_IDIOMA =
  /\b(nativo|native|biling[uü]e|bilingual|avanzado|advanced|intermedio|intermediate|b[aá]sico|basic|principiante|C2|C1|B2|B1|A2|A1)\b/i;

/**
 * Extrae idiomas y su nivel. Soporta "Ingles: C1 Avanzado", "Ingles (Avanzado B2)"
 * y listas separadas por barras o comas dentro de un mismo renglon.
 */
export function extraerIdiomas(lineasSeccion: LayoutLine[], todas: LayoutLine[]): LanguageItem[] {
  const alcance = lineasSeccion.length > 0 ? lineasSeccion : todas;
  const items: LanguageItem[] = [];

  for (const linea of alcance) {
    // Cada idioma suele venir en su propio fragmento
    for (const fragmento of linea.text.split(/[|,;]/)) {
      for (const idioma of IDIOMAS) {
        if (!idioma.patron.test(fragmento)) continue;
        if (items.some((i) => i.language === idioma.canonico)) continue;

        const despues = fragmento.slice(fragmento.search(idioma.patron));
        const nivel = despues.match(NIVEL_IDIOMA);

        items.push({
          language: idioma.canonico,
          level: nivel ? capitalizar(nivel[1]) : 'Intermedio',
        });
      }
    }
  }

  return items;
}

function capitalizar(valor: string): string {
  if (/^[A-C][12]$/i.test(valor)) return valor.toUpperCase();
  return valor.charAt(0).toUpperCase() + valor.slice(1).toLowerCase();
}

const PALABRAS_CERTIFICACION =
  /\b(?:diplomado|certificaci[oó]n|certificad[oa]|curso|seminario|taller|capacitaci[oó]n|scrum\s+master|aws\s+certified|itil|pmp|six\s+sigma)\b/i;

/** Extrae certificaciones y cursos con su institucion y año cuando estan presentes. */
export function extraerCertificaciones(
  lineasSeccion: LayoutLine[],
  todas: LayoutLine[],
  haySeccion: boolean
): CertificationItem[] {
  const alcance = haySeccion && lineasSeccion.length > 0 ? lineasSeccion : todas;
  const items: CertificationItem[] = [];
  const vistos = new Set<string>();

  for (const linea of alcance) {
    const texto = stripBullets(linea.text);
    if (texto.length < 6) continue;

    const esCertificacion = haySeccion && lineasSeccion.length > 0 ? true : PALABRAS_CERTIFICACION.test(texto);
    if (!esCertificacion) continue;
    // En una seccion combinada ("IDIOMAS Y CERTIFICACIONES") descarta la linea de idiomas.
    if (/^idiomas?\s*:/i.test(texto)) continue;

    const anio = texto.match(/\b(19|20)\d{2}\b/);
    let nombre = texto;
    let institucion: string | undefined;

    const conParentesis = texto.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    const conGuion = texto.split(/\s+[-–—]\s+/);

    if (conParentesis) {
      nombre = conParentesis[1].trim();
      institucion = stripYears(conParentesis[2].replace(/^,\s*/, '')) || undefined;
    } else if (conGuion.length >= 2) {
      nombre = conGuion[0].trim();
      institucion = stripYears(conGuion.slice(1).join(' - ')) || undefined;
    }

    nombre = stripYears(nombre).replace(/\s*[(,]\s*$/, '').trim();
    if (nombre.length < 4) continue;

    const clave = normalize(nombre);
    if (vistos.has(clave)) continue;
    vistos.add(clave);

    items.push({ name: nombre, institution: institucion, year: anio ? anio[0] : undefined });
  }

  return items;
}

const MARCA_REFERENCIA = /\breferencias?\b/i;

/**
 * Extrae referencias personales, familiares y laborales con su telefono.
 *
 * Cuando el CV no trae encabezados de seccion se recogen los renglones que se
 * anuncian como referencia, para no confundir el telefono de un tercero con el
 * del candidato.
 */
export function extraerReferencias(
  lineasSeccion: LayoutLine[],
  todas: LayoutLine[],
  haySeccion: boolean
): ReferenceItem[] {
  const alcance =
    haySeccion && lineasSeccion.length > 0
      ? lineasSeccion
      : todas.filter((l) => MARCA_REFERENCIA.test(l.text));

  if (alcance.length === 0) return [];

  const items: ReferenceItem[] = [];

  for (const linea of alcance) {
    const texto = stripBullets(linea.text);
    const telefono = buscarTelefono(texto);
    if (!telefono) continue;

    let tipo: ReferenceItem['referenceType'] = 'personal';
    if (/familiar|madre|padre|hermano|hermana|esposo|esposa|t[ií]o|t[ií]a|prim[oa]/i.test(texto)) tipo = 'familiar';
    else if (/laboral|jefe|supervisor|gerente|coordinador|empresa|ex\s*jefe/i.test(texto)) tipo = 'laboral';

    // El nombre es lo que va antes del parentesis de tipo o del telefono.
    let nombre = texto
      .split(/\s*[-–—]\s*(?:tel|cel|celular|tel[eé]fono|contacto)/i)[0]
      .replace(/\((?:laboral|personal|familiar)\)/i, '')
      .replace(telefono, '')
      .replace(/^(?:referencia\s*(?:laboral|personal|familiar)?\s*:?\s*)/i, '')
      // Se eliminan los parentesis que quedaron con la etiqueta del medio de
      // contacto, aunque el telefono ya se haya quitado ("Luis Sotto (Telefono:
      // )") o acompanen a otros datos ("Eucaris Guete (Telefono: ... / E-mail:
      // eucaris@...)").
      .replace(/\([^)]*(?:tel[eé]fono|tel|celular|cel|e-?mail|correo|email|contacto)[^)]*\)\s*$/i, '')
      .replace(/[-–—:,\s]+$/, '')
      .trim();

    if (nombre.length < 3 || nombre.length > 60) nombre = 'Referencia';

    items.push({ referenceType: tipo, name: nombre, phone: telefono });
  }

  return items;
}

const PALABRAS_PERFIL =
  /\b(?:experiencia|profesional|a[nñ]os|trayectoria|especialista|especializad[oa]|liderando|enfocad[oa]|conocimientos|habilidades|capacidad|gesti[oó]n|desarrollo|sector|responsable|orientad[oa]|apasionad[oa]|graduad[oa]|egresad[oa]|t[eé]cnic[oa]|tecn[oó]log[oa]|ingenier[oa]|administrador[a]?|contador[a]?|psic[oó]log[oa]|dise[nñ]ador[a]?|experienced|professional|years|skilled|knowledgeable|proactiv[oa])\b/i;

/**
 * Extrae el resumen o perfil profesional. Si el CV no trae encabezado, toma el
 * primer parrafo descriptivo del cuerpo (casos 06, 07 y 08 del banco de pruebas).
 */
export function extraerResumen(
  lineasSeccion: LayoutLine[],
  encabezado: LayoutLine[],
  titular: string
): string {
  if (lineasSeccion.length > 0) {
    const parrafo = lineasSeccion
      .map((l) => stripBullets(l.text))
      .filter((t) => t.length > 0)
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (parrafo.length >= 20) return parrafo.slice(0, 900);
  }

  const candidatas: string[] = [];
  for (const linea of encabezado) {
    const texto = stripBullets(linea.text);
    if (texto.length < 45 || texto.length > 600) continue;
    if (texto.includes('@') || /https?:|www\./.test(texto)) continue;
    if (normalize(texto) === normalize(titular)) continue;
    if (!PALABRAS_PERFIL.test(texto)) continue;
    candidatas.push(texto);
  }

  if (candidatas.length === 0) return '';

  // Une los renglones contiguos del mismo parrafo.
  return candidatas.join(' ').replace(/\s{2,}/g, ' ').trim().slice(0, 900);
}
