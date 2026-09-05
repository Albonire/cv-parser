import { ExtractedDocumentData, DetectedDocumentType } from '../../types/reader';
import { CandidateFormData } from '../../types/candidate';
import { ContractFormData } from '../../types/contract';
import { IdCardFormData } from '../../types/id-card';
import { HealthFormData } from '../../types/health';
import { buscarCedulaEnTexto } from '../offline/expediente';
import { parseCvText } from './parser-cv';
import { parseContractText } from './parser-contract';
import { parseIdCardText } from './parser-id';
import { parseHealthText } from './parser-health';
import { layoutFromPlainText } from './layout';
import { repartirNombre } from './fields/nombres';

/**
 * Agrupacion de un lote de documentos por empleado.
 *
 * Cuando el usuario sube varias fotos (normalmente de un mismo empleado,
 * p. ej. su hoja de vida partida en varias fotos, su contrato, su EPS...),
 * el sistema agrupa los resultados por la identidad detectada en cada uno
 * (numero de documento, y a falta de este el nombre). Cada grupo se muestra
 * de forma consolidada: lista de documentos, texto OCR combinado y la opcion
 * de llenar el formulario con los datos fusionados de todas las fotos.
 *
 * Los distintos empleados que se suban juntos quedan en grupos separados, de
 * modo que los datos de una persona no se mezclan con los de otra.
 */

export interface IdentidadEmpleado {
  cedula?: string;
  nombre?: string;
}

export interface GrupoLote {
  /** Clave unica del grupo (cedula/nit normalizada, nombre o sin_identificar). */
  key: string;
  cedula?: string;
  nombre?: string;
  items: ExtractedDocumentData[];
  /** Texto OCR de todas las fotos del grupo, en el orden del lote. */
  textoConsolidado: string;
  /** Tipo de formulario predominante del grupo (para elegir el formulario). */
  tipoPredominante: DetectedDocumentType;
}

/** Identidad detectada en un resultado de extraccion. */
export function identidadDeResultado(r: ExtractedDocumentData): IdentidadEmpleado {
  const contrato = r.contractData;
  if (contrato?.workerName || contrato?.workerDocumentNumber) {
    return { cedula: contrato.workerDocumentNumber, nombre: contrato.workerName };
  }
  const candidato = r.candidateData;
  if (candidato?.documentNumber || candidato?.firstNames) {
    return {
      cedula: candidato.documentNumber,
      nombre: [candidato.firstNames, candidato.lastNames].filter(Boolean).join(' ').trim() || undefined,
    };
  }
  const salud = r.healthData;
  if (salud?.workerName || salud?.documentNumber) {
    return { cedula: salud.documentNumber, nombre: salud.workerName };
  }
  const id = r.idCardData;
  if (id?.documentNumber || id?.firstNames) {
    return {
      cedula: id.documentNumber,
      nombre: [id.firstNames, id.lastNames].filter(Boolean).join(' ').trim() || undefined,
    };
  }
  // Sin estructura, se intenta localizar la cedula y el nombre en el texto OCR.
  // Una sola foto puede traer ambos ("TRABAJADOR: ALIBIS CALLEJAS NAVARRO\nCC 32.891.622")
  // y asi el grupo con cedula queda con nombre para fundir los documentos que
  // solo traen "PARA: ALIBIS CALLEJAS NAVARRO".
  const cedula = buscarCedulaEnTexto(r.extractedText);
  const nombre = buscarNombreEnTexto(r.extractedText);
  if (cedula && nombre) return { cedula, nombre };
  if (cedula) return { cedula };
  return nombre ? { nombre } : {};
}

const PATRON_NOMBRE_EMPLEADO =
  /(?:\bpara\b|emplead[oa]|trabajad[oa]r|afiliad[oa]|cotizante|beneficiari[oa]|contratista|pagado\s+a|a\s+la\s+orden\s+de|nombre\s+del\s+emplead[oa]|nombre\s+del\s+trabajador|nombre\s+del\s+afiliad[oa])\s*[:.#-]?\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ.''-]{2,}(?:\s+(?:de\s+|del\s+|de\s+la\s+|de\s+los\s+)?[A-Za-zÁÉÍÓÚÜÑáéíóúüñ.''-]{2,}){0,4})(?=\n|$)/i;

/** Extrae el nombre del empleado desde encabezados comunes de documentos de RRHH. */
export function buscarNombreEnTexto(texto: string): string | undefined {
  const linea = texto
    .split('\n')
    .map((l) => l.trim())
    .find((l) => PATRON_NOMBRE_EMPLEADO.test(l));
  if (!linea) return undefined;
  const m = linea.match(PATRON_NOMBRE_EMPLEADO);
  if (!m) return undefined;
  const nombre = m[1].trim();
  if (nombre.split(/\s+/).length < 1 || /@|\d|www\.|https?:/i.test(nombre)) return undefined;
  return nombre;
}

function normalizarCedula(cedula?: string): string | undefined {
  const limpia = (cedula ?? '').replace(/[.\s-]/g, '');
  return limpia || undefined;
}

/** Compara dos nombres tolerando abreviaturas o apellidos compuestos mediante intersección de tokens. */
export function nombresCoinciden(nomA?: string, nomB?: string): boolean {
  if (!nomA || !nomB) return false;
  const aNorm = nomA.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const bNorm = nomB.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (aNorm === bNorm) return true;

  const stopWords = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'el']);
  const tokensA = aNorm.split(/\s+/).filter((t) => t.length >= 3 && !stopWords.has(t));
  const tokensB = bNorm.split(/\s+/).filter((t) => t.length >= 3 && !stopWords.has(t));

  if (tokensA.length === 0 || tokensB.length === 0) return false;

  const inter = tokensA.filter((t) => tokensB.includes(t));
  const minTokens = Math.min(tokensA.length, tokensB.length);
  if (minTokens <= 2) {
    return inter.length >= minTokens;
  }
  return inter.length >= 2;
}

/** Agrupa los resultados de un lote por empleado, conservando el orden de carga. */
export function agruparPorEmpleado(results: ExtractedDocumentData[]): GrupoLote[] {
  const groups = new Map<string, GrupoLote>();

  const obtenerGrupo = (key: string, cedula?: string, nombre?: string): GrupoLote => {
    let grupo = groups.get(key);
    if (!grupo) {
      grupo = {
        key,
        cedula: cedula ?? undefined,
        nombre: nombre ?? undefined,
        items: [],
        textoConsolidado: '',
        tipoPredominante: 'unknown',
      };
      groups.set(key, grupo);
    }
    return grupo;
  };

  const itemsSinIdentidad: ExtractedDocumentData[] = [];

  for (const r of results) {
    const ident = identidadDeResultado(r);
    const ced = normalizarCedula(ident.cedula);
    const nom = ident.nombre?.trim();

    let grupo: GrupoLote;
    if (ced) {
      // Buscar si ya existe un grupo con esta cédula
      const grupoConCed = [...groups.values()].find(
        (g) => g.cedula && normalizarCedula(g.cedula) === ced
      );
      if (!grupoConCed) {
        // Buscar si ya existía un grupo creado solo por nombre que coincida
        const grupoPorNombre = [...groups.values()].find(
          (g) => !g.cedula && nombresCoinciden(g.nombre, nom)
        );
        if (grupoPorNombre) {
          grupoPorNombre.cedula = ident.cedula;
          if (nom && (!grupoPorNombre.nombre || nom.length > grupoPorNombre.nombre.length)) {
            grupoPorNombre.nombre = nom;
          }
          groups.delete(grupoPorNombre.key);
          grupoPorNombre.key = `ced:${ced}`;
          groups.set(grupoPorNombre.key, grupoPorNombre);
          grupo = grupoPorNombre;
        } else {
          grupo = obtenerGrupo(`ced:${ced}`, ident.cedula, ident.nombre);
        }
      } else {
        grupo = grupoConCed;
        if (!grupo.nombre && nom) {
          grupo.nombre = nom;
        } else if (nom && grupo.nombre && nom.length > grupo.nombre.length && nombresCoinciden(grupo.nombre, nom)) {
          grupo.nombre = nom;
        }
      }
    } else if (nom) {
      // Buscar grupo existente (con cédula o sin cédula) que coincida por nombre difuso
      const existente = [...groups.values()].find((g) => nombresCoinciden(g.nombre, nom));
      if (existente) {
        grupo = existente;
        if (!grupo.nombre || nom.length > grupo.nombre.length) {
          grupo.nombre = nom;
        }
      } else {
        grupo = obtenerGrupo(`nom:${nom}`, undefined, nom);
      }
    } else {
      itemsSinIdentidad.push(r);
      continue;
    }

    grupo.items.push(r);
    grupo.textoConsolidado = grupo.textoConsolidado
      ? `${grupo.textoConsolidado}\n\n${r.extractedText}`
      : r.extractedText;
  }

  // Resultados sin identidad detectable van a un unico grupo separado. Si el
  // lote tiene UN solo empleado identificado, se funden ahi: el usuario sube el
  // expediente junto (funciones, EPS, etc.) y ninguna de esas fotos suele traer
  // nombre o cedula, pero todas son del mismo empleado.
  if (itemsSinIdentidad.length > 0) {
    const identificados = [...groups.values()].filter((g) => g.cedula || g.nombre);
    if (identificados.length === 1) {
      const unico = identificados[0];
      unico.items.push(...itemsSinIdentidad);
      unico.textoConsolidado = unico.textoConsolidado
        ? `${unico.textoConsolidado}\n\n${itemsSinIdentidad.map((r) => r.extractedText).join('\n\n')}`
        : itemsSinIdentidad.map((r) => r.extractedText).join('\n\n');
      groups.delete('sin_identificar');
    } else {
      const grupo = obtenerGrupo('sin_identificar', undefined, undefined);
      grupo.items = itemsSinIdentidad;
      grupo.textoConsolidado = itemsSinIdentidad.map((r) => r.extractedText).join('\n\n');
    }
  }

  // Tipo de formulario predominante por frecuencia.
  for (const grupo of groups.values()) {
    const frecuencia = new Map<DetectedDocumentType, number>();
    for (const it of grupo.items) {
      frecuencia.set(it.detectedType, (frecuencia.get(it.detectedType) ?? 0) + 1);
    }
    const [predominante] = [...frecuencia.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['unknown' as DetectedDocumentType, 0];
    grupo.tipoPredominante = predominante;
  }

  return [...groups.values()];
}

/**
 * Sintetiza un resultado consolidado a partir de un grupo, para abrir el
 * formulario del empleado con los datos fusionados de todas las fotos.
 */
export function sintetizarResultadoConsolidado(grupo: GrupoLote): ExtractedDocumentData {
  const texto = grupo.textoConsolidado;
  let detectedType: DetectedDocumentType = grupo.tipoPredominante;
  const confianza =
    grupo.items.reduce((s, it) => s + it.confidenceScore, 0) / Math.max(1, grupo.items.length);

  let candidateData: CandidateFormData | undefined;
  let contractData: ContractFormData | undefined;
  let idCardData: IdCardFormData | undefined;
  let healthData: HealthFormData | undefined;

  // Se preservan los datos estructurados de las fotos individuales del lote que
  // no tienen formulario propio en la "hoja corrida" (liquidacion, memorando,
  // funciones) para que no se pierdan: al guardar el empleado y el lote, cada
  // documento se persiste en su tabla con su informacion leida.
  let liquidacionData = grupo.items.find((it) => it.liquidacionData)?.liquidacionData;
  let memorandoData = grupo.items.find((it) => it.memorandoData)?.memorandoData;
  let funcionesData = grupo.items.find((it) => it.funcionesData)?.funcionesData;

  if (detectedType === 'contract') {
    contractData = parseContractText(texto, layoutFromPlainText(texto));
    // El rol del contrato tambien se aprovecha como cargo/funcion del empleado.
    if (contractData?.position && !funcionesData) {
      funcionesData = { position: contractData.position, funciones: [] };
    }
  } else if (detectedType === 'id_card') {
    idCardData = parseIdCardText(texto);
  } else if (detectedType === 'health') {
    healthData = parseHealthText(texto);
  }
  // El formulario consolidado ("hoja corrida") muestra al empleado: siempre se
  // reestructura el texto combinado como hoja de vida y se fusionan los datos
  // de identidad detectados en el grupo (nombre y cedula), aunque el lote sea de
  // documentos de RRHH y no de una hoja de vida. Asi el usuario ve el nombre y
  // la cedula cargados y solo debe corregir lo que falte (RN-7).
  candidateData = parseCvText(texto, layoutFromPlainText(texto));
  if (candidateData && grupo.nombre) {
    // La identidad confirmada del grupo (PARA:/TRABAJADOR:/NOMBRES de varias
    // fotos) tiene prioridad sobre el nombre que el parseo de CV adivine, que
    // puede confundirse con el del empleador ("NOMBRE DEL EMPLEADOR: GONZALO...").
    candidateData = repartirNombreEnCandidato(candidateData, grupo.nombre);
  }
  if (candidateData && grupo.cedula && !candidateData.documentNumber) {
    candidateData = { ...candidateData, documentNumber: grupo.cedula };
  }

  return {
    detectedType: 'cv',
    fileName: `${grupo.items.length} documentos consolidados de ${grupo.nombre ?? 'un empleado'}`,
    fileSize: grupo.items.reduce((s, it) => s + (it.fileSize ?? 0), 0),
    fileType: grupo.items[0]?.fileType ?? '',
    extractedText: texto,
    confidenceScore: confianza,
    processingTimeMs: grupo.items.reduce((s, it) => s + (it.processingTimeMs ?? 0), 0),
    method: grupo.items[0]?.method ?? 'image_ocr',
    candidateData,
    contractData,
    idCardData,
    healthData,
    liquidacionData,
    memorandoData,
    funcionesData,
  };
}

/** Reparte un nombre completo segun la convencion colombiana de dos apellidos.
 *  Delega en el helper unificado `repartirNombre` de fields/nombres.ts para que
 *  el reparto sea identico al del parser de CV, contrato y cedula. */
function repartirNombreEnCandidato(
  candidato: CandidateFormData,
  nombreCompleto: string
): CandidateFormData {
  const { firstNames, lastNames } = repartirNombre(nombreCompleto);
  return { ...candidato, firstNames, lastNames };
}
