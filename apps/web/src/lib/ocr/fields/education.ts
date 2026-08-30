import { EducationItem } from '../../../types/candidate';
import { LayoutLine } from '../layout';
import { normalize, splitLabeledPairs, stripBullets, stripYears } from '../text-utils';

/** Niveles educativos con los prefijos que los anuncian en las hojas de vida. */
const NIVELES: { nivel: string; patron: RegExp }[] = [
  { nivel: 'Primaria', patron: /^(?:primaria|b[aá]sica\s+primaria|educaci[oó]n\s+primaria)$/i },
  { nivel: 'Bachiller', patron: /^(?:bachiller|bachillerato|secundaria|b[aá]sica\s+secundaria|media|high\s+school)$/i },
  { nivel: 'Tecnico', patron: /^(?:t[eé]cnic[oa]|t[eé]cnico\s+laboral|technical)$/i },
  { nivel: 'Tecnologo', patron: /^(?:tecn[oó]log[oa]|tecnolog[ií]a)$/i },
  { nivel: 'Universitario', patron: /^(?:universitari[oa]|pregrado|profesional|superior|bachelor|degree)$/i },
  { nivel: 'Posgrado', patron: /^(?:posgrado|postgrado|especializaci[oó]n|especialista|maestr[ií]a|magister|m[aá]ster|mba|doctorado|phd|graduate)$/i },
  { nivel: 'Diplomado', patron: /^(?:diplomado|diploma|certificaci[oó]n)$/i },
];

const ES_INSTITUCION =
  /\b(?:universidad|university|fundaci[oó]n\s+universitaria|polit[eé]cnico|colegio|instituci[oó]n\s+educativa|instituto|institute|sena|escuela|school|college|academia|academy|corporaci[oó]n\s+universitaria|unidades?\s+tecnol[oó]gicas?|uts|cun|uniminuto|esap)\b/i;

const PALABRAS_TITULO =
  /\b(?:ingenier[ií]a|ingeniero|licenciatura|licenciad[oa]|t[eé]cnic[oa]|tecn[oó]log[oa]|bachiller|administraci[oó]n|contadur[ií]a|contador|psicolog[ií]a|psic[oó]log[oa]|derecho|abogad[oa]|medicina|enfermer[ií]a|arquitectura|comunicaci[oó]n|econom[ií]a|dise[nñ]o|dise[nñ]ador|mercadeo|publicidad|trabajo\s+social|nutrici[oó]n|veterinaria|zootecnia|agronom[ií]a|electr[oó]nica|sistemas|industrial|mec[aá]nica|el[eé]ctrica|civil|qu[ií]mica|ambiental|gesti[oó]n|log[ií]stica|seguridad|salud|especializaci[oó]n|especialista|maestr[ií]a|m[aá]ster|mba|doctorado|bachelor|master|degree)\b/i;

const ES_TECNOLOGIA = /[<>{}]|\b(?:spring|hibernate|websphere|javascript|python|sql|docker|kubernetes|react|angular)\b/i;

function nivelDesdePrefijo(prefijo: string): string | null {
  const limpio = normalize(prefijo).replace(/[.:]/g, '').trim();
  return NIVELES.find((n) => n.patron.test(limpio))?.nivel ?? null;
}

function nivelDesdeTexto(texto: string): string {
  const normalizado = normalize(texto);
  if (/doctorado|phd|maestr|magister|master|mba|especializ|especialista|posgrado|postgrado/.test(normalizado))
    return 'Posgrado';
  if (/tecnolog/.test(normalizado)) return 'Tecnologo';
  if (/tecnic|technical/.test(normalizado)) return 'Tecnico';
  if (/bachiller|secundaria|high school/.test(normalizado)) return 'Bachiller';
  if (/primaria/.test(normalizado)) return 'Primaria';
  if (/diplomado|diploma/.test(normalizado)) return 'Diplomado';
  return 'Universitario';
}

function anio(texto: string): string | undefined {
  const match = texto.match(/\b(19|20)\d{2}\b/g);
  return match ? match[match.length - 1] : undefined;
}

/** Construye entradas desde formularios con etiquetas Nivel / Titulo / Institucion. */
function desdeEtiquetas(lineas: LayoutLine[]): EducationItem[] {
  const items: EducationItem[] = [];
  let actual: Partial<EducationItem> | null = null;

  const cerrar = () => {
    if (actual && (actual.degree || actual.institution)) {
      items.push({
        level: actual.level ?? nivelDesdeTexto(`${actual.degree ?? ''}`),
        institution: actual.institution ?? '',
        degree: actual.degree ?? actual.institution ?? '',
        endYear: actual.endYear,
      });
    }
    actual = null;
  };

  for (const linea of lineas) {
    const pares = splitLabeledPairs(linea.text);
    if (pares.length === 0) continue;

    for (const par of pares) {
      const etiqueta = normalize(par.label);

      if (/^(nivel|nivel educativo|nivel de estudios)$/.test(etiqueta)) {
        if (actual?.level) cerrar();
        actual = { ...(actual ?? {}), level: nivelDesdePrefijo(par.value) ?? nivelDesdeTexto(par.value) };
      } else if (/^(titulo|titulo obtenido|programa|carrera|grado)$/.test(etiqueta)) {
        actual = { ...(actual ?? {}), degree: stripYears(par.value) };
      } else if (/^(institucion|universidad|colegio|entidad educativa|centro educativo)$/.test(etiqueta)) {
        actual = {
          ...(actual ?? {}),
          institution: stripYears(par.value),
          endYear: anio(par.value),
        };
        cerrar();
      }
    }
  }

  cerrar();
  return items;
}

/**
 * Formato dominante en Colombia: "Nivel: Titulo - Institucion (Año)".
 * Tambien resuelve el caso de institucion en un renglon y los niveles debajo.
 */
function desdeRenglones(lineas: LayoutLine[]): EducationItem[] {
  const items: EducationItem[] = [];
  const textos = lineas.map((l) => stripBullets(l.text));

  for (let i = 0; i < textos.length; i++) {
    const texto = textos[i];
    if (texto.length < 5 || ES_TECNOLOGIA.test(texto)) continue;

    const conPrefijo = texto.match(/^([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{4,20})\s*:\s*(.+)$/);
    const nivelPrefijo = conPrefijo ? nivelDesdePrefijo(conPrefijo[1]) : null;

    if (nivelPrefijo) {
      const resto = conPrefijo![2];
      const partes = resto.split(/\s+[-–—]\s+/).map((p) => p.trim()).filter(Boolean);
      const institucionParte = partes.find((p) => ES_INSTITUCION.test(p));
      const tituloParte = partes.find((p) => p !== institucionParte) ?? partes[0] ?? resto;

      items.push({
        level: nivelPrefijo,
        institution: stripYears(institucionParte ?? buscarInstitucion(textos, i)),
        degree: stripYears(tituloParte),
        endYear: anio(resto),
      });
      continue;
    }

    const esInstitucion = ES_INSTITUCION.test(texto);
    const esTitulo = PALABRAS_TITULO.test(texto);
    if (!esInstitucion && !esTitulo) continue;

    // Si un renglon vecino anuncia el nivel ("Posgrado: ...", "Universitario: ..."),
    // esos renglones ya generan sus entradas apuntando a esta institucion: crear
    // otra aqui duplicaria el estudio en el formulario.
    if (esInstitucion && nivelEnVecinos(textos, i)) continue;

    // Evita capturar frases de experiencia o de perfil que mencionen una carrera.
    if (/\b(?:experiencia|años de|responsable|lider|encargad)/i.test(texto) && !esInstitucion) continue;

    if (esInstitucion && esTitulo) {
      const partes = texto.split(/\s+[-–—|]\s+/).map((p) => p.trim()).filter(Boolean);
      const institucionParte = partes.find((p) => ES_INSTITUCION.test(p)) ?? texto;
      const tituloParte = partes.find((p) => p !== institucionParte) ?? texto;
      items.push({
        level: nivelDesdeTexto(tituloParte),
        institution: stripYears(institucionParte),
        degree: stripYears(tituloParte),
        endYear: anio(texto),
      });
    } else if (esInstitucion) {
      const tituloVecino = vecinoTitulo(textos, i);
      items.push({
        level: nivelDesdeTexto(tituloVecino || texto),
        institution: stripYears(texto),
        degree: stripYears(tituloVecino || texto),
        endYear: anio(texto),
      });
    } else {
      items.push({
        level: nivelDesdeTexto(texto),
        institution: stripYears(buscarInstitucion(textos, i)),
        degree: stripYears(texto),
        endYear: anio(texto),
      });
    }
  }

  return deduplicar(items);
}

/** Indica si algun renglon cercano empieza con un prefijo de nivel educativo. */
function nivelEnVecinos(textos: string[], desde: number): boolean {
  for (let i = Math.max(0, desde - 2); i <= Math.min(textos.length - 1, desde + 2); i++) {
    if (i === desde) continue;
    const conPrefijo = textos[i].match(/^([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{4,20})\s*:\s*(.+)$/);
    if (conPrefijo && nivelDesdePrefijo(conPrefijo[1])) return true;
  }
  return false;
}

function buscarInstitucion(textos: string[], desde: number): string {
  for (let i = desde - 1; i >= 0 && i >= desde - 3; i--) {
    if (ES_INSTITUCION.test(textos[i])) return textos[i];
  }
  for (let i = desde + 1; i < textos.length && i <= desde + 2; i++) {
    if (ES_INSTITUCION.test(textos[i])) return textos[i];
  }
  return '';
}

function vecinoTitulo(textos: string[], desde: number): string {
  for (const i of [desde - 1, desde + 1]) {
    if (i < 0 || i >= textos.length) continue;
    if (PALABRAS_TITULO.test(textos[i]) && !ES_INSTITUCION.test(textos[i])) return textos[i];
  }
  return '';
}

function deduplicar(items: EducationItem[]): EducationItem[] {
  const vistos = new Set<string>();
  return items.filter((item) => {
    const clave = `${normalize(item.degree)}|${normalize(item.institution)}`;
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return item.degree.length > 2 || item.institution.length > 2;
  });
}

/** Extrae la formacion academica del candidato. */
export function extraerEducacion(
  lineasSeccion: LayoutLine[],
  todas: LayoutLine[],
  haySeccion: boolean
): EducationItem[] {
  const alcance = haySeccion && lineasSeccion.length > 0 ? lineasSeccion : todas;

  const porEtiquetas = desdeEtiquetas(alcance);
  if (porEtiquetas.length > 0) return porEtiquetas;

  return desdeRenglones(alcance);
}
