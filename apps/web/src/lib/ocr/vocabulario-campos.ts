import { normalize } from './text-utils';

/**
 * Diccionario de las palabras que buscan los formularios del lector.
 *
 * Sirve para DOS cosas:
 *
 * 1. La seleccion automatica de preprocesado: entre varias lecturas de la misma
 *    imagen, gana la que trae mas palabras de este diccionario, porque son las
 *    que alimentan a los extractores. Una lectura con "telefono", "correo" y
 *    "experiencia laboral" llena el formulario; una con el mismo volumen de
 *    basura no llena nada.
 *
 * 2. Como referencia del vocabulario que los extractores entienden: si un campo
 *    nuevo necesita palabras, se anaden aqui y la seleccion de la imagen ya las
 *    va a favorecer.
 *
 * Las palabras viven sin acentos y en minusculas: `normalize` las prepara igual
 * cuando se compara. Las de menos de 4 letras se descartan al contar porque un
 * "nit" ("kai**nit**e", "mi**nit**o") o un "cc" ("a**cc**eso") aparecen dentro
 * de cualquier palabra y ensuciarian la medida.
 */

export const VOCABULARIO_CAMPOS: readonly string[] = [
  // Encabezados de seccion de la hoja de vida (coinciden con `sections.ts`).
  'datos personales',
  'datos de contacto',
  'informacion personal',
  'perfil profesional',
  'perfil laboral',
  'resumen profesional',
  'objetivo laboral',
  'experiencia laboral',
  'experiencia profesional',
  'trayectoria laboral',
  'formacion academica',
  'estudios realizados',
  'nivel educativo',
  'habilidades',
  'competencias',
  'idiomas',
  'referencias personales',
  'certificaciones',
  // Etiquetas de formulario (coinciden con `fields/personal.ts`).
  'nombre completo',
  'apellidos',
  'cedula',
  'documento de identidad',
  'identificacion',
  'telefono',
  'celular',
  'movil',
  'whatsapp',
  'correo electronico',
  'direccion de residencia',
  'ciudad de residencia',
  'domicilio',
  'nacionalidad',
  'estado civil',
  'fecha de nacimiento',
  'lugar de nacimiento',
  'aspiracion salarial',
  'disponibilidad',
  'salario',
  'sueldo',
  'empresa',
  'cargo',
  'experiencia',
  'formacion',
  'educacion',
];

/** Terminos ya normalizados, con los cortos descartados. */
const TERMINOS = VOCABULARIO_CAMPOS.map(normalize).filter((t) => t.length >= 4);

/**
 * Cuantas palabras del diccionario trae una lectura.
 *
 * La normalizacion tolera acentos ("experiencia laboral" y "EXPERIENCIA
 * LABORAL" cuentan igual), pero la comparacion es de subcadena, asi que una
 * palabra del diccionario pegada a otra dentro de la misma linea no se pierde
 * ("Telefono:318..." cuenta "telefono" y "ciudad").
 */
export function coberturaCampos(texto: string): number {
  const t = normalize(texto);
  let cuantas = 0;
  for (const termino of TERMINOS) {
    if (t.includes(termino)) cuantas++;
  }
  return cuantas;
}

/**
 * Patrones de dato aprovechable: correo, telefono, cedula o NIT, fecha y monto.
 * Son las cifras con forma que piden los formularios.
 */
export const PATRONES_DATO: RegExp[] = [
  /[\w.+-]+@[\w.-]+\.\w{2,}/g,
  /\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
  /\b\d{1,3}(?:[.\s]\d{3}){2,}\b/g,
  /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
  /\b\d{1,2}\s+(?:de\s+)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?\d{4}\b/gi,
  /\$\s*\d{1,3}(?:[.,]\d{3})+/g,
];

/**
 * Puntaje de "cuanto alimenta una lectura a los formularios": cada patron de
 * dato vale el doble que una palabra del diccionario, porque un correo o una
 * cedula reconocida es un campo llenado de una sola linea mientras que una
 * palabra del diccionario solo habilita la busqueda del campo.
 */
export function puntajeFormulario(texto: string): number {
  const vistos = new Set<string>();
  for (const patron of PATRONES_DATO) {
    for (const encontrado of texto.matchAll(patron)) {
      vistos.add(encontrado[0].replace(/\s+/g, ''));
    }
  }
  return vistos.size * 2 + coberturaCampos(texto);
}