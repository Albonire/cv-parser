import { createWorker, PSM, Worker } from 'tesseract.js';
import {
  GiroPagina,
  girarImagen,
  muestraGirada,
  preprocessImage,
  OpcionesPreproceso,
} from './image-prep';
import { buildLayout, DocumentLayout, PageInput, Word } from './layout';
import { normalizarPalabraOcr } from './ocr-normalize';
import { coberturaCampos, puntajeFormulario } from './vocabulario-campos';

/**
 * Motor de OCR en el navegador (WebAssembly).
 *
 * Dos decisiones importantes:
 *
 * 1. Se piden las cajas de cada palabra (`blocks`) y se pasan por el mismo motor
 *    de maquetacion que usan los PDF digitales. Antes se tomaba `data.text`, que
 *    es texto plano: para una foto o un escaneo a dos columnas eso significaba
 *    leer las dos columnas mezcladas renglon por renglon.
 *
 * 2. El modelo de idioma se sirve desde `/tessdata`, no desde un CDN. Asi el
 *    lector funciona sin conexion (RNF-3) y no depende de un tercero. Los
 *    archivos ya estaban en el repositorio pero no se referenciaban.
 */

/** Modelo de idioma servido por la propia aplicacion, no por un CDN. */
const LANG_PATH = '/tessdata';
/** Worker y nucleo WebAssembly, copiados a public/tesseract por scripts/copy-ocr-assets.mjs. */
const WORKER_PATH = '/tesseract/worker.min.js';
const CORE_PATH = '/tesseract';
const IDIOMAS = 'spa+eng';

let workerPromise: Promise<Worker> | null = null;

export async function getTesseractWorker(
  onProgress?: (progress: number, message: string) => void
): Promise<Worker> {
  if (!workerPromise) {
    if (onProgress) onProgress(10, 'Cargando motor de OCR (WebAssembly spa+eng)...');

    workerPromise = createWorker(IDIOMAS, undefined, {
      langPath: LANG_PATH,
      workerPath: WORKER_PATH,
      corePath: CORE_PATH,
      // Los archivos de `public/tessdata` estan sin comprimir.
      gzip: false,
    }).then(async (worker) => {
      await worker.setParameters({
        // Segmentacion automatica: detecta bloques y columnas en la propia imagen.
        tessedit_pageseg_mode: PSM.AUTO,
        // Conserva los espacios, necesarios para separar campos en un mismo renglon.
        preserve_interword_spaces: '1',
      });
      return worker;
    });
  }

  return workerPromise;
}

/** Libera el motor de OCR y su memoria WebAssembly. */
export async function terminateTesseractWorker(): Promise<void> {
  if (!workerPromise) return;
  const worker = await workerPromise;
  workerPromise = null;
  await worker.terminate();
}

export interface OcrExecutionResult {
  text: string;
  confidence: number;
  layout: DocumentLayout;
}

/**
 * Cuando la lectura en escala de grises es lo bastante buena como para no
 * gastar un segundo OCR con la imagen binarizada.
 *
 * La confianza de Tesseract NO sirve por si sola para decidirlo: cuando no
 * encuentra nada devuelve 0 caracteres con confianza 95, porque no hay nada de
 * lo que dudar. Medido sobre el banco de 40 escaneos, esa era la razon de que
 * el perfil duro se hundiera: en grises daba 43 caracteres con confianza 92 y
 * se aceptaban, cuando la binarizada de la misma pagina daba 2.197.
 *
 * La senal que si discrimina es la CANTIDAD de texto reconocido, acompanada de
 * una confianza alta.
 */
const CARACTERES_LECTURA_SOLIDA = 400;
const CONFIANZA_LECTURA_SOLIDA = 0.8;

interface Lectura {
  texto: string;
  confianza: number;
  cajas: unknown;
}

function lecturaSolida(texto: string, confianza: number): boolean {
  return texto.trim().length >= CARACTERES_LECTURA_SOLIDA && confianza >= CONFIANZA_LECTURA_SOLIDA;
}

/**
 * Compara dos lecturas de la misma pagina. Pesa la cantidad de texto por la
 * confianza, de modo que una lectura con mucho mas texto gana salvo que su
 * confianza sea bastante peor.
 */
function puntajeLectura(texto: string, confianza: number): number {
  return texto.trim().length * (0.5 + confianza / 2);
}

/**
 * Datos que los formularios piden: correo, telefono, cedula o NIT, fecha y
 * monto. Son los mismos para una hoja de vida y para un contrato, asi que
 * sirven de medida neutral de lo util que trae una lectura.
 */
const PATRONES_DATO: RegExp[] = [
  /[\w.+-]+@[\w.-]+\.\w{2,}/g,
  /\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
  /\b\d{1,3}(?:[.\s]\d{3}){2,}\b/g,
  /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
  /\b\d{1,2}\s+(?:de\s+)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?\d{4}\b/gi,
  /\$\s*\d{1,3}(?:[.,]\d{3})+/g,
];

/**
 * Cuantos datos aprovechables trae la lectura.
 *
 * Hace falta porque el volumen de texto no mide lo que interesa: en una tabla
 * de dos columnas cada preparado de la imagen captura una columna distinta, y
 * la que trae los rotulos y los titulos tiene mas caracteres que la que trae la
 * columna de valores. Medido en CT_04: la lectura ganadora por volumen (656
 * caracteres de titulos) daba peor resultado que la perdedora (345 caracteres
 * con la cedula, el domicilio y el cargo).
 */
function datosUtiles(texto: string): number {
  const vistos = new Set<string>();
  for (const patron of PATRONES_DATO) {
    for (const encontrado of texto.matchAll(patron)) vistos.add(encontrado[0].replace(/\s+/g, ''));
  }
  return vistos.size;
}

/**
 * Cual de dos lecturas conviene. Manda la cantidad de datos aprovechables y el
 * volumen de texto solo desempata: una lectura que trae dos campos mas es mejor
 * aunque tenga la mitad de caracteres.
 */
function comparaLecturas(a: Lectura, b: Lectura): number {
  const datos = datosUtiles(b.texto) - datosUtiles(a.texto);
  if (datos !== 0) return datos;
  return puntajeLectura(b.texto, b.confianza / 100) - puntajeLectura(a.texto, a.confianza / 100);
}

/**
 * Compara dos lecturas para la seleccion exhaustiva: manda el `puntajeFormulario`
 * (patrones de dato + palabras del diccionario de campos); el volumen de texto
 * solo desempata, igual que en `comparaLecturas`.
 */
function comparaPorFormulario(a: Lectura, b: Lectura): number {
  const campos = puntajeFormulario(b.texto) - puntajeFormulario(a.texto);
  if (campos !== 0) return campos;
  return puntajeLectura(b.texto, b.confianza / 100) - puntajeLectura(a.texto, a.confianza / 100);
}

interface LecturaEvaluada {
  lectura: Lectura;
  columnas: number;
  solida: boolean;
}

/**
 * Modos de segmentacion de pagina para reintentos.
 * Cuando PSM.AUTO no produce una lectura solida, se prueban otros modos
 * que pueden capturar mejor ciertos tipos de documentos:
 * - SINGLE_BLOCK: denso, ignora columnas (bueno para formularios compactos)
 * - SINGLE_COLUMN: fuerza una sola columna (bueno para hojas de vida simples)
 */
const PSM_VARIANTES: Array<{ modo: PSM; nombre: string }> = [
  { modo: PSM.AUTO, nombre: 'automatico' },
  { modo: PSM.SINGLE_BLOCK, nombre: 'bloque_unico' },
  { modo: PSM.SINGLE_COLUMN, nombre: 'columna_unico' },
];

/**
 * Intenta varios modos de segmentacion de pagina y devuelve la mejor lectura.
 * Solo se usa como reintento cuando la primera pasada con PSM.AUTO falla.
 */
async function leerConPsmVariante(
  worker: Worker,
  fuente: File | Blob
): Promise<Lectura> {
  let mejorLectura: Lectura = { texto: '', confianza: 0, cajas: [] };

  for (const variante of PSM_VARIANTES) {
    try {
      await worker.setParameters({
        tessedit_pageseg_mode: variante.modo,
        preserve_interword_spaces: '1',
      });

      const res = await worker.recognize(fuente, {}, { blocks: true, text: true });
      const lectura: Lectura = {
        texto: res.data.text ?? '',
        confianza: res.data.confidence ?? 0,
        cajas: res.data.blocks,
      };

      if (comparaLecturas(lectura, mejorLectura) < 0) {
        mejorLectura = lectura;
      }

      if (lecturaSolida(lectura.texto, lectura.confianza / 100)) break;
    } catch (error) {
      console.warn(`PSM ${variante.nombre} fallo:`, error);
    }
  }

  // Restaurar a PSM.AUTO para las siguientes paginas.
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
    preserve_interword_spaces: '1',
  });

  return mejorLectura;
}

interface CajaTesseract {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface PalabraTesseract {
  text: string;
  confidence: number;
  bbox: CajaTesseract;
}

/** Convierte las palabras de Tesseract al modelo comun de maquetacion. */
export function tesseractWordsToWords(palabras: PalabraTesseract[]): Word[] {
  return palabras
    .filter((p) => p.text.trim().length > 0)
    .map((p) => {
      const height = Math.max(1, p.bbox.y1 - p.bbox.y0);
      const confianza = Math.max(0, Math.min(1, p.confidence / 100));
      return {
        text: normalizarPalabraOcr(p.text.trim()),
        x: p.bbox.x0,
        y: p.bbox.y0,
        width: Math.max(1, p.bbox.x1 - p.bbox.x0),
        height,
        fontSize: height,
        confidence: confianza,
        uncertain: confianza < 0.6,
      };
    });
}

function extraerPalabras(blocks: unknown): PalabraTesseract[] {
  if (!Array.isArray(blocks)) return [];

  const palabras: PalabraTesseract[] = [];
  for (const block of blocks as { paragraphs?: { lines?: { words?: PalabraTesseract[] }[] }[] }[]) {
    for (const parrafo of block.paragraphs ?? []) {
      for (const linea of parrafo.lines ?? []) {
        for (const palabra of linea.words ?? []) palabras.push(palabra);
      }
    }
  }

  return palabras;
}

/**
 * Deteccion de la orientacion de la pagina.
 *
 * `image-prep` endereza mas o menos cinco grados, que cubre el papel torcido en
 * el cristal del escaner pero no la hoja metida al reves. Medido sobre el banco
 * de escaneos, una pagina girada 90 grados sacaba 12% de precision y una girada
 * 180 grados un 4%, contra el 70-95% de la misma maquetacion derecha: no es una
 * lectura peor, es una lectura perdida entera.
 *
 * La sonda es un OCR sobre una version reducida de la pagina. La senal que
 * discrimina es la CONFIANZA, no la cantidad de texto: girada, Tesseract sigue
 * emitiendo cientos de caracteres, pero baja de 92-95 a 38-51.
 *
 * Se sondea primero 0 y 180 grados, que comparten proporcion; si el derecho
 * gana con holgura no se prueban los otros dos. Asi la pagina normal, que es el
 * caso corriente, paga dos sondas pequenas y no cuatro.
 */
const ANCHO_SONDA = 800;
/** Confianza a partir de la cual la pagina derecha se da por buena sin mas sondas. */
const CONFIANZA_ORIENTACION_CLARA = 85;
/** Texto minimo para que la confianza de la sonda signifique algo. */
const CARACTERES_SONDA_UTIL = 60;
/**
 * Cuanto tiene que ganarle un giro al derecho para que se aplique. Girar una
 * pagina que estaba bien cuesta mucho mas que dejar sin girar una torcida, y
 * las paginas derechas son la inmensa mayoria.
 */
const MARGEN_ORIENTACION = 10;

interface Sonda {
  grados: GiroPagina;
  chars: number;
  conf: number;
  ancho: number;
  alto: number;
}

/**
 * Confianza util de una sonda: cuando Tesseract no encuentra texto devuelve una
 * confianza alta porque no tiene nada de lo que dudar, asi que sin texto
 * suficiente la sonda no vale nada.
 */
function valorSonda(s: Sonda): number {
  return s.chars < CARACTERES_SONDA_UTIL ? 0 : s.conf;
}

async function sondear(
  worker: Worker,
  fuente: File | Blob,
  grados: GiroPagina
): Promise<Sonda> {
  const muestra = await muestraGirada(fuente, grados, ANCHO_SONDA);
  const { data } = await worker.recognize(muestra, {}, { text: true });
  return {
    grados,
    chars: (data.text ?? '').trim().length,
    conf: data.confidence ?? 0,
    ancho: muestra.width,
    alto: muestra.height,
  };
}

/**
 * Giros que merece la pena probar segun la proporcion de la pagina.
 *
 * Una hoja carta escaneada derecha o al reves llega vertical; una escaneada de
 * lado llega apaisada. Podar por la proporcion quita la mitad de las sondas y,
 * sobre todo, evita el error caro: sin esta poda el sondeo llegaba a girar 90
 * grados paginas verticales que estaban perfectamente derechas.
 */
function girosPlausibles(ancho: number, alto: number): GiroPagina[] {
  return alto >= ancho ? [0, 180] : [0, 90, 270];
}

/** Grados que hay que girar la pagina para dejarla derecha. */
export async function detectarOrientacion(
  worker: Worker,
  fuente: File | Blob
): Promise<GiroPagina> {
  const derecho = await sondear(worker, fuente, 0);
  const candidatos = girosPlausibles(derecho.ancho, derecho.alto).filter((g) => g !== 0);

  // Pagina vertical que se lee bien: no hay nada que corregir.
  if (
    candidatos.length === 1 &&
    derecho.chars >= CARACTERES_SONDA_UTIL &&
    derecho.conf >= CONFIANZA_ORIENTACION_CLARA
  ) {
    return 0;
  }

  let mejor = derecho;
  for (const grados of candidatos) {
    const sonda = await sondear(worker, fuente, grados);
    if (valorSonda(sonda) > valorSonda(mejor)) mejor = sonda;
  }

  return valorSonda(mejor) >= valorSonda(derecho) + MARGEN_ORIENTACION ? mejor.grados : 0;
}

/**
 * Renglones minimos para dar por hecho que una lectura cubre la pagina entera.
 * Medido sobre los dos bancos: cuando el preprocesado destruye una tabla, la
 * lectura en gris se queda en 3 a 9 renglones (CT_07 seis, CT_09 tres, CT_05
 * nueve) mientras que una lectura completa da de 19 a 43. El hueco entre las
 * dos poblaciones es lo bastante ancho para separarlas con un solo numero.
 */
const RENGLONES_PAGINA_COMPLETA = 15;

/** Renglones no vacios de una lectura. */
function renglonesUtiles(texto: string): number {
  return texto.split('\n').filter((l) => l.trim().length > 0).length;
}

/** Un renglon con forma de "Etiqueta: valor" o de rotulo suelto ("Cargo:"). */
const RENGLON_ETIQUETADO = /^[^:\n]{2,35}:(?:\s*$|\s+\S)/;

/**
 * Proporcion de renglones etiquetados a partir de la cual la pagina se trata
 * como tabla de datos. Medido: las hojas de vida se quedan en 0,03 y los
 * contratos completos van de 0,23 a 0,38.
 */
const PROPORCION_TABLA = 0.15;

/**
 * En una tabla de datos cada preparado de la imagen captura una columna
 * distinta, asi que compensa leer las dos aunque la primera parezca completa.
 * En una hoja de vida, que es prosa, no.
 */
function pareceTablaEtiquetada(texto: string): boolean {
  const renglones = texto.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  if (renglones.length === 0) return false;
  const etiquetados = renglones.filter((l) => RENGLON_ETIQUETADO.test(l)).length;
  return etiquetados / renglones.length >= PROPORCION_TABLA;
}

/**
 * Variante de preprocesado que un usuario puede forzar desde la interfaz cuando
 * la lectura automatica no le sirve (valvula de escape, RN-7: revisar antes de
 * guardar). No altera la seleccion automatica por defecto: solo se usa si se
 * pide explicitamente.
 */
export type PreprocesoForzado =
  | 'gris'
  | 'plano'
  | 'desenfumado'
  | 'contraste'
  | 'binarizado'
  | 'original';

/** Opciones opcionales de OCR; hasta hoy solo la variante forzada. */
export interface OcrOptions {
  fuerzaPreproceso?: PreprocesoForzado;
}

const PRECONFIG_PREPROCESO: Record<Exclude<PreprocesoForzado, 'original'>, OpcionesPreproceso> = {
  gris: { binarizar: false, igualarLuz: true },
  plano: { binarizar: false, igualarLuz: false },
  desenfumado: { binarizar: false, igualarLuz: true, desenfumar: true },
  contraste: { binarizar: false, igualarLuz: true, mejorarContraste: true },
  binarizado: { binarizar: true },
};

/**
 * Lee la pagina probando los preprocesados que le pueden servir.
 *
 * Las fotografias de camara (WhatsApp, celular) leen mejor en escala de grises;
 * la binarizacion local, pensada para escaneos planos, les borra el texto. Al
 * reves ocurre con un escaneo con sombra, donde el gris no da nada. Y una tabla
 * de dos columnas puede necesitar la fuente sin preprocesar.
 *
 * La escala de grises se lee siempre. Las demas variantes cuestan un OCR entero
 * cada una, asi que solo se leen cuando la forma del documento dice que pueden
 * cambiar el resultado.
 *
 * Cuando se pasa `forzar`, se lee SOLO esa preparacion y se devuelve sin entrar
 * en la seleccion por puntaje: es la valvula de escape de la interfaz.
 */
async function leerConVariantes(
  worker: Worker,
  fuente: File | Blob,
  forzar?: PreprocesoForzado
): Promise<Lectura> {
  const leer = async (src: File | Blob): Promise<Lectura> => {
    const res = await worker.recognize(src, {}, { blocks: true, text: true });
    return {
      texto: res.data.text ?? '',
      confianza: res.data.confidence ?? 0,
      cajas: res.data.blocks,
    };
  };

  // Cuantas columnas detecta la maquetacion para esa lectura y si es solida.
  const evaluar = (l: Lectura): { lectura: Lectura; columnas: number; solida: boolean } => {
    const palabras = tesseractWordsToWords(extraerPalabras(l.cajas));
    const ancho = Math.max(1, ...palabras.map((w) => w.x + w.width));
    const alto = Math.max(1, ...palabras.map((w) => w.y + w.height));
    const layout = buildLayout([{ words: palabras, width: ancho, height: alto }]);
    return {
      lectura: l,
      columnas: Math.max(1, layout.columnsPerPage[0] ?? 1),
      solida: lecturaSolida(l.texto, l.confianza / 100),
    };
  };
  const score = (l: Lectura) => puntajeLectura(l.texto, l.confianza / 100);

  // Valvula de escape: leer SOLO la variante pedida por el usuario y devolverla
  // sin la seleccion automatica por puntaje.
  if (forzar) {
    try {
      if (forzar === 'original') {
        return evaluar(await leer(fuente)).lectura;
      }
      const preparada = await preprocessImage(fuente, PRECONFIG_PREPROCESO[forzar]);
      return evaluar(await leer(preparada)).lectura;
    } catch (error) {
      console.warn(`Lectura forzada "${forzar}" omitida, se usa la fuente original:`, error);
      return evaluar(await leer(fuente)).lectura;
    }
  }

  const preprocesar = async (
    binarizar: boolean,
    igualarLuz = true,
    desenfumar = false,
    mejorarContraste = false
  ): Promise<Blob | null> => {
    try {
      return await preprocessImage(fuente, { binarizar, igualarLuz, desenfumar, mejorarContraste });
    } catch (error) {
      console.warn(`Preprocesamiento ${binarizar ? 'binarizado' : 'en escala de grises'} omitido:`, error);
      return null;
    }
  };

  const leerVariante = async (src: Blob | null, nombre: string) => {
    if (!src) return null;
    try {
      return evaluar(await leer(src));
    } catch (error) {
      console.warn(`Lectura ${nombre} omitida:`, error);
      return null;
    }
  };

  const gris = await preprocesar(false);
  let conGris = await leerVariante(gris, 'en escala de grises');

  /** La lectura cubre la pagina y no hay nada mas que buscar. */
  const cubreLaPagina = (c: typeof conGris) =>
    !!c && c.solida && renglonesUtiles(c.lectura.texto) >= RENGLONES_PAGINA_COMPLETA;

  // La igualacion de luz levanta mucho las fotos con vineta o sombra y estorba
  // en los escaneos muy degradados, donde emborrona el texto en vez de igualar
  // el papel. No hay forma barata de distinguirlos mirando la imagen: se probo
  // con la energia de borde y no separa los dos casos, asi que se lee tambien
  // sin igualar y gana la que mas texto reconoce.
  //
  // Se paga cuando la lectura igualada no cubre la pagina, y tambien cuando
  // tiene forma de tabla de datos: ahi cada preparado captura una columna
  // distinta y la que parece completa puede estar dejandose la mitad de los
  // campos. En una hoja de vida, que es prosa, no se paga.
  if (!cubreLaPagina(conGris) || (conGris && pareceTablaEtiquetada(conGris.lectura.texto))) {
    const conGrisPlano = await leerVariante(await preprocesar(false, false), 'en gris sin igualar');
    if (conGrisPlano && (!conGris || comparaLecturas(conGrisPlano.lectura, conGris.lectura) < 0)) {
      conGris = conGrisPlano;
    }
  }

  // NUEVO: Variante desenfumada -- elimina ruido de sal y pimienta que confunde
  // a Sauvola y produce caracteres fantasmas en el OCR.
  if (!cubreLaPagina(conGris)) {
    const desenfumada = await preprocesar(false, true, true);
    const conDesenfumada = await leerVariante(desenfumada, 'desenfumada');
    if (conDesenfumada && (!conGris || comparaLecturas(conDesenfumada.lectura, conGris.lectura) < 0)) {
      conGris = conDesenfumada;
    }
  }

  // NUEVO: Variante con CLAHE real -- para documentos muy palidos o con
  // iluminacion muy desigual donde el contraste original es insuficiente.
  if (!cubreLaPagina(conGris)) {
    const mejorada = await preprocesar(false, true, false, true);
    const conMejora = await leerVariante(mejorada, 'contraste_mejorado');
    if (conMejora && (!conGris || comparaLecturas(conMejora.lectura, conGris.lectura) < 0)) {
      conGris = conMejora;
    }
  }

  // Si la lectura en gris cubre la pagina no hay nada que la fuente original
  // pueda anadir, y leerla cuesta un OCR entero. Solo se paga cuando el gris se
  // queda corto, que es justo cuando el preprocesado ha borrado una tabla:
  // Tesseract devuelve confianza alta aunque no haya encontrado casi nada, asi
  // que "solida" por si sola no basta para decidirlo.
  // La condicion de tabla ya se ha cobrado arriba: si la ganadora cubre la
  // pagina, no hay por que pagar ademas la fuente original. Se midio lo
  // contrario, dejar que una tabla probara siempre la fuente, y cuesta 0,8
  // puntos y dos segundos por documento sin ganar nada.
  if (cubreLaPagina(conGris)) {
    return conGris!.lectura;
  }

  // Fuente original: lee completa una tabla alineada cuyas celdas tocan el
  // canal. La escala de grises la pierde porque Sauvola funde el fondo gris de
  // la etiqueta con su texto. A la inversa, en una tabla desfasada la escala de
  // grises REVELA la estructura de dos columnas que el parser aprovecha.
  let lecturaFuente: Lectura | null = null;
  try {
    lecturaFuente = await leer(fuente);
  } catch (error) {
    console.warn('Lectura de la fuente original omitida:', error);
  }
  const conFuente = lecturaFuente ? evaluar(lecturaFuente) : null;

  // Una lectura con dos columnas bien formadas y solida es la que el parser
  // de tablas aprovecha (la geometria resuelve etiqueta->valor). Se prefiere
  // siempre, aunque la otra tenga mas texto.
  const enDosColumnas = [conFuente, conGris].filter(
    (c): c is NonNullable<typeof c> => !!c && c.columnas >= 2 && c.solida
  );
  if (enDosColumnas.length > 0) {
    return [...enDosColumnas].sort((a, b) => comparaLecturas(a.lectura, b.lectura))[0].lectura;
  }

  // Todo de una columna: se conserva la escala de grises (configuracion
  // historica que lee bien las hojas de vida) salvo que la fuente original
  // reconozca muchisimo mas texto, como en una tabla alineada.
  const solidas = [conFuente, conGris].filter(
    (c): c is NonNullable<typeof c> => !!c && c.solida
  );
  if (solidas.length > 0) {
    const conLaFuente = solidas.find((c) => c === conFuente);
    const conElGris = solidas.find((c) => c === conGris);
    if (conLaFuente && conElGris) {
      if (conLaFuente.lectura.texto.length >= conElGris.lectura.texto.length * 1.6) {
        return conLaFuente.lectura;
      }
      return conElGris.lectura;
    }
    return solidas.sort((a, b) => comparaLecturas(a.lectura, b.lectura))[0].lectura;
  }

  // Ninguna fue solida. Se lee tambien la variante binarizada (pensada para un
  // escaneo plano con sombra) pero como ULTIMO recurso: en una foto de camara
  // (baja luz, vineta) la binarizacion local borra los trazos finos y el OCR
  // devuelve basura aun con confianza alta. Antes entraba en igualdad de
  // condiciones y ganaba por volumen, porque a mas basura mas caracteres y mas
  // "datos" aparentes (fechas, montos y cedulas de relleno). Medido en las fotos
  // reales de expediente: el contrato lei mejor original/gris, pero ganaba la
  // binarizada por 425 caracteres de ruido contra 223 limpios.
  // La binarizada solo debe superar a las demas sin condiciones cuando el
  // insumo es una pagina de PDF (escaneo plano, para el que se invento): en los
  // formularios duros con sombra es justamente la mejor lectura, aunque su
  // confianza sea menor que la de la escala de grises (medido: CV_04 y CV_17
  // pierden 50 puntos si se la rechaza por confianza o por volumen).
  //
  // En cambio, cuando el insumo es una FOTO de camara (un File enviado por el
  // usuario), la binarizacion borra los trazos finos y el OCR devuelve basura:
  // mas caracteres, mas "datos" aparentes y MENOS confianza que la fuente
  // limpia. Medido en el contrato de WhatsApp: la binarizada ganaba con 776
  // caracteres ilegibles (51%) a la fuente original limpia (82%).
  const esFotoCamara = fuente instanceof File;
  const binarizada = await preprocesar(true);
  let lecturaBinarizada: ReturnType<typeof evaluar> | null = null;
  if (binarizada && binarizada !== gris) {
    try {
      lecturaBinarizada = evaluar(await leer(binarizada));
    } catch (error) {
      console.warn('Lectura binarizada omitida:', error);
    }
  }

  const noBinarizadas = [conFuente, conGris].filter(
    (c): c is NonNullable<typeof c> => !!c
  );

  if (esFotoCamara && lecturaBinarizada && noBinarizadas.length > 0) {
    const mejorSinBinarizar = [...noBinarizadas].sort(
      (a, b) => comparaLecturas(a.lectura, b.lectura)
    )[0];
    const longitudS = mejorSinBinarizar.lectura.texto.trim().length;
    // Las sin binarizar no reconocieron practicamente nada (p. ej. una cedula
    // oscura): ahi la binarizada es el unico camino y se acepta.
    const noLeyeronCasiNada =
      longitudS < CARACTERES_LECTURA_SOLIDA / 4 &&
      mejorSinBinarizar.lectura.confianza < CONFIANZA_LECTURA_SOLIDA;
    // La binarizada de una foto solo suma si aporta mas datos con confianza
    // decente. Ni el volumen ni la cantidad de basura cuentan: a mas ruido mas
    // caracteres y mas patrones de dato aparentes.
    const ganaClaramente =
      datosUtiles(lecturaBinarizada.lectura.texto) >=
        datosUtiles(mejorSinBinarizar.lectura.texto) + 2 &&
      lecturaBinarizada.lectura.confianza >= 0.6;
    if (!noLeyeronCasiNada && !ganaClaramente) {
      return mejorSinBinarizar.lectura;
    }
  }

  const candidatas = [...noBinarizadas];
  if (lecturaBinarizada) candidatas.push(lecturaBinarizada);
  if (candidatas.length === 0) return { texto: '', confianza: 0, cajas: [] };
  return [...candidatas].sort((a, b) => comparaLecturas(a.lectura, b.lectura))[0].lectura;
}

/**
 * Cuantas palabras del diccionario de campos hacen falta para dar una lectura
 * por buena en la seleccion exhaustiva. La escala de grises puede cubrir la
 * pagina entera y estar leyendo mitad basura: si no trae el vocabulario de los
 * formularios, las otras variantes pueden ganarle.
 */
const COBERTURA_CAMPOS_SUFICIENTE = 6;

/**
 * Lectura exhaustiva para UNA imagen: prueba todas las preparaciones y elige la
 * que mejor alimenta a los formularios.
 *
 * La seleccion por defecto (`leerConVariantes`) se detiene en cuanto la escala
 * de grises cubre la pagina (400 caracteres, confianza 0,8 y quince renglones).
 * Eso ahorra un OCR por pagina en un lote, pero en una foto donde la escala de
 * grises lee "suficiente" y mal -- mucha basura o la mitad de las palabras -,
 * nunca se prueba la variante que la lee mejor. Aqui se leen gris, plano,
 * desenfumado, contraste y la fuente original, y gana la que sume mas
 * `puntajeFormulario` (patrones de dato + palabras del diccionario de campos).
 *
 * Se corta antes solo cuando una lectura es solida Y cubre el diccionario: ahi
 * no hay nada mas que buscar y las variantes restantes solo costarian OCRs
 * enteros. Es el caso corriente de una foto limpia.
 */
async function leerExhaustivo(worker: Worker, fuente: File | Blob): Promise<Lectura> {
  const leer = async (src: File | Blob): Promise<Lectura> => {
    const res = await worker.recognize(src, {}, { blocks: true, text: true });
    return {
      texto: res.data.text ?? '',
      confianza: res.data.confidence ?? 0,
      cajas: res.data.blocks,
    };
  };

  const evaluar = (l: Lectura): LecturaEvaluada => {
    const palabras = tesseractWordsToWords(extraerPalabras(l.cajas));
    const ancho = Math.max(1, ...palabras.map((w) => w.x + w.width));
    const alto = Math.max(1, ...palabras.map((w) => w.y + w.height));
    const layout = buildLayout([{ words: palabras, width: ancho, height: alto }]);
    return {
      lectura: l,
      columnas: Math.max(1, layout.columnsPerPage[0] ?? 1),
      solida: lecturaSolida(l.texto, l.confianza / 100),
    };
  };

  const preprocesar = async (opciones: OpcionesPreproceso): Promise<Blob | null> => {
    try {
      return await preprocessImage(fuente, opciones);
    } catch (error) {
      console.warn('Preprocesamiento omitido:', error);
      return null;
    }
  };

  const leerVariante = async (nombre: string, src: File | Blob | null): Promise<LecturaEvaluada | null> => {
    if (!src) return null;
    try {
      return evaluar(await leer(src));
    } catch (error) {
      console.warn(`Lectura ${nombre} omitida:`, error);
      return null;
    }
  };

  /** La lectura es solida, cubre la pagina entera y trae el vocabulario de los formularios. */
  const cubreLosCampos = (c: LecturaEvaluada | null) =>
    !!c &&
    c.solida &&
    renglonesUtiles(c.lectura.texto) >= RENGLONES_PAGINA_COMPLETA &&
    coberturaCampos(c.lectura.texto) >= COBERTURA_CAMPOS_SUFICIENTE;

  const conGris = await leerVariante(
    'en escala de grises',
    await preprocesar({ binarizar: false, igualarLuz: true })
  );
  if (cubreLosCampos(conGris)) return conGris!.lectura;
  const candidatas: LecturaEvaluada[] = [];
  if (conGris) candidatas.push(conGris);

  const conPlano = await leerVariante(
    'en gris sin igualar',
    await preprocesar({ binarizar: false, igualarLuz: false })
  );
  if (conPlano) {
    candidatas.push(conPlano);
    if (cubreLosCampos(conPlano)) return conPlano.lectura;
  }

  const conDesenfumada = await leerVariante(
    'desenfumada',
    await preprocesar({ binarizar: false, igualarLuz: true, desenfumar: true })
  );
  if (conDesenfumada) {
    candidatas.push(conDesenfumada);
    if (cubreLosCampos(conDesenfumada)) return conDesenfumada.lectura;
  }

  const conContraste = await leerVariante(
    'contraste_mejorado',
    await preprocesar({ binarizar: false, igualarLuz: true, mejorarContraste: true })
  );
  if (conContraste) {
    candidatas.push(conContraste);
    if (cubreLosCampos(conContraste)) return conContraste.lectura;
  }

  const conFuente = await leerVariante('en la fuente original', fuente);
  if (conFuente) {
    candidatas.push(conFuente);
    if (cubreLosCampos(conFuente)) return conFuente.lectura;
  }

  // La binarizada borra los trazos finos de una foto de camara y devuelve basura
  // con confianza alta, asi que solo se lee cuando ninguna variante sin binarizar
  // cubrio los campos; incluso ahi gana solo si aporta claramente mas de lo que
  // reconocieron las demas (ver la guarda en `leerConVariantes`).
  let conBinarizada: LecturaEvaluada | null = null;
  if (!candidatas.some(cubreLosCampos)) {
    conBinarizada = await leerVariante('binarizada', await preprocesar({ binarizar: true }));
  }

  const dosColumnas = [...candidatas, conBinarizada].filter(
    (c): c is LecturaEvaluada => !!c && c.columnas >= 2 && c.solida
  );
  if (dosColumnas.length > 0) {
    return [...dosColumnas].sort((a, b) => comparaPorFormulario(a.lectura, b.lectura))[0].lectura;
  }

  if (conBinarizada) {
    const mejorSinBinarizar = [...candidatas].sort((a, b) =>
      comparaPorFormulario(a.lectura, b.lectura)
    )[0];
    const noLeyeronCasiNada =
      mejorSinBinarizar.lectura.texto.trim().length < CARACTERES_LECTURA_SOLIDA / 4 &&
      mejorSinBinarizar.lectura.confianza < CONFIANZA_LECTURA_SOLIDA * 100;
    const ganaClaramente =
      puntajeFormulario(conBinarizada.lectura.texto) >=
        puntajeFormulario(mejorSinBinarizar.lectura.texto) + 2 &&
      conBinarizada.lectura.confianza >= 60;
    if (!noLeyeronCasiNada && !ganaClaramente) {
      return mejorSinBinarizar.lectura;
    }
  }

  const pool = conBinarizada ? [...candidatas, conBinarizada] : candidatas;
  if (pool.length === 0) return { texto: '', confianza: 0, cajas: [] };
  return [...pool].sort((a, b) => comparaPorFormulario(a.lectura, b.lectura))[0].lectura;
}

/** Proporciones de la imagen, sin pasar por OCR. */
async function esApaisada(fuente: File | Blob): Promise<boolean> {
  const bitmap = await createImageBitmap(fuente);
  const apaisada = bitmap.width > bitmap.height;
  bitmap.close?.();
  return apaisada;
}

/** Reconoce un elemento de imagen corrigiendo antes su orientacion. */
async function reconocerElemento(
  worker: Worker,
  item: File | Blob | HTMLCanvasElement,
  forzar?: PreprocesoForzado
): Promise<Lectura> {
  // En Node (pruebas) no hay Canvas: se manda el archivo tal cual.
  if (typeof window === 'undefined' || !(item instanceof File || item instanceof Blob)) {
    const { data } = await worker.recognize(item as HTMLCanvasElement, {}, { blocks: true, text: true });
    return { texto: data.text ?? '', confianza: data.confidence ?? 0, cajas: data.blocks };
  }

  // Valvula de escape: se respeta la variante pedida sin sondear orientacion ni
  // reintentar con otros PSM, porque el usuario quiere exactamente esa lectura.
  if (forzar) {
    return leerConVariantes(worker, item, forzar);
  }

  // Una pagina apaisada es sospechosa de venir escaneada de lado, asi que se
  // sondea ANTES de leerla: leerla de lado no cuesta menos y no sirve de nada.
  let apaisada = false;
  try {
    apaisada = await esApaisada(item);
  } catch (error) {
    console.warn('No se pudo medir la pagina:', error);
  }

  if (apaisada) {
    try {
      const giro = await detectarOrientacion(worker, item);
      if (giro !== 0) return leerConVariantes(worker, await girarImagen(item, giro));
    } catch (error) {
      console.warn('Deteccion de orientacion omitida:', error);
    }
    return leerConVariantes(worker, item);
  }

  // Una sola imagen (foto subida por el usuario) se lee de forma exhaustiva:
  // se prueban todas las preparaciones y gana la que mejor alimenta a los
  // formularios, sin que el usuario tenga que elegir variante. Un lote de
  // paginas de PDF escaneado usa la seleccion economica de `leerConVariantes`,
  // que ya se mide sobre el banco de escaneos.
  const esImagenUnica = item instanceof File;

  // Pagina vertical: se lee primero y solo se sondea la orientacion si salio
  // mal. Es el caso corriente, y asi no paga ninguna sonda.
  const lectura = await (esImagenUnica
    ? leerExhaustivo(worker, item)
    : leerConVariantes(worker, item));
  if (lecturaSolida(lectura.texto, lectura.confianza / 100)) return lectura;

  // NUEVO: Si la primera lectura no es solida, intentar con otros PSM.
  // SINGLE_BLOCK es bueno para formularios compactos; SINGLE_COLUMN para
  // hojas de vida simples sin columnas detectables.
  let mejorLectura = lectura;
  // Un reintento con menos del 40% de confianza es basura de OCR; solo se
  // acepta cuando la lectura actual no reconocio practicamente nada. Sin este
  // piso, una cedula oscura leida a 53% era reemplazada por un reintento PSM a
  // 32% solo porque la basura cazaba un patron de dato de relleno.
  const reemplazaReintento = (reintento: Lectura) =>
    reintento.confianza / 100 >= 0.4 ||
    mejorLectura.texto.trim().length < 50;
  try {
    const reintentoPsm = await leerConPsmVariante(worker, item);
    if (reemplazaReintento(reintentoPsm) && comparaLecturas(reintentoPsm, mejorLectura) < 0) {
      mejorLectura = reintentoPsm;
    }
  } catch (error) {
    console.warn('Reintentos PSM fallaron:', error);
  }

  if (lecturaSolida(mejorLectura.texto, mejorLectura.confianza / 100)) return mejorLectura;

  try {
    const giro = await detectarOrientacion(worker, item);
    if (giro !== 0) {
      const reintento = await leerConVariantes(worker, await girarImagen(item, giro));
      if (reemplazaReintento(reintento) && comparaLecturas(reintento, mejorLectura) < 0) {
        mejorLectura = reintento;
      }
    }
  } catch (error) {
    console.warn('Deteccion de orientacion omitida:', error);
  }

  return mejorLectura;
}

/** Ejecuta OCR sobre uno o varios archivos, blobs o canvas. */
export async function performOcr(
  input: File | Blob | HTMLCanvasElement | (File | Blob | HTMLCanvasElement)[],
  onProgress?: (progress: number, message: string) => void,
  opciones?: OcrOptions
): Promise<OcrExecutionResult> {
  const fuerza = opciones?.fuerzaPreproceso;
  const worker = await getTesseractWorker(onProgress);
  const items = Array.isArray(input) ? input : [input];

  const paginas: PageInput[] = [];
  const textosRespaldo: string[] = [];
  let sumaConfianza = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (onProgress) {
      const base = Math.round((i / items.length) * 60) + 20;
      onProgress(base, `Reconociendo texto en pagina ${i + 1} de ${items.length}...`);
    }

    const { texto, confianza, cajas } = await reconocerElemento(worker, item, fuerza);

    const palabras = extraerPalabras(cajas);
    const words = tesseractWordsToWords(palabras);

    const ancho = Math.max(1, ...words.map((w) => w.x + w.width));
    const alto = Math.max(1, ...words.map((w) => w.y + w.height));

    paginas.push({ words, width: ancho, height: alto });
    textosRespaldo.push(texto);
    sumaConfianza += confianza;
  }

  const layout = buildLayout(paginas);
  const confianza = items.length > 0 ? sumaConfianza / items.length / 100 : 0;

  return {
    // Si Tesseract no devolvio cajas, se usa el texto plano como respaldo.
    text: layout.lines.length > 0 ? layout.text : textosRespaldo.join('\n\n'),
    confidence: confianza,
    layout,
  };
}
