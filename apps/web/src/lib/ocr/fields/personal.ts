import { LayoutLine } from '../layout';
import { DocumentType } from '../../../types/candidate';
import { findKnownPlace } from '../../contexto/lugares';
import { contieneCargo } from '../../contexto/diccionario';
import { findLabeledValue, normalize, splitLabeledPairs, stripBullets, wordCount } from '../text-utils';
import { FECHA_SUELTA } from './dates';
import { buscarTelefono } from './phone';

const ETIQUETAS = {
  nombres: ['nombres', 'nombre', 'nombre completo', 'first name', 'name', 'given names'],
  apellidos: ['apellidos', 'apellido', 'last name', 'surname', 'family name'],
  documento: [
    'cedula', 'cedula de ciudadania', 'cc', 'c c', 'documento', 'documento de identidad',
    'numero de documento', 'identificacion', 'no de identificacion', 'nit', 'id',
    'cedula de extranjeria', 'ce', 'tarjeta de identidad', 'ti', 'pasaporte',
  ],
  telefono: [
    'telefono', 'telefono fijo', 'telefono celular', 'celular', 'cel', 'movil',
    'whatsapp', 'contacto', 'tel', 'phone', 'mobile', 'cell', 'numero de contacto',
  ],
  correo: ['email', 'e mail', 'correo', 'correo electronico', 'mail'],
  ciudad: [
    'ciudad', 'ciudad de residencia', 'municipio', 'lugar de residencia',
    'ubicacion', 'city', 'location',
  ],
  direccion: ['direccion', 'direccion de residencia', 'domicilio', 'address'],
  nacionalidad: ['nacionalidad', 'nationality', 'citizenship'],
  lugarNacimiento: ['lugar de nacimiento', 'ciudad de nacimiento', 'natural de', 'born in'],
  fechaNacimiento: ['fecha de nacimiento', 'nacimiento', 'nacido el', 'nacida el', 'date of birth', 'dob'],
  estadoCivil: ['estado civil', 'marital status'],
  genero: ['sexo', 'genero', 'gender', 'sex'],
  salario: [
    'aspiracion salarial', 'expectativa salarial', 'pretension salarial',
    'aspiracion', 'expectativa', 'salario esperado', 'sueldo esperado', 'salary expectation',
  ],
  disponibilidad: ['disponibilidad', 'disponibilidad para iniciar', 'incorporacion', 'availability'],
  licencia: ['licencia de conduccion', 'licencia de transito', 'licencia', 'pase', 'categoria'],
  libreta: ['libreta militar', 'situacion militar'],
  tarjetaProfesional: ['tarjeta profesional', 'tarjeta profesional no', 't p', 'matricula profesional'],
} as const;

const TIPOS_DOCUMENTO: { tipo: DocumentType; patron: RegExp }[] = [
  { tipo: 'CE', patron: /c[eé]dula\s+de\s+extranjer[ií]a|\bc\.?\s?e\.?\b/i },
  { tipo: 'TI', patron: /tarjeta\s+de\s+identidad|\bt\.?\s?i\.?\b/i },
  { tipo: 'PAS', patron: /pasaporte|passport/i },
  { tipo: 'PPT', patron: /permiso\s+por\s+protecci[oó]n\s+temporal|\bppt\b/i },
  { tipo: 'PEP', patron: /permiso\s+especial\s+de\s+permanencia|\bpep\b/i },
  { tipo: 'CC', patron: /c[eé]dula(\s+de\s+ciudadan[ií]a)?|\bc\.?\s?c\.?\b/i },
];

/** Palabras que nunca forman parte de un nombre propio. */
const NO_ES_NOMBRE =
  /(?:curriculum|curriculo|hoja\s+de\s+vida|resume\b|^cv$|datos\s+personales|informaci[oó]n\s+personal|personal\s+information|contacto|contact|perfil|profile|summary|resumen|experiencia|experience|educaci[oó]n|education|habilidades|skills|idiomas|languages|certificaciones|referencias|references|objetivo|objective|formato\s+[uú]nico|persona\s+natural|funci[oó]n\s+p[uú]blica|universidad|university|colegio|instituto|sena|empresa|trabajo\s+en\s+equipo|liderazgo|comunicaci[oó]n|puntualidad|responsabilidad|proactividad|adaptabilidad|honestidad)/i;

/**
 * Cargos y titulos en español e ingles. Un encabezado como "SENIOR JAVA
 * DEVELOPER" no puede tomarse por el nombre del candidato.
 */
const ES_CARGO_GENERICO =
  /\b(?:senior|junior|semi-?senior|lead|head|trainee|intern|director|directora|gerente|jefe|jefa|coordinador|coordinadora|analista|desarrollador|developer|engineer|ingenier[oa]|arquitect[oa]|architect|consultor|consultant|t[eé]cnic[oa]|technician|tecn[oó]log[oa]|operari[oa]|asistente|assistant|auxiliar|especialista|specialist|manager|analyst|abogad[oa]|contador[a]?|administrador[a]?|dise[nñ]ador[a]?|designer|profesional|estudiante|bachiller|professional|officer|supervisor|supervisora|teller|banker|mechanic|maintenance)\b/i;

/**
 * Palabras funcionales que delatan una frase, no un nombre propio. Se conservan
 * las particulas usadas en apellidos hispanos (de, del, la, los, las, y).
 */
const PALABRA_FUNCIONAL =
  /\b(?:i|am|is|are|was|were|with|and|the|of|for|in|on|at|to|from|my|your|his|her|our|their|con|para|por|sobre|entre|desde|hasta|que|como|muy|mas|pero|soy|es|son|era|tengo|tiene)\b/i;

const PREFIJOS_TRATAMIENTO =
  /^(?:ing\.?|ingeniero|ingeniera|dr\.?|dra\.?|doctor|doctora|lic\.?|licenciado|licenciada|abg\.?|abogado|abogada|psic\.?|tec\.?|tecn[oó]logo|sr\.?|sra\.?|srta\.?|mr\.?|ms\.?|mrs\.?)\s+/i;

export interface DatosPersonales {
  firstNames: string;
  lastNames: string;
  documentType: DocumentType;
  documentNumber: string;
  email: string;
  phone: string;
  cityResidence: string;
  address?: string;
  nationality: string;
  birthPlace?: string;
  birthDate?: string;
  maritalStatus?: string;
  gender?: string;
  headline: string;
  salaryExpectation?: number;
  availability?: string;
  driverLicense?: string;
  militaryCard?: string;
  professionalCard?: string;
  socialLinks?: string[];
}

function textos(lines: LayoutLine[]): string[] {
  return lines.map((l) => l.text);
}

/** Un renglon que solo tiene letras y de 2 a 5 palabras puede ser un nombre. */
function pareceNombre(texto: string): boolean {
  const limpio = stripBullets(texto).replace(PREFIJOS_TRATAMIENTO, '').trim();
  if (limpio.length < 5 || limpio.length > 60) return false;
  if (NO_ES_NOMBRE.test(limpio)) return false;
  if (contieneCargo(limpio) || ES_CARGO_GENERICO.test(limpio)) return false;
  if (PALABRA_FUNCIONAL.test(limpio)) return false;
  if (/[@\d]|https?:|www\./.test(limpio)) return false;
  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'´\s.]+$/.test(limpio)) return false;

  const palabras = wordCount(limpio);
  return palabras >= 2 && palabras <= 5;
}

/** Reparte el nombre completo segun la convencion colombiana de dos apellidos. */
export function repartirNombre(completo: string): { firstNames: string; lastNames: string } {
  const partes = stripBullets(completo)
    .replace(PREFIJOS_TRATAMIENTO, '')
    .split(/\s+/)
    .filter(Boolean);

  if (partes.length === 0) return { firstNames: '', lastNames: '' };
  if (partes.length === 1) return { firstNames: partes[0], lastNames: '' };
  if (partes.length === 2) return { firstNames: partes[0], lastNames: partes[1] };
  if (partes.length === 3) return { firstNames: partes[0], lastNames: partes.slice(1).join(' ') };

  return { firstNames: partes.slice(0, 2).join(' '), lastNames: partes.slice(2).join(' ') };
}

function extraerNombre(
  encabezado: LayoutLine[],
  todas: LayoutLine[]
): { firstNames: string; lastNames: string; lineaNombre: LayoutLine | null } {
  const todosTextos = textos(todas);

  // 1. Etiquetas explicitas (formularios DAFP, Minerva, formatos publicos)
  const nombres = findLabeledValue(todosTextos, [...ETIQUETAS.nombres]);
  const apellidos = findLabeledValue(todosTextos, [...ETIQUETAS.apellidos]);

  if (nombres && apellidos) {
    return { firstNames: nombres.trim(), lastNames: apellidos.trim(), lineaNombre: null };
  }
  if (nombres && !apellidos && wordCount(nombres) >= 2) {
    return { ...repartirNombre(nombres), lineaNombre: null };
  }

  // 2. El renglon de mayor tamaño de fuente en el encabezado que parezca un nombre.
  // Los renglones de lista ("+ Customer service") nunca son el nombre del candidato.
  const candidatos = encabezado.filter(
    (l) => !/^\s*[•*+·●▪‣>-]/.test(l.text) && pareceNombre(l.text)
  );
  if (candidatos.length > 0) {
    const mayor = [...candidatos].sort(
      (a, b) => b.fontSize - a.fontSize || a.y - b.y || a.page - b.page
    )[0];
    return { ...repartirNombre(mayor.text), lineaNombre: mayor };
  }

  // 3. Un fragmento de nombre camuflado entre datos de contacto.
  for (const linea of encabezado.slice(0, 12)) {
    if (/^\s*[•*+·●▪‣>-]/.test(linea.text)) continue;
    for (const fragmento of linea.text.split(/[|•*+·]/)) {
      if (pareceNombre(fragmento)) {
        return { ...repartirNombre(fragmento), lineaNombre: linea };
      }
    }
  }

  return { firstNames: '', lastNames: '', lineaNombre: null };
}

function extraerCorreo(encabezado: LayoutLine[], todas: LayoutLine[]): string {
  const patron = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+[a-zA-Z]/;
  const enEncabezado = textos(encabezado).join('\n').match(patron);
  if (enEncabezado) return enEncabezado[0].toLowerCase();

  const enDocumento = textos(todas).join('\n').match(patron);
  return enDocumento ? enDocumento[0].toLowerCase() : '';
}

/**
 * Prefiere el telefono del encabezado o de la seccion de contacto. Buscarlo en
 * todo el documento hacia que el parser tomara el celular de una referencia
 * personal como si fuera el del candidato.
 */
function extraerTelefono(encabezado: LayoutLine[], todas: LayoutLine[], documento: string): string {
  const porEtiqueta = findLabeledValue(textos(encabezado), [...ETIQUETAS.telefono]);
  if (porEtiqueta) {
    const encontrado = buscarTelefono(porEtiqueta, documento);
    if (encontrado) return encontrado;
  }

  for (const linea of encabezado) {
    for (const fragmento of linea.text.split(/[|•·]/)) {
      const encontrado = buscarTelefono(fragmento, documento);
      if (encontrado) return encontrado;
    }
  }

  const porEtiquetaGlobal = findLabeledValue(textos(todas), [...ETIQUETAS.telefono]);
  if (porEtiquetaGlobal) {
    const encontrado = buscarTelefono(porEtiquetaGlobal, documento);
    if (encontrado) return encontrado;
  }

  return '';
}

function extraerDocumento(todas: LayoutLine[]): { documentType: DocumentType; documentNumber: string } {
  const lineas = textos(todas);

  for (const linea of lineas) {
    for (const par of splitLabeledPairs(linea)) {
      const etiqueta = normalize(par.label);
      if (!ETIQUETAS.documento.some((e) => etiqueta === e || etiqueta.includes(e))) continue;

      const numero = par.value.match(/\b[\d][\d.,]{5,14}\b/);
      if (!numero) continue;

      const tipo = TIPOS_DOCUMENTO.find((t) => t.patron.test(par.label))?.tipo ?? 'CC';
      return { documentType: tipo, documentNumber: numero[0].replace(/[.,]/g, '') };
    }
  }

  // Sin etiqueta con dos puntos: "CC 1095678123", "C.C. 1.098.765.432 de Bucaramanga"
  const patronSuelto =
    /\b(c[eé]dula(?:\s+de\s+(?:ciudadan[ií]a|extranjer[ií]a))?|c\.?\s?c\.?|c\.?\s?e\.?|t\.?\s?i\.?|tarjeta\s+de\s+identidad|pasaporte|ppt|pep)\b\s*(?:n[oº°]\.?|nro\.?|num\.?)?\s*[:#.]?\s*([\d][\d.,]{5,14})\b/i;
  const suelto = lineas.join('\n').match(patronSuelto);
  if (suelto) {
    const tipo = TIPOS_DOCUMENTO.find((t) => t.patron.test(suelto[1]))?.tipo ?? 'CC';
    return { documentType: tipo, documentNumber: suelto[2].replace(/[.,]/g, '') };
  }

  return { documentType: 'CC', documentNumber: '' };
}

/** Quita correos, URLs y etiquetas de contacto para dejar solo la parte de direccion. */
function limpiarLineaDireccion(texto: string): string {
  return texto
    .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, ' | ')
    .replace(/(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.[a-z]{2,}\/\S*/gi, ' | ')
    .replace(/\b(?:phone|tel|tel[eé]fono|cel|celular|mobile|m[oó]vil|whatsapp|fax)\b\s*[:.]?\s*/gi, ' | ')
    .replace(/(?:^|\s)[CP]:\s*/g, ' | ');
}

/** "Los Angeles, CA 90001" y "New Cityland. CA 91010": ciudad + sigla de estado. */
const CIUDAD_SIGLA = /([A-Z][A-Za-z.]+(?:\s+[A-Z][A-Za-z.]+)*)[,.]\s*([A-Z]{2})\b(\s+\d{4,6})?/;
/** "Honolulu, Hawaii" y "Ambattur, Chennai": ciudad + estado con nombre completo. */
const CIUDAD_ESTADO = /([A-Z][A-Za-z.]+(?:\s+[A-Z][A-Za-z.]+)*)[,.]\s*([A-Z][a-z]+)\b(\s+\d{4,6})?/;

/** Longitud maxima razonable de "Ciudad, Departamento CP". */
const MAX_LONGITUD_CIUDAD = 45;

/**
 * Un renglon largo de prosa puede contener por casualidad "Palabra. Otra" y
 * hacerse pasar por "Ciudad, Estado". Se exige que el candidato sea corto y que
 * no traiga palabras funcionales.
 */
function esCiudadPlausible(valor: string): boolean {
  if (valor.length > MAX_LONGITUD_CIUDAD) return false;
  if (wordCount(valor) > 6) return false;
  return !PALABRA_FUNCIONAL.test(valor);
}

function extraerCiudad(encabezado: LayoutLine[], todas: LayoutLine[]): string {
  const porEtiqueta =
    findLabeledValue(textos(encabezado), [...ETIQUETAS.ciudad]) ??
    findLabeledValue(textos(todas), [...ETIQUETAS.ciudad]);

  if (porEtiqueta && porEtiqueta.length > 2) return porEtiqueta.replace(/\s*[|].*$/, '').trim();

  const fragmentos: string[] = [];
  for (const linea of encabezado) {
    for (const fragmento of limpiarLineaDireccion(linea.text).split(/[|•·]/)) {
      const limpio = stripBullets(fragmento).trim();
      if (limpio.length > 2) fragmentos.push(limpio);
    }
  }

  // 1. Gazetteer de Colombia: cubre cualquier municipio o departamento del pais.
  // Varios nombres son ademas palabras corrientes ("Meta", "Sucre", "Granada"),
  // asi que el fragmento debe parecer una linea de direccion y no un parrafo.
  for (const fragmento of fragmentos) {
    const limpio = fragmento.replace(/^(?:ciudad|residencia)\s*:?\s*/i, '').trim();
    if (esCiudadPlausible(limpio) && findKnownPlace(limpio)) return limpio;
  }

  // 2. Formatos internacionales. Se respeta el orden del documento y dentro de
  // cada fragmento se prefiere la sigla de estado sobre el nombre completo, para
  // no quedarse con la ciudad de un empleo anterior en vez de la de residencia.
  for (const fragmento of fragmentos) {
    // Un parrafo de texto corrido no es una linea de direccion.
    if (wordCount(fragmento) > 14) continue;

    for (const patron of [CIUDAD_SIGLA, CIUDAD_ESTADO]) {
      const match = fragmento.match(patron);
      if (match && esCiudadPlausible(match[0].trim())) return match[0].trim();
    }
  }

  return '';
}

/** Etiquetas de contacto que el OCR deja sueltas y no son un titular. */
const ETIQUETA_SUELTA =
  /^(?:phone|tel|tel[eé]fono|celular|cel|mobile|m[oó]vil|email|e-?mail|correo|address|direcci[oó]n|contact|contacto|linkedin|github|fecha|edad|skills|habilidades)\b[\s:.-]*$/i;

/** Descarta direcciones, ciudades y datos de contacto como posibles titulares. */
function pareceTitular(candidato: string, ciudad: string): boolean {
  if (candidato.length < 4 || candidato.length > 80) return false;
  if (/[@]|https?:|www\./.test(candidato)) return false;
  if (/^\d/.test(candidato)) return false;
  if (ETIQUETA_SUELTA.test(candidato)) return false;
  if (/\b(?:calle|carrera|avenida|diagonal|transversal|manzana|barrio|street|avenue|road|drive)\b/i.test(candidato))
    return false;
  if (/\d{3}[\s.-]?\d{3}/.test(candidato)) return false;
  if (ciudad && normalize(candidato) === normalize(ciudad)) return false;
  if (findKnownPlace(candidato) && !contieneCargo(candidato)) return false;
  // "Philadelphia, PA" o "Boston, MA": es una ubicacion, no un cargo.
  if (!contieneCargo(candidato) && (CIUDAD_SIGLA.test(candidato) || CIUDAD_ESTADO.test(candidato)))
    return false;
  return true;
}

/**
 * Conectores ingleses que delatan una frase de responsabilidades y no un cargo.
 * No incluye conectores españoles ("de", "y", "en"), habituales en cargos reales
 * como "Ingeniero de Automatizacion y Sistemas Embebidos".
 */
const PROSA_INGLESA =
  /\b(?:in|on|at|as|by|for|with|to|from|the|and|or|of|that|which|will|would|should|be|been|is|are|was|were|have|has|had|additional|requested|interested|responsible)\b/i;

/**
 * Filtro adicional para las rutas heuristicas (renglon siguiente al nombre y
 * barrido del encabezado). La ruta con etiqueta explicita no lo aplica: alli el
 * documento ya declaro que ese texto es el objetivo del candidato.
 */
function pareceTitularHeuristico(candidato: string, ciudad: string): boolean {
  if (!pareceTitular(candidato, ciudad)) return false;
  if (wordCount(candidato) > 8) return false;
  return !PROSA_INGLESA.test(candidato);
}

function extraerTitular(
  encabezado: LayoutLine[],
  lineaNombre: LayoutLine | null,
  nombreCompleto: string,
  ciudad: string
): string {
  // 1. Etiqueta explicita de objetivo o cargo aspirado.
  const porEtiqueta = findLabeledValue(textos(encabezado), [
    'titular', 'cargo al que aspira', 'cargo', 'objetivo', 'objetivo profesional',
    'job objective', 'headline', 'target role',
  ]);
  if (porEtiqueta && porEtiqueta.length > 3 && pareceTitular(porEtiqueta, ciudad)) {
    return porEtiqueta.replace(/[.;]\s*$/, '').trim();
  }

  // 2. El titular suele ir inmediatamente debajo del nombre.
  const indice = lineaNombre ? encabezado.indexOf(lineaNombre) : -1;
  if (indice >= 0) {
    for (let i = indice + 1; i < Math.min(indice + 4, encabezado.length); i++) {
      const candidato = stripBullets(encabezado[i].text).trim();
      if (!pareceTitularHeuristico(candidato, ciudad)) continue;
      if (NO_ES_NOMBRE.test(candidato) && !contieneCargo(candidato)) continue;
      if (normalize(candidato) === normalize(nombreCompleto)) continue;
      return candidato;
    }
  }

  // 3. Cualquier renglon del encabezado que sea un cargo conocido.
  for (const linea of encabezado) {
    const candidato = stripBullets(linea.text).trim();
    if (!pareceTitularHeuristico(candidato, ciudad)) continue;
    if (contieneCargo(candidato) || ES_CARGO_GENERICO.test(candidato)) return candidato;
  }

  return '';
}

/** Extrae todos los datos personales del encabezado y de las etiquetas del documento. */
export function extraerDatosPersonales(
  encabezado: LayoutLine[],
  todas: LayoutLine[]
): DatosPersonales {
  const lineas = textos(todas);
  const textoCompleto = lineas.join('\n');

  const { firstNames, lastNames, lineaNombre } = extraerNombre(encabezado, todas);
  const { documentType, documentNumber } = extraerDocumento(todas);

  const socialLinks: string[] = [];
  const linkedin = textoCompleto.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
  if (linkedin) socialLinks.push(linkedin[0].startsWith('http') ? linkedin[0] : `https://${linkedin[0]}`);
  const github = textoCompleto.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_-]+/i);
  if (github) socialLinks.push(github[0].startsWith('http') ? github[0] : `https://${github[0]}`);

  const salarioTexto = findLabeledValue(lineas, [...ETIQUETAS.salario]);
  let salaryExpectation: number | undefined;
  if (salarioTexto) {
    const numero = salarioTexto.match(/[\d][\d.,]{4,14}/);
    if (numero) {
      const valor = parseInt(numero[0].replace(/[.,]/g, ''), 10);
      if (!Number.isNaN(valor) && valor > 10000) salaryExpectation = valor;
    }
  }

  const fechaTexto = findLabeledValue(lineas, [...ETIQUETAS.fechaNacimiento]);
  const fechaMatch = fechaTexto?.match(FECHA_SUELTA);

  const estadoCivil = findLabeledValue(lineas, [...ETIQUETAS.estadoCivil]);
  const genero = findLabeledValue(lineas, [...ETIQUETAS.genero]);
  const licencia = findLabeledValue(lineas, [...ETIQUETAS.licencia]);
  const libreta = findLabeledValue(lineas, [...ETIQUETAS.libreta]);
  const tarjeta = findLabeledValue(lineas, [...ETIQUETAS.tarjetaProfesional]);
  const disponibilidad = findLabeledValue(lineas, [...ETIQUETAS.disponibilidad]);
  const nacionalidad = findLabeledValue(lineas, [...ETIQUETAS.nacionalidad]);
  const lugarNacimiento = findLabeledValue(lineas, [...ETIQUETAS.lugarNacimiento]);
  const direccion = findLabeledValue(lineas, [...ETIQUETAS.direccion]);

  const ciudad = extraerCiudad(encabezado, todas);

  return {
    firstNames,
    lastNames,
    documentType,
    documentNumber,
    email: extraerCorreo(encabezado, todas),
    phone: extraerTelefono(encabezado, todas, documentNumber),
    cityResidence: ciudad,
    address: direccion ?? undefined,
    nationality: nacionalidad?.split(/[|,]/)[0].trim() ?? '',
    birthPlace: lugarNacimiento?.trim(),
    birthDate: fechaMatch ? fechaMatch[0].trim() : undefined,
    maritalStatus: estadoCivil?.split(/[|]/)[0].trim(),
    gender: genero?.split(/[|]/)[0].trim(),
    headline: extraerTitular(encabezado, lineaNombre, `${firstNames} ${lastNames}`, ciudad),
    salaryExpectation,
    availability: disponibilidad?.split(/[|]/)[0].trim(),
    driverLicense: licencia?.match(/\b(A1|A2|B1|B2|B3|C1|C2|C3)\b/i)?.[0].toUpperCase(),
    militaryCard: libreta?.split(/[|]/)[0].trim(),
    professionalCard: tarjeta?.match(/[A-Z0-9][A-Z0-9-]{3,20}/i)?.[0],
    socialLinks: socialLinks.length > 0 ? socialLinks : undefined,
  };
}
