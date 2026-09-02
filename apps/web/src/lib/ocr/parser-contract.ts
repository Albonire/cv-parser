import { ContractFormData, ContractType, PaymentFrequency } from '../../types/contract';
import { DocumentLayout, layoutFromPlainText } from './layout';
import {
  findLabeledValue,
  findLabeledValueFuzzy,
  findLabeledValueOrNextLine,
  normalize,
} from './text-utils';

/**
 * Parsea el texto de un contrato de trabajo y completa el Formulario 5.2
 * sin valores ficticios o quemados.
 *
 * A diferencia del parser anterior (regex sobre texto plano), este parser es
 * consciente del `DocumentLayout`: trabaja renglon a renglon con
 * `findLabeledValue` y `splitLabeledPairs` (el mismo patron que el parser de CV)
 * para no cruzar una etiqueta de una linea con el valor de otra seccion. Eso
 * corrige las fechas en contratos de dos columnas, donde la etiqueta
 * "Fecha de inicio" caia en la columna izquierda y el valor en la derecha.
 */

const ETIQUETAS_EMPLEADOR = ['empleador', 'empresa', 'razon social', 'empleadora', 'employer'];
const ETIQUETAS_NIT = ['nit', 'rut', 'tax id', 'nit del empleador', 'identificacion tributaria'];
const ETIQUETAS_TRABAJADOR = [
  'trabajador', 'empleado', 'contratista', 'nombre del trabajador',
  'nombre del empleado', 'nombre del contratista', 'worker', 'employee',
];
const ETIQUETAS_CEDULA = [
  'cedula', 'cedula de ciudadania', 'cedula ciudadania', 'cedula no', 'cc', 'c c',
  'cc no', 'cc numero', 'documento', 'documento de identidad', 'documento de identificacion',
  'numero de documento', 'identificacion', 'no de identificacion', 'id',
  'cedula del trabajador', 'documento del trabajador', 'cc del trabajador',
  'identificacion del trabajador', 'numero de cedula', 'no de cedula',
];
const ETIQUETAS_CARGO = [
  'cargo', 'puesto', 'funcion a desempenar', 'labor', 'cargo a desempenar',
  'ocupacion', 'position', 'job title', 'cargo del trabajador',
  'cargo al que aspira', 'cargo aspirado', 'puesto de trabajo', 'puesto a desempenar',
  'cargo a ocupar', 'empleo a desempenar',
];
const ETIQUETAS_SALARIO = [
  'salario', 'sueldo', 'remuneracion', 'salario mensual', 'salario basico',
  'asalario', 'salary', 'wage', 'honorarios', 'salario integral',
  'salario basico mensual', 'salario devengado', 'salario asignado', 'salario convenido',
  'remuneracion mensual', 'asignacion salarial',
];
const ETIQUETAS_INICIO = [
  'fecha de iniciacion', 'inicia el', 'desde el', 'fecha de inicio',
  'fecha inicial', 'fecha de celebracion', 'start date', 'inicio del contrato',
  'inicio', 'fecha de inicio del contrato',
];
const ETIQUETAS_FIN = [
  'fecha de vencimiento', 'termina el', 'hasta el', 'fecha de finalizacion',
  'finalizacion', 'end date', 'expiration date', 'fecha de terminacion',
  'fecha de corte', 'terminacion del contrato', 'vencimiento',
];
const ETIQUETAS_PRUEBA = [
  'periodo de prueba', 'periodo probatorio', 'prueba', 'probationary period', 'probation period',
];
const ETIQUETAS_LUGAR = [
  'lugar de ejecucion', 'ciudad de trabajo', 'domicilio contractual',
  'lugar de trabajo', 'lugar de ejecucion del contrato', 'location', 'workplace',
  'ciudad de ejecucion',
];
const ETIQUETAS_DOMICILIO_EMPLEADOR = [
  'domicilio del empleador', 'direccion del empleador', 'domicilio de la empresa',
  'direccion de la empresa', 'domicilio de la razon social',
];
const ETIQUETAS_CORREO_EMPLEADOR = [
  'correo electronico del empleador', 'correo del empleador', 'email del empleador',
  'correo electronico de la empresa', 'correo de la empresa', 'e-mail del empleador',
];
const ETIQUETAS_DOMICILIO_TRABAJADOR = [
  'domicilio del trabajador', 'direccion del trabajador',
  'direccion de residencia del trabajador', 'residencia del trabajador',
  'domicilio del empleado', 'direccion del empleado', 'ciudad de residencia del trabajador',
];
const ETIQUETAS_CORREO_TRABAJADOR = [
  'correo electronico del trabajador', 'correo del trabajador', 'email del trabajador',
  'correo electronico del empleado', 'correo del empleado',
];
const ETIQUETAS_NACIMIENTO = [
  'fecha de nacimiento', 'fecha nacimiento', 'nacimiento',
  'fecha de nacimiento del trabajador', 'fecha de nacimiento del empleado',
  'birth date', 'date of birth',
];

/**
 * Etiquetas que abren el bloque del trabajador. En el contrato en papel de
 * Rosimar la tabla repite "Identificación:" y "Domicilio:" para el empleador y
 * para el trabajador, asi que sin acotar el ambito el parser se queda siempre
 * con el primero, que es el de la empresa: la cedula del trabajador salia con
 * el NIT y su correo con el corporativo.
 */
const MARCADORES_TRABAJADOR = ['trabajador', 'empleado', 'contratista', 'worker', 'employee'];

/**
 * Parte la maquetacion en el bloque del empleador y el del trabajador por el
 * renglon que abre los datos del trabajador. Si no hay marcador, los dos
 * ambitos son el documento entero y se comporta como antes.
 */
function ambitos(documento: DocumentLayout): {
  empleador: DocumentLayout;
  trabajador: DocumentLayout;
} {
  const marcador = documento.lines.find((linea) => {
    const norm = normalize(linea.text.replace(/[:.]\s*$/, '').trim());
    return MARCADORES_TRABAJADOR.some((m) => norm === m || norm.startsWith(`${m} `));
  });

  if (!marcador) return { empleador: documento, trabajador: documento };

  // El corte va por GEOMETRIA, no por posicion en el array: cuando se detectan
  // dos columnas, los renglones vienen ordenados columna por columna, asi que
  // partir por indice dejaria todos los valores de la derecha fuera del bloque
  // del empleador.
  const recortar = (lines: typeof documento.lines): DocumentLayout => ({
    ...documento,
    lines,
    text: lines.map((l) => l.text).join('\n'),
  });

  const antes = documento.lines.filter(
    (l) => l.page < marcador.page || (l.page === marcador.page && l.y < marcador.y)
  );
  const desde = documento.lines.filter(
    (l) => l.page > marcador.page || (l.page === marcador.page && l.y >= marcador.y)
  );

  // Si el marcador esta al principio no hay bloque de empleador util.
  return {
    empleador: antes.length >= 2 ? recortar(antes) : documento,
    trabajador: desde.length >= 2 ? recortar(desde) : documento,
  };
}


/**
 * Busca la etiqueta primero en su bloque (empleador o trabajador) y, si no
 * aparece, en el documento entero. Acotar solo desempata cuando la misma
 * etiqueta se repite; nunca puede hacer que se pierda un campo que antes se
 * encontraba.
 */
function valorEnBloque(
  bloque: DocumentLayout,
  documento: DocumentLayout,
  etiquetas: string[],
  opciones?: { useFuzzy?: boolean }
): string | null {
  return valorDeEtiqueta(bloque, etiquetas, opciones) ?? valorDeEtiqueta(documento, etiquetas, opciones);
}

export function parseContractText(text: string, layout?: DocumentLayout): ContractFormData {
  const documento = layout ?? layoutFromPlainText(text);
  const lineas = documento.lines.map((l) => l.text);

  // Con DAFT de bloques: se construye un texto global para los patrones de
  // deteccion de tipo/pago (que son de barrido) y se usan las etiquetas para
  // los campos etiquetados (con valor en la misma linea).
  const todas = lineas.join('\n');
  const { empleador: bloqueEmpleador, trabajador: bloqueTrabajador } = ambitos(documento);

  // 1. Empleador
  const employerName = limpiarValor(valorEnBloque(bloqueEmpleador, documento, ETIQUETAS_EMPLEADOR)) ?? '';
  const employerNit = limpiarNit(valorEnBloque(bloqueEmpleador, documento, ETIQUETAS_NIT)) ?? '';
  const employerAddress =
    limpiarValor(valorEnBloque(bloqueEmpleador, documento, ETIQUETAS_DOMICILIO_EMPLEADOR, { useFuzzy: false })) ?? '';
  const employerEmail =
    limpiarValor(extraerCorreo(valorEnBloque(bloqueEmpleador, documento, ETIQUETAS_CORREO_EMPLEADOR))) ?? '';

  // 2. Trabajador, Documento y datos personales del trabajador
  const workerName = limpiarValor(valorDeEtiqueta(documento, ETIQUETAS_TRABAJADOR)) ?? '';
  const workerDocumentRaw = valorEnBloque(bloqueTrabajador, documento, ETIQUETAS_CEDULA);
  let workerDocumentNumber = workerDocumentRaw
    ? workerDocumentRaw.replace(/[.\s-]/g, '').replace(/\D/g, '')
    : '';
  if (!workerDocumentNumber) workerDocumentNumber = buscarCedulaGenerica(todas) ?? '';
  const workerDateOfBirth = limpiarValor(
    valorEnBloque(bloqueTrabajador, documento, ETIQUETAS_NACIMIENTO, { useFuzzy: false })
  )?.trim();
  const workerDateOfBirthIso = workerDateOfBirth
    ? normalizarFecha(workerDateOfBirth)
    : (() => {
        // La fecha pudo quedar pegada a la etiqueta en la prosa del contrato
        // ("Fecha de nacimiento: 12 de mayo de 1990").
        const enProsa = todas.match(
          /fech[a]?\s+de\s+nacimiento\s*[:#.-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+de\s+[a-z]+\s+de\s+\d{4})/i
        );
        return enProsa ? normalizarFecha(enProsa[1]) : '';
      })();
  const workerAddress =
    limpiarValor(valorEnBloque(bloqueTrabajador, documento, ETIQUETAS_DOMICILIO_TRABAJADOR, { useFuzzy: false }))
      ?? '';
  const workerEmail =
    limpiarValor(extraerCorreo(valorEnBloque(bloqueTrabajador, documento, ETIQUETAS_CORREO_TRABAJADOR))) ?? '';

  // 4. Cargo / Posicion
  const position =
    limpiarValor(valorDeEtiqueta(documento, ETIQUETAS_CARGO)) ??
    extraerCargoDeProsa(todas) ??
    '';

  // 5. Salario
  const salary = extraerSalario(valorDeEtiqueta(documento, ETIQUETAS_SALARIO) ?? textoSalario(todas));

  // 6/7. Tipo de contrato y periodo de prueba
  const contractType = detectarTipoContrato(todas);
  const trialPeriodDays = extraerPrueba(valorDeEtiqueta(documento, ETIQUETAS_PRUEBA) ?? todas);

  // 8. Forma de pago
  const paymentFrequency: PaymentFrequency = /quincenal|bi-weekly|biweekly/i.test(todas)
    ? 'quincenal'
    : 'mensual';

  // 9. Fechas de inicio y vencimiento
  const inicioTexto = valorDeEtiqueta(documento, ETIQUETAS_INICIO);
  const finTexto = valorDeEtiqueta(documento, ETIQUETAS_FIN);
  const startDate = inicioTexto
    ? normalizarFecha(inicioTexto)
    : buscarFechaCercana(documento, ETIQUETAS_INICIO);
  let endDate = finTexto
    ? normalizarFecha(finTexto)
    : buscarFechaCercana(documento, ETIQUETAS_FIN);

  // 9b. Duracion del contrato: explicita ("por el termino de N meses") o
  // derivada de las fechas de inicio y vencimiento.
  const durationMonths =
    extraerMesesDeTermino(todas) ??
    (startDate && endDate ? mesesEntreFechas(startDate, endDate) : null) ??
    undefined;

  // Si no hay fecha de fin explicita pero hay "por el termino de N meses",
  // se deriva la fecha de fin a partir del inicio (contratos a termino fijo).
  if (!endDate && startDate && contractType === 'termino_fijo') {
    const meses = durationMonths ?? extraerMesesDeTermino(todas);
    if (meses) endDate = sumarMeses(startDate, meses);
  }

  // 10. Lugar de ejecucion y preaviso
  const executionPlace = limpiarValor(valorDeEtiqueta(documento, ETIQUETAS_LUGAR)) ?? '';
  const noticeDays = extraerPreaviso(todas);

  return {
    employerName,
    employerNit,
    employerAddress,
    employerEmail,
    workerName,
    workerDateOfBirth: workerDateOfBirthIso || undefined,
    workerDocumentNumber,
    workerAddress,
    workerEmail,
    position,
    salary,
    currency: 'COP',
    paymentFrequency,
    contractType,
    durationMonths,
    startDate,
    endDate,
    trialPeriodDays,
    noticeDays,
    executionPlace,
    status: 'vigente',
  };
}

/**
 * Resuelve el valor de una etiqueta tolerando el formato tabular de dos
 * columnas que usan los contratos de Rosimar: la etiqueta en la columna
 * izquierda y el valor en la columna derecha del MISMO renglon (o del
 * renglon inmediato de la columna contraria).
 *
 * Orden de intentos: par exacto en la misma linea (`Etiqueta: valor`), valor
 * en el renglon siguiente, emparejamiento por geometria con la columna
 * opuesta y, por ultimo, coincidencia difusa para etiquetas degradadas por el
 * OCR de fotos ("SALARIOI", "EMPLFADOR").
 *
 * `useFuzzy` se desactiva para los pares que difieren entre si en una sola
 * palabra ("domicilio del empleador" frente a "domicilio del trabajador"),
 * donde una etiqueta ruidosa podria llevar el valor del campo contrario.
 */
function valorDeEtiqueta(
  documento: DocumentLayout,
  etiquetas: string[],
  opciones?: { useFuzzy?: boolean }
): string | null {
  const lineas = documento.lines.map((l) => l.text);
  const directo = findLabeledValue(lineas, etiquetas);
  if (directo) return directo;

  // Tabla de dos columnas: la GEOMETRIA va antes que el heuristico de renglon
  // siguiente. Cuando hay columnas, los renglones vienen ordenados columna por
  // columna, asi que "el siguiente" es la etiqueta de la fila de abajo y no el
  // valor: preguntando primero por la contraparte geometrica se acierta.
  const wanted = etiquetas.map(normalize);
  for (const linea of documento.lines) {
    if (linea.column < 0 || !lineaCoincideEtiqueta(linea.text, wanted)) continue;
    const par = buscarContraparte(documento, linea);
    if (par && !lineaCoincideEtiqueta(par.text, wanted)) {
      return par.text;
    }
  }

  // El valor puede ocupar el renglon siguiente a la etiqueta (escaneos que
  // parten el par "CARGO" / "AUXILIAR DE ASEO" en dos lineas).
  const continua = findLabeledValueOrNextLine(lineas, etiquetas, { maxValueWords: 12 });
  if (continua) return continua;

  // Etiqueta degradada por el OCR de fotos de WhatsApp.
  if (opciones?.useFuzzy !== false) {
    const difuso = findLabeledValueFuzzy(lineas, etiquetas);
    if (difuso) return difuso;
  }

  return null;
}

/**
 * Busca la linea compañera de la columna opuesta alineada verticalmente con la
 * etiqueta (mismo renglon de la tabla) o el renglon inmediato de esa misma
 * columna. Devuelve null en documentos de una sola columna o sin contraparte.
 */
function buscarContraparte(documento: DocumentLayout, linea: DocumentLayout['lines'][number]): DocumentLayout['lines'][number] | null {
  const candidatos = documento.lines.filter(
    (l) => l.column === 1 - linea.column && l.page === linea.page && l.text.trim().length > 0
  );
  if (candidatos.length === 0) return null;

  // Mismo renglon de la tabla: el par de la columna opuesta con MAYOR solape
  // real sobre la franja de la etiqueta (un par que solo se toca en el borde
  // pertenece a la fila anterior).
  const desde = linea.y - 3;
  const hasta = linea.y + linea.height + 3;
  const mismoRenglon = candidatos
    .map((l) => ({ l, solape: Math.min(hasta, l.y + l.height) - Math.max(desde, l.y) }))
    .filter((o) => o.solape >= 2)
    .sort((a, b) => b.solape - a.solape)[0];
  if (mismoRenglon) return mismoRenglon.l;

  // Etiqueta en la izquierda y valor en el renglon siguiente abajo a la derecha.
  const debajo = candidatos
    .filter((l) => l.y >= linea.y + linea.height - 2)
    .sort((a, b) => a.y - b.y)[0];
  if (debajo && debajo.y - (linea.y + linea.height) < linea.height * 2.5 + 6) return debajo;

  return null;
}

/**
 * Busca la fecha asociada a una etiqueta cuando el valor cae en un renglon
 * distinto del de la etiqueta (formato tabular / dos columnas). Recorre las
 * lineas en orden de lectura, localiza la linea que contiene la etiqueta y
 * devuelve la primera fecha de esa misma linea o del renglon adyacente de
 * cualquiera de las dos columnas (la etiqueta y su valor pueden vivir en
 * columnas distintas del mismo renglon).
 */
function buscarFechaCercana(documento: DocumentLayout, etiquetas: string[]): string {
  const wanted = etiquetas.map(normalize).filter((e) => e.length >= 3);
  const lines = documento.lines;

  for (let i = 0; i < lines.length; i++) {
    const linea = lines[i];
    if (!lineaCoincideEtiqueta(linea.text, wanted)) continue;

    // Busca la fecha en la misma linea primero.
    const propia = extraerFechaDeLinea(linea.text);
    if (propia) return propia;

    // Si no, en la columna contraria del mismo renglon o en los siguientes
    // renglones (adyacentes en Y, sin importar su columna).
    const contra = buscarContraparte(documento, linea);
    if (contra) {
      const fecha = extraerFechaDeLinea(contra.text);
      if (fecha) return fecha;
    }

    const siguientes = lines.slice(i + 1, i + 4).filter(
      (l) => l.page === linea.page && Math.abs(l.y - linea.y) <= linea.height * 2.5 + 6
    );
    for (const sig of siguientes) {
      const fecha = extraerFechaDeLinea(sig.text);
      if (fecha) return fecha;
      // Deja de buscar si el siguiente renglon ya es otra etiqueta de seccion.
      if (/fecha|vencimiento|iniciaci|finalizaci|terminaci/i.test(sig.text)) break;
    }
  }

  return '';
}

function lineaCoincideEtiqueta(texto: string, wanted: string[]): boolean {
  const norm = normalize(texto);
  return wanted.some((w) => norm.includes(w));
}

function extraerFechaDeLinea(texto: string): string {
  // Prueba primero los formatos textuales espanoles, luego numericos.
  const candidatos = texto.match(
    /(\d{1,2}|primero|primera|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|quince|veinte|treinta)\s+de\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+de\s+\d{4}/i
  );
  if (candidatos) {
    const n = normalizarTextoCompleto(candidatos[0]);
    if (n) return n;
  }
  const numerica = texto.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b/);
  if (numerica) return normalizarFecha(numerica[0]);
  return '';
}

/** Normaliza una fecha en texto espanol completa ("primero de septiembre de 2023"). */
function normalizarTextoCompleto(texto: string): string {
  return normalizarFecha(texto);
}

/** Detecta el tipo de contrato por barrido global, tolerante a ruido. */
function detectarTipoContrato(texto: string): ContractType {
  const lower = texto.toLowerCase();
  if (/indefinid[oa]|indefinite/i.test(lower)) return 'indefinido';
  if (/(?:obra\s+(?:o\s+)?labor|labor\s+contratada)/i.test(lower)) return 'obra_labor';
  if (/aprendizaje|internship|trainee|sena/i.test(lower)) return 'aprendizaje';
  if (/tiempo\s+parcial|part-time|medio\s+tiempo/i.test(lower)) return 'tiempo_parcial';
  return 'termino_fijo';
}

function extraerSalario(texto: string): number {
  // El valor ya puede venir aislado (" $ 1.600.000 COP") o con la etiqueta.
  const match = texto.match(/\$?\s*([0-9][0-9.,\s]{3,15})/);
  if (!match) return 0;
  const numero = match[1].match(/[0-9][0-9.,]{3,14}/);
  if (!numero) return 0;
  const valor = parseInt(numero[0].replace(/[.,\s]/g, ''), 10);
  return !isNaN(valor) && valor > 1000 ? valor : 0;
}

/**
 * Salida de emergencia del salario: localiza un monto precedido por una
 * palabra clave de remuneracion o pago, tolerando conectores tipicos de la
 * redaccion de un contrato ("salario mensual de $ 1.650.000"). Con etiqueta
 * "SALARIO:", no se usa (lo captura el camino etiquetado). Si la palabra
 * clave no aparece, devuelve vacio en lugar de dejar que extraerSalario tome
 * cualquier numero del documento (p. ej. el NIT del empleador).
 */
function textoSalario(todas: string): string {
  const match = todas.match(
    /(?:salario|sueldo|remuneraci[oó]n|asalario|honorarios|pago)\s*(?:mensual|basico|integral|devengado|asignado|convenido)?\s*(?:[:#.-]|\$|de\s+un\s+|por\s+un\s+|de\s+)\s*\$?\s*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{0,2})?)/i
  );
  return match ? match[1] : '';
}

/** Ultimo recurso: numero de cedula en el texto (evita telefonos moviles). */
function buscarCedulaGenerica(texto: string): string | undefined {
  const limpio = texto.replace(/\b(?:telefono|telefonos|celular|movil|whatsapp|contacto)\b/gi, ' ');
  const etiquetada = limpio.match(
    /(?:\bcc\b|cedula|documento(?:\s+de\s+(?:identidad|identificacion))?|identificacion)\s*(?:n[oº°]?\.?|numero)?\s*(\d[\d.\s-]{5,}\d)/i
  );
  if (etiquetada) {
    const digito = etiquetada[1].replace(/[.\s-]/g, '');
    if (digito.length >= 7 && digito.length <= 11) return digito;
  }
  const grupos = limpio.match(/(?<![\d.])\d{8,10}(?![\d.])/g) ?? [];
  const candidata = grupos.find((n) => !n.startsWith('3'));
  return candidata ? candidata : undefined;
}

/**
 * Ultimo recurso del cargo: la redaccion tipica del contrato colombiano
 * "El trabajador se obliga a desempeñar el cargo de: AUXILIAR DE ASEO".
 */
function extraerCargoDeProsa(texto: string): string | undefined {
  const match = texto.match(
    /(?:el\s+cargo\s+(?:de|a\s+desempe[nñ]ar|asignado)|cargo\s+(?:asignado|designado|a\s+ocupar))\s*:?\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ][^,;.\n]{2,60})/i
  );
  if (!match) return undefined;
  const cargo = match[1].trim().replace(/\s+/g, ' ');
  return cargo.length >= 2 ? cargo : undefined;
}

function extraerPrueba(texto: string): number {
  const match = texto.match(/(\d{1,3})\s*(d[ií]as?|meses?|days?|months?|m)/i);
  if (!match) return 0;
  const num = parseInt(match[1], 10);
  if (isNaN(num)) return 0;
  const sufijo = match[2].toLowerCase();
  const meses = /mes|month/.test(sufijo);
  return meses ? num * 30 : num;
}

/** Extrae el preaviso del contrato (si no se menciona, 30 por defecto RP-3). */
function extraerPreaviso(texto: string): number {
  const match = texto.match(/(?:preaviso|aviso\s+previo|notice)\s*[:#.-]?\s*(\d{1,3})\s*(?:d[ií]as)?/i);
  if (match) {
    const n = parseInt(match[1], 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return 30;
}

/** Detecta "por el termino de N meses" para derivar la fecha de fin. */
function extraerMesesDeTermino(texto: string): number | null {
  const match = texto.match(/termino\s+de\s+(\d{1,3})\s*(?:meses|mes|month|months)/i);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return !isNaN(n) && n > 0 && n <= 120 ? n : null;
}

/** Suma N meses a una fecha ISO (YYYY-MM-DD) y devuelve la fecha resultante. */
function sumarMeses(iso: string, meses: number): string {
  const partes = iso.split('-').map(Number);
  if (partes.length !== 3 || partes.some(isNaN)) return '';
  const fecha = new Date(partes[0], partes[1] - 1, partes[2]);
  fecha.setMonth(fecha.getMonth() + meses);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(
    fecha.getDate()
  ).padStart(2, '0')}`;
}

/**
 * Normaliza una fecha a ISO `YYYY-MM-DD`, soportando:
 *   - DD/MM/YYYY o DD-MM-YYYY (yaño de 2 digitos asume 20xx)
 *   - YYYY/MM/DD o YYYY-MM-DD
 *   - "1 de septiembre de 2023"
 *   - "primero de septiembre de 2023"
 * Devuelve '' si no reconoce el formato o la fecha es invalida.
 */
export function normalizarFecha(valor: string): string {
  if (!valor) return '';

  // DD/MM/YYYY o DD-MM-YYYY (o YYYY/MM/DD). En Colombia el formato habitual
  // es DD/MM/AAAA, asi que el primer numero es dia y el segundo mes.
  const ddmm = valor.match(/\b(\d{1,2})\s*[/-]\s*(\d{1,2})\s*[/-]\s*(\d{2,4})\b/);
  if (ddmm) {
    let y = Number(ddmm[3]);
    if (ddmm[3].length === 2) y += 2000;
    const m = Number(ddmm[2]);
    const d = Number(ddmm[1]);
    if (mesValido(m) && diaValido(d, m, y)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // YYYY/MM/DD o YYYY-MM-DD (solo cuando el bloque de 4 digitos va primero).
  const ymd = valor.match(/\b(\d{4})\s*[/-]\s*(\d{1,2})\s*[/-]\s*(\d{1,2})\b/);
  if (ymd) {
    const y = Number(ymd[1]);
    const m = Number(ymd[2]);
    const d = Number(ymd[3]);
    if (mesValido(m) && diaValido(d, m, y)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // "primero de septiembre de 2023" / "1 de septiembre de 2023"
  const textual = valor.match(
    /(\d{1,2}|primero|primera|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|quince|veinte|treinta)\s+de\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})/i
  );
  if (textual) {
    const dia = numeroEnTexto(textual[1]);
    const mes = indiceMes(textual[2]);
    const y = Number(textual[3]);
    if (dia && mes && diaValido(dia, mes, y)) {
      return `${y}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    }
  }

  return '';
}

// Reciben numeros: quien las llama ya convirtio el texto con Number().
function mesValido(m: number): boolean {
  return !isNaN(m) && m >= 1 && m <= 12;
}
function diaValido(d: number, m: number, y: number): boolean {
  if (isNaN(d) || d < 1 || d > 31) return false;
  const maxDias = new Date(y, m, 0).getDate();
  return d <= maxDias;
}

function numeroEnTexto(palabra: string): number | null {
  const mapa: Record<string, number> = {
    primero: 1, primera: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
    seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
    trece: 13, catorce: 14, quince: 15, veinte: 20, veintiuno: 21, veintidos: 22,
    veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27,
    veintiocho: 28, veintinueve: 29, treinta: 30, treinta_y_uno: 31,
  };
  if (/^\d+$/.test(palabra)) {
    const n = Number(palabra);
    return n >= 1 && n <= 31 ? n : null;
  }
  const clave = normalizeSinAcentos(palabra);
  return mapa[clave] ?? null;
}

function indiceMes(nombre: string): number | null {
  const mapa: Record<string, number> = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
    noviembre: 11, diciembre: 12,
  };
  return mapa[normalizeSinAcentos(nombre)] ?? null;
}

function normalizeSinAcentos(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function limpiarValor(valor: string | null): string | undefined {
  if (!valor) return undefined;
  const limpio = valor.replace(/[\s|•*]+$/g, '').trim();
  return limpio.length >= 2 ? limpio : undefined;
}

function limpiarNit(valor: string | null): string | undefined {
  if (!valor) return undefined;
  // Conserva el formato del NIT (p. ej. 900.123.456-7) quitando solo el ruido
  // que pueda traer al final del valor etiquetado.
  return valor.replace(/[\s|•*]+$/g, '').trim();
}

/** Extrae una direccion de correo del valor etiquetado (null si no hay correo). */
function extraerCorreo(valor: string | null): string | null {
  if (!valor) return null;
  const match = valor.match(/[\w.+-]+@[\w.-]+\.\w{2,}/i);
  if (match) return match[0];
  return valor.trim().includes('@') ? valor.trim() : null;
}

/** Cantidad de meses completos entre dos fechas ISO (minimo 1 si hay espacios). */
function mesesEntreFechas(inicio: string, fin: string): number | null {
  const desde = inicio.split('-').map(Number);
  const hasta = fin.split('-').map(Number);
  if (desde.length !== 3 || hasta.length !== 3 || desde.some(isNaN) || hasta.some(isNaN)) {
    return null;
  }
  const meses = (hasta[0] - desde[0]) * 12 + (hasta[1] - desde[1]);
  if (meses < 1) return null;
  // "2024-02-01" a "2025-01-31" es un anio completo: el dia de fin iguala o
  // supera el dia de inicio.
  return hasta[2] >= desde[2] ? meses + 1 : meses;
}
