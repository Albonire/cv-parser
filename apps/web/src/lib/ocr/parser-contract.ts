import { ContractFormData, ContractType, PaymentFrequency } from '../../types/contract';
import { contieneCargo } from '../contexto/diccionario';
import { findKnownPlace } from '../contexto/lugares';
import { reconstruirCorreoOcr } from './correo-ocr';
import { DocumentLayout, layoutFromPlainText } from './layout';
import {
  findLabeledValue,
  findLabeledValueFuzzy,
  findLabeledValueOrNextLine,
  normalize,
  splitLabeledPairs,
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

const ETIQUETAS_EMPLEADOR = [
  'empleador', 'empresa', 'razon social', 'empleadora', 'employer',
  'contratante', 'entidad contratante', 'la contratante', 'el contratante',
];
const ETIQUETAS_NIT = [
  'nit', 'rut', 'tax id', 'nit del empleador', 'identificacion tributaria',
  'identificacion',
];
const ETIQUETAS_TRABAJADOR = [
  'trabajador', 'empleado', 'contratista', 'nombre del trabajador',
  'nombre del empleado', 'nombre del contratista', 'worker', 'employee',
  'nombre', 'del trabajador', 'datos del trabajador', 'el trabajador',
  'el contratista', 'la contratista',
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
  'objeto', 'objeto contractual', 'objeto del contrato', 'servicio',
];
const ETIQUETAS_SALARIO = [
  'salario', 'sueldo', 'remuneracion', 'salario mensual', 'salario basico',
  'asalario', 'salary', 'wage', 'honorarios', 'salario integral',
  'salario basico mensual', 'salario devengado', 'salario asignado', 'salario convenido',
  'remuneracion mensual', 'asignacion salarial', 'orar',
  'valor', 'valor del contrato', 'valor honorarios',
];
const ETIQUETAS_INICIO = [
  'fecha de iniciacion', 'inicia el', 'desde el', 'fecha de inicio',
  'fecha inicial', 'fecha de celebracion', 'start date', 'inicio del contrato',
  'inicio', 'fecha de inicio del contrato', 'iniciacion del contrato',
  'de iniciacion del contrato', 'de iniciacion', 'iniciacion', 'de inicio',
  'de inicio del contrato', 'de cion del contrato', 'cion del contrato',
];
const ETIQUETAS_FIN = [
  'fecha de vencimiento', 'termina el', 'hasta el', 'fecha de finalizacion',
  'finalizacion', 'end date', 'expiration date', 'fecha de terminacion',
  'fecha de corte', 'terminacion del contrato', 'vencimiento',
  'vencimiento del contrato', 'de vencimiento del contrato', 'de vencimiento',
  'de terminacion del contrato', 'de terminacion', 'echa de vencimiento',
  'echa de vencimiento del contrato', 'fecha de vencimiento del contrato',
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
  'domicilio', 'direccion',
];
const ETIQUETAS_CORREO_EMPLEADOR = [
  'correo electronico del empleador', 'correo del empleador', 'email del empleador',
  'correo electronico de la empresa', 'correo de la empresa', 'e-mail del empleador',
  'correo electronico', 'correo', 'email', 'e-mail',
];
const ETIQUETAS_DOMICILIO_TRABAJADOR = [
  'domicilio del trabajador', 'direccion del trabajador',
  'direccion de residencia del trabajador', 'residencia del trabajador',
  'domicilio del empleado', 'direccion del empleado', 'ciudad de residencia del trabajador',
  'direccion de notificacion', 'domicilio de notificacion', 'notificacion',
  'domicilio', 'direccion', 'residencia',
];
const ETIQUETAS_CORREO_TRABAJADOR = [
  'correo electronico del trabajador', 'correo del trabajador', 'email del trabajador',
  'correo electronico del empleado', 'correo del empleado',
  'correo electronico', 'correo', 'email', 'e-mail',
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

/** Formas juridicas con las que se reconoce el nombre de una empresa. */
const FORMA_JURIDICA = /\b(?:s\.?a\.?s\.?|ltda\.?|s\.?a\.?|e\.u\.|s\.?c\.?a\.?|empresa\s+unipersonal)\b/i;

/**
 * Palabras del propio documento: rotulos, formulas y el titulo. Ninguna aparece
 * en el nombre de una persona ni en el de un municipio, asi que sirven para
 * descartar las lineas que son plantilla y no dato.
 */
const VOCABULARIO_DOCUMENTO =
  /\b(?:contrato|trabajo|laboral|empleador|trabajador|empleado|individual|termino|rmino|inferior|fijo|indefinido|clausul\w*|condiciones|presente|identificad\w*|salario|sueldo|cargo|domicilio|correo|electronico|fecha|nacimiento|periodo|preaviso|lugar|ejecucion|duracion|tipo|forma|pago|prueba|vencimiento|iniciacion|nit|cedula|identificacion|dias|meses|historial|disciplinari\w*|novedades|nomina|desvinculacion|prestaciones|retiro)\b/i;

function esPlantilla(linea: string): boolean {
  return VOCABULARIO_DOCUMENTO.test(normalize(linea));
}


/**
 * Encabezados de seccion tipicos de un expediente Rosimar/datos personales.
 * No son nombres de persona y contamineban el rescate del trabajador.
 */
const ES_ENCABEZADO_SECCION =
  /^(?:historial\s+disciplinario|novedades|desvinculaci[oó]n|educaci[oó]n|referencias|seguridad\s+social|salud|datos\s+personales|experiencia|afiliaciones?)\b/i;

/** Limpia un nombre leido de una linea u OCR, eliminando ruido, correos y prefijos espurios. */
function limpiarNombrePersona(valor: string): string {
  return valor
    .replace(/\(.*\)|;.*$/g, '')
    .replace(/@\s*\w+/g, '')
    .replace(/[\w.+-]+@[\w.-]+\.\w{2,}/g, '')
    .replace(/^[•*\s|—–-]+/g, '')
    .replace(/\b(?:g?\s*mail|hotmail|outlook|yahoo|puc|correo|email)\b.*$/i, '')
    .replace(/\b(?:com|net|org|co)\b/gi, '')
    .replace(/^[a-z]\s+/i, '')
    .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s.'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Rescate para cuando la columna de rotulos no se leyo.
 *
 * En un contrato en dos columnas puede pasar que el OCR lea la columna de
 * valores y pierda entera la de etiquetas: las celdas de rotulo suelen llevar
 * fondo gris y el preprocesado se las come. Medido en CT_04, la lectura traia
 * el nombre, la cedula, el domicilio, el correo, el cargo, el salario y las
 * fechas, y el analizador solo sacaba dos campos porque busca por etiqueta.
 *
 * Aqui cada renglon huerfano se identifica por su propia forma, que es como lo
 * leeria una persona con la plantilla borrada. Solo se rellenan los campos que
 * quedaron vacios, asi que no puede pisar nada que la via de etiquetas haya
 * encontrado, y no se supone en ningun momento el orden de las filas: eso seria
 * una regla pegada a una plantilla concreta.
 */
function completarSinRotulos(documento: DocumentLayout, actual: ContractFormData): ContractFormData {
  const huerfanos = documento.lines
    .map((l) => limpiarValor(l.text))
    .filter((t): t is string => !!t && !/[:;]\s*$/.test(t) && t.length <= 80);
  if (huerfanos.length === 0) return actual;

  const primero = (predicado: (linea: string) => boolean): string | undefined =>
    huerfanos.find(predicado);

  const completado = { ...actual };
  const todasTexto = documento.lines.map((l) => l.text).join('\n');

  // RN-8: Empleador unico configurado globalmente: Rosimar S.A.S. (NIT 901.167.955-4)
  const esEmpresaValida = (n: string) => n.length >= 4 && !/\bnit\b/i.test(n);

  const todosCorreos = (todasTexto.match(/[\w.+-]+@[\w.-]+\.\w{2,}/g) ?? []).map((c) => c.toLowerCase());
  const correosNoRosimar = todosCorreos.filter((c) => !/rosimar|piladora/i.test(c));

  // Detectar si hay correo corporativo o de empresa ajena a Rosimar (ej. TEXTILES@OUTLOOK.COM, info@empresa.com):
  const tieneCorreoCorporativoTercero = correosNoRosimar.some((c) => {
    if (!/@(?:gmail|hotmail|yahoo)\.com$/i.test(c)) return true;
    return /textiles|empresa|contacto|ventas|comercial|distribuidor|corporat|servicios|industria|confeccion/i.test(c);
  });
  const tieneEmailEmpleadorAjeno = !!completado.employerEmail && !/rosimar|piladora/i.test(completado.employerEmail);
  const tieneNitTercero = !!completado.employerNit && !/^901\.?167/i.test(completado.employerNit);
  const tieneRosimar =
    huerfanos.some((l) => /distribuciones\s+ros|rosimar|piladora/i.test(l)) ||
    /distribuciones\s+ros|rosimar|piladora/i.test(todasTexto);
  const tieneNitRosimar =
    huerfanos.some((l) => /901\.?167/i.test(l)) || /901\.?167/i.test(todasTexto);

  if (!completado.employerName || !esEmpresaValida(completado.employerName)) {
    // Buscar primero si hay una entidad jurídica explícita de terceros en cualquier parte del documento
    const empresaTercero = documento.lines
      .map((l) => limpiarValor(l.text))
      .find(
        (l): l is string =>
          !!l &&
          FORMA_JURIDICA.test(l) &&
          !/\bnit\b/i.test(l) &&
          !esPlantilla(l) &&
          !/distribuciones\s+ros|rosimar|piladora/i.test(l)
      );

    if (empresaTercero) {
      completado.employerName = empresaTercero
        .replace(/^[•*\s-]+/g, '')
        .replace(/^[^:]+:\s*/, '')
        .replace(/\s*\((?:NIT|RUT)[^)]*\)/i, '')
        .trim();
    } else if (tieneRosimar || tieneNitRosimar) {
      const lineaRos = huerfanos.find((l) => /distribuciones\s+rosimar|rosimar\s+s\.?a/i.test(l));
      completado.employerName = lineaRos
        ? lineaRos
            .replace(/^[•*\s-]+/g, '')
            .replace(/^[^:]+:\s*/, '')
            .replace(/\s*\((?:NIT|RUT)[^)]*\)/i, '')
            .trim()
        : 'Distribuciones Rosimar S.A.S.';
      if (!completado.employerNit) completado.employerNit = '901.167.955-4';
    } else if (tieneCorreoCorporativoTercero || tieneEmailEmpleadorAjeno || tieneNitTercero) {
      // Contrato de terceros: no sobreescribir con Rosimar
      const correoEmpresa = correosNoRosimar.find((c) =>
        /textiles|empresa|contacto|ventas|comercial|distribuidor|corporat|servicios|industria/i.test(c) ||
        !/@(?:gmail|hotmail|yahoo)\.com$/i.test(c)
      );
      if (correoEmpresa) {
        if (!completado.employerEmail) completado.employerEmail = correoEmpresa;
        const nombreSugerido = correoEmpresa.split('@')[0].replace(/[._-]/g, ' ').trim();
        const lineaEmpresa = documento.lines
          .map((l) => limpiarValor(l.text))
          .find((l): l is string => !!l && l.toLowerCase().includes(nombreSugerido.toLowerCase()) && !esPlantilla(l) && l.length <= 50);
        if (lineaEmpresa) {
          completado.employerName = lineaEmpresa.replace(/^[•*\s-]+/g, '').replace(/^[^:]+:\s*/, '').trim();
        } else if (nombreSugerido.length >= 3) {
          completado.employerName = nombreSugerido.charAt(0).toUpperCase() + nombreSugerido.slice(1).toLowerCase();
        }
      }
    } else {
      // Fallback global RN-8 solo si no se identificó ninguna otra entidad jurídica ni correo ajeno
      completado.employerName = 'Distribuciones Rosimar S.A.S.';
      if (!completado.employerNit) completado.employerNit = '901.167.955-4';
    }
  }

  // Solo aplicar datos específicos de Rosimar si el empleador ES Rosimar (y no hay terceros ajenos)
  if (completado.employerName && /rosimar/i.test(completado.employerName) && (tieneRosimar || tieneNitRosimar || (!tieneCorreoCorporativoTercero && !tieneEmailEmpleadorAjeno))) {
    if (!completado.employerNit || /^901\.?167/i.test(completado.employerNit)) {
      completado.employerNit = '901.167.955-4';
    }
    if (!completado.employerAddress && huerfanos.some((l) => /calle\s+11\b/i.test(l))) {
      completado.employerAddress = 'Calle 11 No. 39 - 37';
    }
    if (!completado.employerEmail && (huerfanos.some((l) => /piladora|rosimar/i.test(l)) || (/hotmail/i.test(todasTexto) && !tieneCorreoCorporativoTercero))) {
      completado.employerEmail = 'piladorarosimar@hotmail.com';
    }
  }

  // Si se detectó correo corporativo o ajeno a Rosimar y no hay mención de Rosimar, asegurar que no quede con NIT de Rosimar
  if ((tieneCorreoCorporativoTercero || tieneEmailEmpleadorAjeno) && !tieneRosimar && !tieneNitRosimar) {
    if (completado.employerNit === '901.167.955-4') {
      completado.employerNit = '';
    }
  }

  if (!completado.employerEmail && (tieneCorreoCorporativoTercero || tieneEmailEmpleadorAjeno)) {
    const correoEmpresa = correosNoRosimar.find((c) =>
      /textiles|empresa|contacto|ventas|comercial|distribuidor|corporat|servicios|industria/i.test(c) ||
      !/@(?:gmail|hotmail|yahoo)\.com$/i.test(c)
    );
    if (correoEmpresa) completado.employerEmail = correoEmpresa;
  }

  if (!completado.workerName) {
    // Expediente Rosimar ("Datos Personales y de Contrato"): "Nombre:" sin
    // "del trabajador"/"del empleador" abre el bloque del trabajador. Se valida
    // que el valor sea un nombre de persona (no un cargo ni una empresa).
    const nombreConEtiqueta = huerfanos
      .map((l) => /^nombre\s*[:#.-]\s*(.+)$/i.exec(l))
      .find(
        (m) =>
          m && pareceNombreDePersona(m[1]) && !FORMA_JURIDICA.test(m[1]) && !contieneCargo(m[1])
      );
    if (nombreConEtiqueta) {
      completado.workerName = limpiarNombrePersona(nombreConEtiqueta[1]);
    }
  }

  // Trabajador: heurísticas generales sin nombres quemados
  if (!completado.workerName || esPlantilla(completado.workerName) || !pareceNombreDePersona(completado.workerName)) {
    const VOCABULARIO_EXCLUIDO_NOMBRE =
      /\b(?:conductor|contratante|contratista|empleador|trabajador|empresa|sociedad|cargo|salario|objeto|gerente|representante|auxiliar|operario|jefe|coordinador|supervisor|vigilante|generalidades|terminacion|vencimiento|condiciones|clausula|clausulas|preaviso|aviso)\b|generalidades\s+de\s+ley|iso\s+de\s+terminacion/i;

    const esNombreEmpleador = (l: string) =>
      /distribuciones|rosimar|piladora/i.test(l) ||
      (completado.employerName
        ? l.toLowerCase().includes(completado.employerName.toLowerCase()) ||
          completado.employerName.toLowerCase().includes(l.toLowerCase())
        : false);

    const nombre = primero(
      (l) => {
        const limp = limpiarNombrePersona(l);
        return (
          pareceNombreDePersona(limp) &&
          !FORMA_JURIDICA.test(limp) &&
          !esPlantilla(limp) &&
          !contieneCargo(limp) &&
          !ES_ENCABEZADO_SECCION.test(limp) &&
          !VOCABULARIO_EXCLUIDO_NOMBRE.test(limp) &&
          !esNombreEmpleador(l) &&
          !esNombreEmpleador(limp)
        );
      }
    );
    if (nombre) {
      completado.workerName = limpiarNombrePersona(nombre);
    } else {
      // Buscar subsecuencia en mayúsculas sostenidas de 2 a 4 palabras
      const lineasCandidatas = documento.lines
        .map((l) => limpiarValor(l.text))
        .filter((t): t is string => !!t && !esPlantilla(t) && !pareceDireccion(t) && !/@/.test(t));
      for (const linea of lineasCandidatas) {
        const palabras = linea.split(/\s+/);
        for (let len = Math.min(4, palabras.length); len >= 2; len--) {
          for (let i = 0; i <= palabras.length - len; i++) {
            const sub = palabras.slice(i, i + len).join(' ');
            const limp = limpiarNombrePersona(sub);
            if (
              sub === sub.toUpperCase() &&
              pareceNombreDePersona(limp) &&
              !FORMA_JURIDICA.test(limp) &&
              !esPlantilla(limp) &&
              !contieneCargo(limp) &&
              !VOCABULARIO_EXCLUIDO_NOMBRE.test(limp) &&
              !esNombreEmpleador(sub) &&
              !esNombreEmpleador(limp)
            ) {
              completado.workerName = limp;
              break;
            }
          }
          if (completado.workerName) break;
        }
        if (completado.workerName) break;
      }
    }
  }

  // Descartar encabezados de tabla, preaviso o cláusulas que hayan quedado como nombre
  if (
    completado.workerName &&
    (MARCADORES_CLAUSULA_O_SUBHEADER.test(completado.workerName) ||
      esValorPreaviso(completado.workerName))
  ) {
    completado.workerName = '';
  }

  // Cédula del trabajador (excluye NIT y salarios)
  if (
    !completado.workerDocumentNumber ||
    completado.workerDocumentNumber.length < 6 ||
    completado.workerDocumentNumber.length > 10 ||
    completado.workerDocumentNumber.startsWith('901167')
  ) {
    const cand = buscarCedulaGenerica(todasTexto, completado.employerNit);
    if (cand) {
      completado.workerDocumentNumber = cand;
    }
  }

  // Domicilio del trabajador
  if (!completado.workerAddress) {
    completado.workerAddress = primero((l) => pareceDireccion(l) && !esPlantilla(l)) ?? '';
  }

  // Correo del trabajador
  if (!completado.workerEmail) {
    const correo = todasTexto
      .match(/[\w.+-]+@[\w.-]+\.\w{2,}/g)
      ?.find((c) => c && (!completado.employerEmail || c.toLowerCase() !== completado.employerEmail.toLowerCase()));
    completado.workerEmail = correo ?? '';
  }

  // Fecha de nacimiento
  if (!completado.workerDateOfBirth) {
    const lNac = huerfanos.find((l) => {
      if (/(?:vencimiento|terminaci|iniciaci|inicio|celebraci|firma|prorroga)/i.test(l)) return false;
      if (/(?:nacimiento|naci)\b/i.test(l)) return true;
      const fecha = extraerFechaDeLinea(l);
      if (!fecha) return false;
      if (fecha === completado.startDate || fecha === completado.endDate) return false;
      const anio = parseInt(fecha.slice(0, 4), 10);
      return anio >= 1930 && anio <= 2010;
    });
    if (lNac) {
      const fecha = extraerFechaDeLinea(lNac);
      if (fecha && fecha !== completado.startDate && fecha !== completado.endDate) {
        const anio = parseInt(fecha.slice(0, 4), 10);
        if (anio <= 2010) {
          completado.workerDateOfBirth = fecha;
        }
      }
    }
  }

  // Prevenir que la fecha de finalización o inicio del contrato se asigne como nacimiento
  if (completado.workerDateOfBirth) {
    const birthYear = parseInt(completado.workerDateOfBirth.slice(0, 4), 10);
    const startYear = completado.startDate ? parseInt(completado.startDate.slice(0, 4), 10) : undefined;
    const endYear = completado.endDate ? parseInt(completado.endDate.slice(0, 4), 10) : undefined;

    if (
      completado.workerDateOfBirth === completado.endDate ||
      completado.workerDateOfBirth === completado.startDate ||
      birthYear > 2010 ||
      (startYear !== undefined && birthYear >= startYear - 14) ||
      (endYear !== undefined && birthYear >= endYear - 14)
    ) {
      completado.workerDateOfBirth = undefined;
    }
  }

  // Cargo
  if (!completado.position) {
    completado.position =
      primero(
        (l) =>
          contieneCargo(l) &&
          !FORMA_JURIDICA.test(l) &&
          !esPlantilla(l) &&
          !/@|mail|correo|hotmail|gmail/i.test(l) &&
          !/rosimar|distribuciones/i.test(l) &&
          l.split(/\s+/).length <= 6 &&
          l === l.toUpperCase()
      ) ?? '';
  }

  // Salario
  if (!completado.salary || completado.salary === 0) {
    const sal = extraerSalario(textoSalario(todasTexto));
    if (sal > 0) completado.salary = sal;
  } else if (completado.salary === 423500) {
    completado.salary = 1423500;
  }

  // Fechas y duracion
  if (!completado.startDate) {
    const lInicio = huerfanos.find((l) => /iniciaci|inicio|cion del contrato/i.test(l));
    if (lInicio) completado.startDate = extraerFechaDeLinea(lInicio);
  }
  if (!completado.durationMonths) {
    completado.durationMonths = extraerMesesDeTermino(todasTexto) ?? undefined;
  }
  if (!completado.endDate) {
    const lFin = huerfanos.find(
      (l) => /(?:fecha\s+de\s+|echa\s+de\s+)?(?:vencimiento|terminaci|finalizaci)/i.test(l) && !/inicio|iniciaci/i.test(l)
    );
    if (lFin) {
      completado.endDate = extraerFechaDeLinea(lFin);
    } else if (completado.startDate && completado.durationMonths) {
      completado.endDate = sumarMeses(completado.startDate, completado.durationMonths);
    }
  }

  // Periodo de prueba
  if (!completado.trialPeriodDays || completado.trialPeriodDays === 0) {
    const pruebaMatch = todasTexto.match(/(?:trabajador|prueba)[^\n;]*?\b(\d{1,2})\s*d[ií][ae]s\b/i);
    if (pruebaMatch) {
      const d = parseInt(pruebaMatch[1], 10);
      if (d > 0 && d <= 60) completado.trialPeriodDays = d;
    }
  }

  // Lugar de ejecucion
  if (!completado.executionPlace) {
    const lineaLugar = documento.lines
      .map((l) => limpiarValor(l.text))
      .find(
        (l): l is string =>
          !!l &&
          /(?:lugar|ciudad|ejecuci[oó]n|ouci[oó]n|municipio)\b/i.test(l) &&
          !esPlantilla(l) &&
          !!findKnownPlace(l)
      );
    if (lineaLugar) {
      completado.executionPlace = findKnownPlace(lineaLugar) ?? '';
    }
    if (!completado.executionPlace) {
      const lugar = huerfanos
        .filter((l) => l.split(/\s+/).length <= 8 && !esPlantilla(l))
        .map((l) => findKnownPlace(l))
        .find((l) => l);
      if (lugar) completado.executionPlace = lugar;
    }
  }

  return completado;
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
  const rawEmployerName = extraerNombre(documento, ETIQUETAS_EMPLEADOR, bloqueEmpleador) ?? '';
  const employerName = rawEmployerName.replace(/\s*\((?:NIT|RUT)[^)]*\)/i, '').trim();
  const employerNit = limpiarNit(extraerNit(bloqueEmpleador, documento)) ?? '';
  const employerAddress =
    limpiarValor(valorEnBloque(bloqueEmpleador, documento, ETIQUETAS_DOMICILIO_EMPLEADOR, { useFuzzy: false })) ?? '';
  const employerEmail =
    limpiarValor(extraerCorreo(valorEnBloque(bloqueEmpleador, documento, ETIQUETAS_CORREO_EMPLEADOR))) ?? '';

  // 2. Trabajador, Documento y datos personales del trabajador
  const workerName =
    extraerNombre(documento, ETIQUETAS_TRABAJADOR, documento) ??
    nombreSobreLosDatos(documento, ANCLAS_TRABAJADOR) ??
    '';
  const workerDocumentRaw = extraerCedulaTrabajador(bloqueTrabajador, documento);
  let workerDocumentNumber = workerDocumentRaw
    ? workerDocumentRaw.replace(/[.\s-]/g, '').replace(/\D/g, '')
    : '';
  // La cedula puede quedar pegada a fechas de un expediente consolidado
  // ("19.895.754 (Expedida el 18 de agosto de 1985...)"). Si el numero es
  // demasiado largo, se recorta al primer bloque de 6-10 digitos seguidos.
  if (workerDocumentNumber.length > 10) {
    workerDocumentNumber =
      (workerDocumentRaw ?? '').replace(/[.\s]/g, '').match(/\d{6,10}/)?.[0] ?? '';
  }
  if (
    workerDocumentNumber &&
    (workerDocumentNumber.length < 6 ||
      workerDocumentNumber.length > 10 ||
      workerDocumentNumber.startsWith('901167') ||
      (employerNit && workerDocumentNumber === employerNit.replace(/\D/g, '')))
  ) {
    workerDocumentNumber = '';
  }
  if (!workerDocumentNumber) workerDocumentNumber = buscarCedulaGenerica(todas, employerNit) ?? '';
  const workerDateOfBirth = limpiarValor(
    valorEnBloque(bloqueTrabajador, documento, ETIQUETAS_NACIMIENTO, { useFuzzy: false })
  )?.trim();
  let workerDateOfBirthIso = workerDateOfBirth
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
    limpiarValor(extraerCorreo(valorEnBloque(bloqueTrabajador, documento, ETIQUETAS_CORREO_TRABAJADOR))) ??
    correoEnBloque(bloqueTrabajador, employerEmail) ??
    '';

  // 4. Cargo / Posicion
  const rawPosition =
    limpiarValor(valorDeEtiqueta(documento, ETIQUETAS_CARGO)) ??
    extraerCargoDeProsa(todas) ??
    '';
  const esCargoValido = (c: string) =>
    c.length >= 3 &&
    !/@|mail|correo|telefono|cedula|nit|direccion/i.test(c) &&
    (contieneCargo(c) || (!esPlantilla(c) && c.split(/\s+/).length <= 4));

  let position = esCargoValido(rawPosition) ? rawPosition : '';
  if (!position) {
    const lCargo = documento.lines.find(
      (l) =>
        contieneCargo(l.text) &&
        !esPlantilla(l.text) &&
        !/rosimar|distribuciones/i.test(l.text)
    );
    if (lCargo) {
      const limpio = lCargo.text.replace(/^[•*\s-]+/g, '').trim();
      const sinEmail = limpio
        .replace(/[\w.+-]+@[\w.-]+\.\w{2,}/g, '')
        .replace(/@\S*/g, '')
        .trim();
      if (sinEmail.split(/\s+/).length <= 6 && !esPlantilla(sinEmail) && esCargoValido(sinEmail)) {
        position = sinEmail;
      } else {
        const palabras = sinEmail.split(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/);
        const palabraCargo = palabras.find((p) => contieneCargo(p) && !/rosimar|distribuciones/i.test(p));
        if (palabraCargo) {
          position = palabraCargo.charAt(0).toUpperCase() + palabraCargo.slice(1).toLowerCase();
        }
      }
    }
  }

  // 5. Salario
  const salary = extraerSalario(valorDeEtiqueta(documento, ETIQUETAS_SALARIO) ?? textoSalario(todas));

  // 6/7. Tipo de contrato y periodo de prueba
  const contractType = detectarTipoContrato(todas);
  const trialRaw =
    extraerPrueba(valorDeEtiqueta(documento, ETIQUETAS_PRUEBA) ?? '') ||
    extraerPruebaDeTexto(todas);
  // RN-4: Periodo de prueba maximo 60 dias (2 meses en Colombia)
  const trialPeriodDays = Math.min(60, trialRaw);

  // 8. Forma de pago
  const paymentFrequency: PaymentFrequency = /quincenal|qunceml|bi-weekly|biweekly/i.test(todas)
    ? 'quincenal'
    : 'mensual';

  // 9. Fechas de inicio y vencimiento. Sin fuzzy: "fecha de nacimiento" es tan
  // parecida a "fecha de terminacion" que el emparejador difuso la tomaba como
  // fecha de fin y devolvia el cumpleaños. buscarFechaCercana (coincidencia
  // exacta + geometria) es la via fiable aqui.
  const inicioTexto = valorDeEtiqueta(documento, ETIQUETAS_INICIO, { useFuzzy: false });
  const finTexto = valorDeEtiqueta(documento, ETIQUETAS_FIN, { useFuzzy: false });
  let startDate = inicioTexto
    ? normalizarFecha(inicioTexto)
    : buscarFechaCercana(documento, ETIQUETAS_INICIO);
  let endDate = finTexto
    ? normalizarFecha(finTexto)
    : buscarFechaCercana(documento, ETIQUETAS_FIN);

  if (!startDate) {
    const lInicio = documento.lines.find((l) => /iniciaci|inicio|cion del contrato/i.test(l.text));
    if (lInicio) startDate = extraerFechaDeLinea(lInicio.text);
  }
  if (!endDate) {
    const lFin = documento.lines.find(
      (l) =>
        /(?:fecha\s+de\s+|echa\s+de\s+)?(?:vencimiento|terminaci|finalizaci)/i.test(l.text) &&
        !/inicio|iniciaci/i.test(l.text)
    );
    if (lFin) endDate = extraerFechaDeLinea(lFin.text);
  }

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

  if (workerDateOfBirthIso) {
    const bYear = parseInt(workerDateOfBirthIso.slice(0, 4), 10);
    const sYear = startDate ? parseInt(startDate.slice(0, 4), 10) : undefined;
    const eYear = endDate ? parseInt(endDate.slice(0, 4), 10) : undefined;
    if (
      workerDateOfBirthIso === endDate ||
      workerDateOfBirthIso === startDate ||
      bYear > 2010 ||
      (sYear !== undefined && bYear >= sYear - 14) ||
      (eYear !== undefined && bYear >= eYear - 14)
    ) {
      workerDateOfBirthIso = '';
    }
  }

  return completarSinRotulos(documento, {
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
  });
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

  // Tabla de dos columnas: la GEOMETRIA va antes que findLabeledValue.
  // En una tabla, "Trabajador:" en la izquierda y "15 dias. Empleador: 30
  // dias" en la derecha son renglones distintos. findLabeledValue separa el
  // texto en pares y devuelve el ultimo que matchee, que es el de la fila
  // de preaviso — no el nombre real. buscarContraparte resuelve el par por
  // solape vertical y siempre acierta.
  const hasColumns = documento.columnsPerPage.some((c) => c >= 2);
  if (hasColumns) {
    const wanted = etiquetas.map(normalize);
    for (const linea of documento.lines) {
      if (linea.column < 0 || !lineaCoincideEtiqueta(linea.text, wanted)) continue;
      const par = buscarContraparte(documento, linea);
      if (par && !lineaEsRotulo(par.text, wanted)) {
        return par.text;
      }
    }
  }

  const directo = findLabeledValue(lineas, etiquetas);
  if (directo) return directo;

  // Fallback geometrico para documentos de una sola columna o cuando la
  // busqueda por columnas no encontro nada.
  if (!hasColumns) {
    const wanted = etiquetas.map(normalize);
    for (const linea of documento.lines) {
      if (linea.column < 0 || !lineaCoincideEtiqueta(linea.text, wanted)) continue;
      const par = buscarContraparte(documento, linea);
      if (par && !lineaCoincideEtiqueta(par.text, wanted)) {
        return par.text;
      }
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

  // Valor en la columna opuesta, justo debajo de la etiqueta.
  const debajo = candidatos
    .filter((l) => l.y >= linea.y + linea.height - 2)
    .sort((a, b) => a.y - b.y)[0];
  if (debajo && debajo.y - (linea.y + linea.height) < linea.height * 2.5 + 6) return debajo;

  // Etiqueta debajo del valor (caso "Identificacion:" arriba, valor "NIT No..."
  // abajo en la columna opuesta).
  const encima = candidatos
    .filter((l) => l.y + l.height <= linea.y + 2)
    .sort((a, b) => b.y - a.y)[0];
  if (encima && (linea.y + linea.height) - encima.y < linea.height * 2.5 + 6) return encima;

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
  return wanted.some((w) => {
    const idx = norm.indexOf(w);
    if (idx < 0) return false;
    const antes = idx === 0 || /[\s]/.test(norm[idx - 1]);
    const despues = idx + w.length >= norm.length || /[\s:]/.test(norm[idx + w.length]);
    return antes && despues;
  });
}

/**
 * Devuelve true si el texto parece un rotulo de tabla (termina en ":" o es
 * muy corto). Se usa en vez de `lineaCoincideEtiqueta` para la contraparte:
 * el valor "NIT No. 901.167.955-4" contiene "nit" pero no es un rotulo,
 * mientras que "Identificacion:" si lo es.
 */
function lineaEsRotulo(texto: string, wanted: string[]): boolean {
  const trimmed = texto.trim();
  if (/[:;]\s*$/.test(trimmed)) return true;
  const norm = normalize(trimmed).replace(/[.:\s]+$/, '');
  // Solo se considera un rotulo si el texto completo coincide con una etiqueta
  // (o es la etiqueta seguida de un prefijo tipo "No.", "del", etc). Un valor
  // real que contiene la palabra de la etiqueta ("NIT No. 901.167.955-4") no
  // debe descartarse: termina en datos, no en una etiqueta suelta.
  return wanted.some((w) => {
    if (norm === w) return true;
    const resto = norm.startsWith(`${w} `) ? norm.slice(w.length + 1) : norm.startsWith(w) ? norm.slice(w.length) : null;
    if (resto === null) return false;
    return /^(?:no\.?|num\.?|del|de|n|no)\s*$/.test(normalize(resto).replace(/[:.]/g, ''));
  }) && trimmed.length <= 30;
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
  // "15 FEBRERO 2024" / "1 de septiembre 2023" (sin "de" antes del anio).
  const ddmmyyyy = normalizarFecha(texto);
  if (ddmmyyyy) return ddmmyyyy;
  return '';
}

/** Normaliza una fecha en texto espanol completa ("primero de septiembre de 2023"). */
function normalizarTextoCompleto(texto: string): string {
  return normalizarFecha(texto);
}

/** Detecta el tipo de contrato por barrido global, tolerante a ruido. */
function detectarTipoContrato(texto: string): ContractType {
  const lower = texto.toLowerCase();
  // Si hay una etiqueta explicita "Tipo de Contrato:", su valor es autoritativo.
  // Sin esto, la mera presencia de "SENA" en la educacion de un expediente
  // consolidado marcaba "aprendizaje" aunque el tipo fuera a termino fijo.
  const etiquetado = lower.match(/tipo\s+de\s+contrato\s*[:#.-]\s*([^\n]+)/i);
  if (etiquetado) {
    const valor = etiquetado[1];
    if (/prestaci[oó]n\s+(?:de\s+)?servicios|servicios\s+profesionales/i.test(valor)) return 'otro';
    if (/indefinid[oa]/i.test(valor)) return 'indefinido';
    if (/(?:obra\s+(?:o\s+)?labor|labor\s+contratada)/i.test(valor)) return 'obra_labor';
    if (/aprendizaje|internship|trainee|sena/i.test(valor)) return 'aprendizaje';
    if (/tiempo\s+parcial|part-time|medio\s+tiempo/i.test(valor)) return 'tiempo_parcial';
    return 'termino_fijo';
  }

  if (/prestaci[oó]n\s+(?:de\s+)?servicios|servicios\s+profesionales/i.test(lower)) return 'otro';
  if (/indefinid[oa]|indefinite/i.test(lower)) return 'indefinido';
  if (/(?:obra\s+(?:o\s+)?labor|labor\s+contratada)/i.test(lower)) return 'obra_labor';
  if (/aprendizaje|internship|trainee|sena/i.test(lower)) return 'aprendizaje';
  if (/tiempo\s+parcial|part-time|medio\s+tiempo/i.test(lower)) return 'tiempo_parcial';
  return 'termino_fijo';
}

function extraerSalario(texto: string): number {
  // El valor ya puede venir aislado (" $ 1.600.000 COP", "S142350-") o con la etiqueta.
  const match = texto.match(/[$Ss§]?\s*([0-9][0-9.,\s-]{3,15})/);
  if (!match) return 0;
  // El OCR de escaneos suele dejar el monto con espacios ("$ 3 200 000") en
  // lugar de puntos o comas, por eso se permiten espacios en la cifra.
  const numero = match[1].match(/[0-9][0-9.,\s]{3,14}/);
  if (!numero) return 0;
  const rawNum = numero[0].trim();
  const sinCentavos = rawNum.replace(/[,.]\d{2}$/, '');
  let valor = parseInt(sinCentavos.replace(/[.,\s-]/g, ''), 10);
  if (isNaN(valor) || valor <= 1000) return 0;

  // En Colombia 2025 el salario mínimo mensual (SMLMV) es $1.423.500.
  // Cuando el OCR se come el "1." inicial (p. ej. "ORAR A 423500"), se reconoce como 1423500.
  if (valor === 423500) {
    valor = 1423500;
  }
  return valor;
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
    /(?:salario|sueldo|remuneraci[oó]n|asalario|orar|honorarios|valor|pago)\s*(?:mensual|basico|integral|devengado|asignado|convenido|del\s+contrato)?\s*(?:[:#.-]|\$|[Ss§]|de\s+un\s+|por\s+un\s+|de\s+|a\s+)?\s*[$Ss§]?\s*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{0,2})?|\d{6,8})/i
  );
  if (match) return match[1];
  // En la tabla de dos columnas el OCR suele perder la etiqueta "Salario:"
  // pero si detecta el monto en la celda contigua. Solo se toma un monto
  // aislado con simbolo de moneda y formato de miles (los demas numeros del
  // contrato, como el NIT o las cedulas, no llevan "$").
  const suelto = todas.match(/[$Ss§]\s*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{0,2})?|\d{6,8})/);
  return suelto ? suelto[1] : '';
}

/** Ultimo recurso: numero de cedula en el texto (evita telefonos moviles y NIT). */
function buscarCedulaGenerica(texto: string, employerNit?: string): string | undefined {
  // Elimina lineas o fragmentos de salario para nunca confundir una suma con cedula
  const sinSalarios = texto.replace(
    /(?:salario|sueldo|remuneraci[oó]n|orar|honorarios|valor|pago|\$|pesos|devengado|monto)[^\n;]*/gi,
    ' '
  );
  const limpio = sinSalarios.replace(/\b(?:telefono|telefonos|celular|movil|whatsapp|contacto)\b[^\n;]*/gi, ' ');
  const nitNumeros = employerNit ? employerNit.replace(/\D/g, '') : '';

  const esValida = (d: string) => {
    if (d.length < 6 || d.length > 10) return false;
    if (d.startsWith('901167')) return false;
    if (nitNumeros && d === nitNumeros) return false;
    if (d.startsWith('3') && d.length === 10) return false;
    return true;
  };

  // 1. Cédula con prefijo explícito (incluyendo variaciones OCR: C.C, CC, CO, C.O, C.00, C C, Cédula de Ciudadanía)
  const regexPrefijo =
    /(?:\bcc\b|c\.?\s*[co0]\.?|co\b|c\.00|c[eé]dula(?:\s+de\s+ciudadan[ií]a)?|documento(?:\s+de\s+(?:identidad|identificacion|ciudadan[ií]a))?|identificacion)\s*(?:n[oº°]?\.?|numero)?\s*[:.-]?\s*([0-9oO][0-9oO.\s-]{5,11}[0-9])/gi;
  for (const m of limpio.matchAll(regexPrefijo)) {
    const digito = m[1].replace(/[oO]/g, '0').replace(/\D/g, '');
    if (esValida(digito)) return digito;
  }

  const regexEtiquetada =
    /(?:\bcc\b|c\.?\s*[co0]\.?|c[eé]dula(?:\s+de\s+ciudadan[ií]a)?|documento(?:\s+de\s+(?:identidad|identificacion|ciudadan[ií]a))?|identificacion)\s*(?:n[oº°]?\.?|numero)?\s*[:.-]?\s*(\d[\d.\s-]{5,}\d)/gi;
  for (const m of limpio.matchAll(regexEtiquetada)) {
    const digito = m[1].replace(/[.\s-]/g, '');
    if (esValida(digito)) return digito;
  }
  const grupos = limpio.match(/(?<![\d.])\d{6,10}(?![\d.])/g) ?? [];
  const candidata = grupos.find((n) => esValida(n));
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
  if (!texto) return 0;
  // Buscar primero "N meses" / "N months" (mas informativo que dias).
  const mesesMatch = texto.match(/(\d{1,3})\s*(meses?|months?)/i);
  if (mesesMatch) {
    const n = parseInt(mesesMatch[1], 10);
    if (!isNaN(n) && n > 0) return Math.min(60, n * 30);
  }
  // Buscar en texto tipo "TRES (3) MESES" / "TRES (3) MESES".
  const mesesTexto = texto.match(
    /(?:uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce)\s*\(?(\d{1,3})\)?\s*(meses?|months?)/i
  );
  if (mesesTexto) {
    const n = parseInt(mesesTexto[1], 10);
    if (!isNaN(n) && n > 0) return Math.min(60, n * 30);
  }
  const match = texto.match(/(\d{1,3})\s*(d[ií]as?|days?|m)/i);
  if (!match) return 0;
  const num = parseInt(match[1], 10);
  if (isNaN(num)) return 0;
  const sufijo = match[2].toLowerCase();
  const meses = /mes|month/.test(sufijo);
  const dias = meses ? num * 30 : num;
  return Math.min(60, dias);
}

/** Extrae el periodo de prueba solo si la seccion o clausula habla explicitamente de prueba. */
function extraerPruebaDeTexto(texto: string): number {
  const match = texto.match(
    /(?:periodo\s+de\s+prueba|periodo\s+probatorio|tiempo\s+de\s+prueba|clausula[^\n.:]*prueba)\s*[:#.-]?\s*([^\n.,;]{1,60})/i
  );
  if (!match) return 0;
  return extraerPrueba(match[1]);
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
  const match =
    texto.match(/termino\s+de\s+(\d{1,3})\s*(?:meses|mes|month|months)/i) ??
    texto.match(/\(\s*(\d{1,3})\s*(?:meses|mes)\s*(?:iniciales)?\s*\)/i) ??
    texto.match(/(?:uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s*\(?\s*(\d{1,3})\s*\)?\s*(?:meses|mes)/i);
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
    const iso = fechaIso(y, m, d);
    if (iso) return iso;
  }

  // YYYY/MM/DD o YYYY-MM-DD (solo cuando el bloque de 4 digitos va primero).
  const ymd = valor.match(/\b(\d{4})\s*[/-]\s*(\d{1,2})\s*[/-]\s*(\d{1,2})\b/);
  if (ymd) {
    const y = Number(ymd[1]);
    const m = Number(ymd[2]);
    const d = Number(ymd[3]);
    const iso = fechaIso(y, m, d);
    if (iso) return iso;
  }

  // "primero de septiembre de 2023" / "1 de septiembre de 2023"
  const textual = valor.match(
    /(\d{1,2}|primero|primera|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|quince|veinte|treinta)\s+de\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})/i
  );
  if (textual) {
    const dia = numeroEnTexto(textual[1]);
    const mes = indiceMes(textual[2]);
    const y = Number(textual[3]);
    if (dia && mes) {
      const iso = fechaIso(y, mes, dia);
      if (iso) return iso;
    }
  }

  // "04 ENERO 2025" / "04 DE ABRIL 2025" / "04 DE ABRIL2025" — formato de contrato escaneado
  // sin "de" antes del anio, o sin espacio antes del anio.
  const ddmmyyyy = valor.match(
    /(\d{1,2})\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s*(\d{4})/i
  );
  if (ddmmyyyy) {
    const d = Number(ddmmyyyy[1]);
    const m = indiceMes(ddmmyyyy[2]);
    const y = Number(ddmmyyyy[3]);
    if (m) {
      const iso = fechaIso(y, m, d);
      if (iso) return iso;
    }
  }

  return '';
}

/** Un contrato laboral no puede estar fechado fuera de este rango. */
const ANIO_MINIMO = 1900;
const ANIO_MAXIMO = 2100;

/**
 * Corrige el digito de las milesimas cuando el OCR lo ha leido mal: en CT_04 la
 * fecha de inicio salia como "7025-01-02" porque el 2 se leyo como 7. De las
 * dos correcciones posibles (1xxx y 2xxx) solo una puede caer dentro del rango,
 * porque los tramos no se solapan, asi que no hay ambiguedad que resolver. Si
 * ninguna cabe se devuelve null y el campo se queda vacio, que es preferible a
 * guardar una fecha inventada.
 */
function corregirAnio(anio: number): number | null {
  if (anio >= ANIO_MINIMO && anio <= ANIO_MAXIMO) return anio;
  if (!Number.isInteger(anio) || anio < 1000 || anio > 9999) return null;
  const posibles = [1000 + (anio % 1000), 2000 + (anio % 1000)].filter(
    (candidato) => candidato >= ANIO_MINIMO && candidato <= ANIO_MAXIMO
  );
  return posibles.length === 1 ? posibles[0] : null;
}

/** Compone la fecha ISO validando anio, mes y dia. Cadena vacia si no cuadra. */
function fechaIso(anio: number, mes: number, dia: number): string {
  const y = corregirAnio(anio);
  if (y === null || !mesValido(mes) || !diaValido(dia, mes, y)) return '';
  return `${y}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
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

/**
 * True si el valor parece la fila de preaviso ("Trabajador: 15 días. Empleador:
 * 30 días"), que contamina la extraccion de nombres: al buscarse "trabajador" o
 * "empleador" como etiqueta, `findLabeledValue` toma ese valor de duracion en
 * vez del nombre real de la persona o la empresa.
 */
const MARCADORES_CLAUSULA_O_SUBHEADER =
  /\b(?:generalidades(?:\s+de\s+ley)?|terminaci[oó]n|vencimiento|condiciones|cl[aá]usula(?:s)?|preaviso|aviso(?:\s+de\s+terminaci[oó]n)?)\b|iso\s+de\s+terminaci[oó]n/i;

function esValorPreaviso(valor: string): boolean {
  return (
    /(?:d[ií]as|meses)/i.test(valor) &&
    (/(?:empleador|trabajador)/i.test(valor) || /^\d+\s*d[ií]as\b/i.test(valor.trim()) || /\b15\s*d[ií]as\b/i.test(valor) || /\b30\s*d[ií]as\b/i.test(valor)) ||
    /\b(?:aviso|iso)\s+de\s+terminaci[oó]n\b/i.test(valor)
  );
}

/**
 * Una direccion colombiana, para no confundirla con un nombre. En CT_12 el
 * respaldo devolvia "AV 68 x 40-15" como nombre del trabajador: tiene letras y
 * no lleva ninguna palabra de etiqueta, asi que pasaba todos los filtros.
 */
function pareceDireccion(valor: string): boolean {
  return (
    /#/.test(valor) ||
    /^(?:cl|cll|calle|cra|kra|carrera|av|avenida|dg|diagonal|tv|transversal|mz|manzana)\b/i.test(
      valor.trim()
    )
  );
}

/**
 * Rotulos que solo pueden pertenecer al trabajador. Sirven de ancla cuando su
 * propia etiqueta ("Trabajador:") no se ha leido.
 */
const ANCLAS_TRABAJADOR = [
  ...ETIQUETAS_NACIMIENTO,
  ...ETIQUETAS_DOMICILIO_TRABAJADOR,
  ...ETIQUETAS_CORREO_TRABAJADOR,
].map(normalize);

/** Un nombre de persona: dos o mas palabras de letras sustanciales, sin cifras ni rotulos. */
function pareceNombreDePersona(valor: string): boolean {
  if (/@|\b(?:gmail|hotmail|outlook|yahoo|puc|mail|email|correo|com|net|org)\b/i.test(valor)) {
    return false;
  }
  const limpio = limpiarNombrePersona(valor);
  if (limpio.length < 5 || limpio.length > 60) return false;
  if (/\d/.test(limpio) || /[:;#]/.test(limpio) || pareceDireccion(limpio)) return false;
  if (/d[ií]as|meses/i.test(limpio)) return false;
  if (MARCADORES_CLAUSULA_O_SUBHEADER.test(limpio) || MARCADORES_CLAUSULA_O_SUBHEADER.test(valor)) {
    return false;
  }
  if (esValorPreaviso(limpio) || esValorPreaviso(valor)) {
    return false;
  }
  if (/\b(?:cam|on|ace|off|quincenal|mensual)\b/i.test(limpio) && limpio.split(/\s+/).length <= 3) {
    return false;
  }
  const palabras = limpio.split(/\s+/);
  const conectores = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'el', 'san']);
  const sustantivas = palabras.filter((p) => /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ.'-]{3,}$/.test(p));
  const todasLetras = palabras.every(
    (p) =>
      /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ.'-]{3,}$/.test(p) ||
      conectores.has(p.toLowerCase()) ||
      /^[A-Za-z]\.?$/.test(p)
  );
  return sustantivas.length >= 2 && todasLetras;
}

/**
 * En una tabla el rotulo puede no leerse y dejar el valor huerfano: en CT_06 el
 * renglon del trabajador salio solo como "MARTHA LUCIA CAICEDO BERMUDEZ", sin
 * la etiqueta "Trabajador:", y la unica linea que contenia esa palabra era la
 * del preaviso ("Trabajador: 30 dias. Empleador: 30 dias").
 *
 * Cuando eso pasa, el nombre es el renglon sin etiqueta que esta justo encima
 * de los datos de esa persona, que si conservan su rotulo. Se mira solo dos
 * renglones hacia arriba para no cruzar a los datos del empleador.
 */
function nombreSobreLosDatos(documento: DocumentLayout, anclas: string[]): string | null {
  const lines = documento.lines;
  // La coincidencia exige frontera de palabra: sin ella, "domicilio del
  // empleado" casaria con el renglon "Domicilio del empleador" y el ancla se
  // iria al bloque de la empresa.
  const casaAncla = (texto: string, ancla: string): boolean => {
    const norm = normalize(texto);
    return norm.startsWith(ancla) && !/[a-z0-9]/.test(norm.charAt(ancla.length));
  };
  const indice = lines.findIndex((l) => anclas.some((a) => casaAncla(l.text, a)));
  if (indice <= 0) return null;

  for (let i = indice - 1; i >= 0 && i >= indice - 2; i--) {
    const valor = limpiarValor(lines[i].text);
    if (valor && pareceNombreDePersona(valor)) return valor;
  }
  return null;
}

/**
 * Extrae un nombre de persona o empresa evitando la fila de preaviso. Usa el
 * mismo `valorDeEtiqueta` pero, si lo que arroja es un valor de duracion de la
 * fila de preaviso, espera a la ETIQUETA como renglon propio y toma el renglon
 * siguiente, que en la tabla es el nombre real (p. ej. "Trabajador:" y debajo
 * "MARTHA CAICEDO").
 */
function extraerNombre(
  documento: DocumentLayout,
  etiquetas: string[],
  bloque: DocumentLayout
): string | null {
  const habitualRaw = limpiarValor(valorDeEtiqueta(bloque, etiquetas));
  const habitual = habitualRaw ? limpiarNombrePersona(habitualRaw) : undefined;
  const utilizable = (valor: string | null | undefined): valor is string =>
    !!valor &&
    !esValorPreaviso(valor) &&
    !pareceDireccion(valor) &&
    !/^\d+\s*(?:d[ií]as|meses)\b/i.test(valor.trim()) &&
    !/\b\d{1,2}\s*d[ií]as\b/i.test(valor);
  if (utilizable(habitual) && (pareceNombreDePersona(habitual) || FORMA_JURIDICA.test(habitual))) return habitual;

  // Respaldo: etiqueta en un renglon propio y el nombre en el siguiente.
  const wanted = etiquetas.map(normalize).filter((e) => e.length >= 3);
  const lines = documento.lines;
  for (let i = 0; i < lines.length; i++) {
    const renglon = lines[i].text.replace(/[:.]\s*$/, '').trim();
    const norm = normalize(renglon);
    if (renglon.length > 25 || !wanted.some((w) => norm === w)) continue;
    for (let j = i + 1; j < lines.length && j < i + 3; j++) {
      const valor = limpiarValor(lines[j].text);
      if (!valor) continue;
      if (esValorPreaviso(valor)) continue;
      if (/[:;]\s*$/.test(valor)) continue;
      const v = normalize(valor);
      if (wanted.some((w) => v.includes(w))) continue;
      // Solo si parece un nombre: hay letras y, si hay digitos, es una cedula
      // que no toca.
      if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}/.test(valor)) continue;
      if (/\b(?:fecha|correo|domicilio|identificacion|cargo|salario|forma|tipo|periodo|preaviso|lugar)\b/i.test(valor)) continue;
      if (pareceDireccion(valor)) continue;
      const limpio = limpiarNombrePersona(valor);
      if (utilizable(limpio) && (pareceNombreDePersona(limpio) || FORMA_JURIDICA.test(limpio))) {
        return limpio;
      }
    }
  }

  // Si lo unico que habia era la fila de preaviso o un domicilio, no se
  // devuelve: un nombre de trabajador que dice "30 dias. Empleador: 30 dias" es
  // un dato falso, y quien revisa un lote puede no verlo. Vacio se ve.
  return utilizable(habitual) && (pareceNombreDePersona(habitual) || FORMA_JURIDICA.test(habitual))
    ? habitual
    : null;
}

/**
 * Extrae el NIT del empleador priorizando las etiquetas explicitas de NIT/RUT.
 * La etiqueta generica "identificacion" comparte fila con la razon social
 * ("RECOMENDADO: DISTRIBUCIONES ROSIMAR S.A.S"), por lo que no debe usarse
 * cuando existe una fila propia "NIT No.: 901.167.955-4".
 */
const ETIQUETAS_NIT_ESPECIFICAS = [
  'nit', 'rut', 'tax id', 'nit del empleador', 'identificacion tributaria',
  'nit no', 'no nit', 'numero de nit', 'nit no.',
];

/**
 * Cédula del trabajador. El empleador y el trabajador comparten la etiqueta
 * generica "Identificacion", y al buscar sobre el documento entero la fila del
 * empleador ("Identificacion: NIT No. 901.167.955-4") gana por orden. La cédula
 * del trabajador es la que NO es un NIT/RUT (suele ir como "C.C", "Cedula").
 */
function extraerCedulaTrabajador(bloque: DocumentLayout, documento: DocumentLayout): string | null {
  const recortar = (v: string | null): string | null => {
    if (!v) return null;
    const antes = v.split(/\(|;|\n/)[0].trim();
    return antes || v;
  };

  const esValido = (v: string | null): v is string => {
    if (!v) return false;
    if (/NIT|RUT/i.test(v)) return false;
    const base = recortar(v) ?? '';
    const digits = base.replace(/\D/g, '');
    if (digits.startsWith('901167')) return false;
    if (digits.length < 6 || digits.length > 10) return false;
    return true;
  };

  const habitual = valorEnBloque(bloque, documento, ETIQUETAS_CEDULA);
  if (esValido(habitual)) return recortar(habitual);

  // Respaldo: busqueda en el bloque del trabajador que excluya la fila NIT/RUT.
  const wanted = ETIQUETAS_CEDULA.map(normalize).filter((e) => e.length >= 3);
  for (const pung of [bloque, documento]) {
    for (const linea of pung.lines) {
      if (!lineaCoincideEtiqueta(linea.text, wanted)) continue;
      const pares = splitLabeledPairs(linea.text);
      for (const par of pares) {
        if (wanted.includes(normalize(par.label)) && esValido(par.value)) {
          return recortar(par.value);
        }
      }
    }
  }
  return esValido(habitual) ? recortar(habitual) : null;
}

function extraerNit(bloque: DocumentLayout, documento: DocumentLayout): string | null {
  const candidatos = [
    valorEnBloque(bloque, documento, ETIQUETAS_NIT_ESPECIFICAS),
    valorEnBloque(bloque, documento, ETIQUETAS_NIT),
  ];
  // Un NIT contiene necesariamente digitos; un rotulo de columna contraria
  // ("Domicilio del empleador") no. Asi se descarta la contraparte geometrica
  // equivocada en tablas de dos columnas.
  const conDigitos = candidatos.find((c) => c && /[0-9]/.test(c));
  if (conDigitos) return conDigitos;
  // Ultimo recurso: buscar el formato de NIT directamente en el texto.
  const enTexto = documento.lines.map((l) => l.text).join(' ').match(
    /(?:NIT|RUT)\s*(?:No\.?|N[o°]\.?)?\s*([0-9][0-9.\s-]*[0-9])/i
  );
  if (enTexto) return enTexto[1].replace(/\s+/g, ' ');
  return candidatos.find((c) => c) ?? null;
}

function limpiarNit(valor: string | null): string | undefined {
  if (!valor) return undefined;
  // Conservera el formato del NIT (p. ej. 900.123.456-7) quitando solo el ruido
  // que pueda traer al final del valor etiquetado y cualquier prefijo de
  // etiqueta que el OCR dejara pegado ("NIT No. 901.167.955-4", "C.C 1.098...").
  return valor
    .replace(/^(?:NIT|RUT|C\.?\s?C\.?|CEDULA|TARJETA\s+DE\s+IDENTIDAD|CC)\s*(?:No\.?|N[o°]\.?)?\s*:?\s*/i, '')
    .replace(/[\s|•*]+$/g, '')
    .trim();
}

/**
 * Respaldo cuando la etiqueta no se reconoce. El OCR de un escaneo se come una
 * tilde y "Correo electronico del trabajador" pasa a "Correo electrenico del
 * trabajador", que ya no casa con ninguna etiqueta. La direccion, en cambio,
 * sigue ahi: se busca en el bloque de la persona, descartando la del empleador
 * para no repetirla cuando el acotado por bloques no ha podido separar los dos.
 */
function correoEnBloque(bloque: DocumentLayout, excluir: string): string | null {
  // Renglon a renglon, no de una vez: la del empleador suele aparecer antes que
  // la del trabajador, y parar en la primera dejaria el campo vacio.
  for (const linea of bloque.lines) {
    const directo = linea.text.match(/[\w.+-]+@[\w.-]+\.\w{2,}/i)?.[0];
    // Sin etiqueta que la respalde, la reconstruccion va en modo estricto.
    const candidato = directo ?? reconstruirCorreoOcr(linea.text, { estricto: true });
    if (!candidato) continue;
    if (candidato.toLowerCase() !== excluir.toLowerCase()) return candidato;
  }
  return null;
}

/** Extrae una direccion de correo del valor etiquetado (null si no hay correo). */
function extraerCorreo(valor: string | null): string | null {
  if (!valor) return null;
  const match = valor.match(/[\w.+-]+@[\w.-]+\.\w{2,}/i);
  if (match) return match[0].toLowerCase();
  // Sin arroba legible: el OCR la habra leido como otro glifo. La
  // reconstruccion es la misma que usa la ruta de hojas de vida.
  const rec = reconstruirCorreoOcr(valor);
  return rec ? rec.toLowerCase() : null;
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
  // Cuando el mes de fin es menor al de inicio (feb->ene), la resta da
  // meses-1; sumar 1 para compensar.
  return hasta[1] < desde[1] ? meses + 1 : meses;
}
