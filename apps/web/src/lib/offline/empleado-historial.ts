import { db } from './db';
import { queueMutation } from './sync';
import { ExtractedDocumentData } from '../../types/reader';
import { CandidateFormData } from '../../types/candidate';
import { EmployeeItem, TerminationReason } from '../../types/employee';
import { clasificarHistorial } from '../ocr/document-classifier';
import { normalizarDocumento, buscarCedulaEnTexto } from './expediente';

/**
 * Empleado inferido por su HISTORIAL DOCUMENTAL.
 *
 * Muchos trabajadores de Rosimar NO estan aun registrados en la tabla
 * `employees`, pero sus documentos (contrato, liquidacion, renuncia) son
 * prueba inequivoca de que fueron o son empleados de la compania. En lugar de
 * tratar a esa persona como un simple "candidato", el sistema infiere su
 * condicion de empleado a partir de esa evidencia documental, crea/actualiza
 * su ficha y guarda cada documento como historial vinculado por cedula.
 *
 * Regla de inferencia de estado:
 *  - Contrato vigente (sin liquidacion/renuncia posterior) -> activo.
 *  - Liquidacion o renuncia -> inactivo (con razon y fecha de salida).
 */

/** Resultado de la inferencia de condicion laboral por documentos. */
export interface EstadoEmpleadoPorHistorial {
  /** True cuando los documentos prueban una relacion laboral con Rosimar. */
  esEmpleado: boolean;
  /** Estado sugerido: activo si hay contrato vigente, inactivo si hay salida. */
  estado: 'activo' | 'inactivo';
  fechaSalida?: string;
  razonSalida?: TerminationReason;
  /** Cedula inferida para la persona (si se encontro en algun documento). */
  cedula?: string;
}

/**
 * Determina si un conjunto de resultados prueba una relacion laboral con
 * Rosimar y cual es su estado. Se usa para dejar de mostrar a la persona como
 * candidato cuando sus documentos demuestran que fue/es empleado.
 */
export function determinarEvidenciaLaboral(
  results: ExtractedDocumentData[]
): EstadoEmpleadoPorHistorial {
  let hayContrato = false;
  let haySalida = false;
  let cedula: string | undefined;

  for (const r of results) {
    const categoria = clasificarHistorial(r.extractedText);
    const id = cedulaDeResultado(r);
    if (id) cedula = id;

    if (r.contractData || categoria === 'contrato') hayContrato = true;
    if (r.liquidacionData || categoria === 'liquidacion' || categoria === 'renuncia') {
      haySalida = true;
    }
  }

  const esEmpleado = hayContrato || haySalida;
  if (!esEmpleado) return { esEmpleado: false, estado: 'activo' };

  // Si hay una salida (liquidacion o renuncia) se infiere inactivo aunque
  // exista un contrato: la salida es posterior en el tiempo.
  const estado: 'activo' | 'inactivo' = haySalida ? 'inactivo' : 'activo';

  // Fecha/razon de salida desde la liquidacion o la renuncia encontrada.
  let fechaSalida: string | undefined;
  let razonSalida: TerminationReason | undefined;
  for (const r of results) {
    const categoría = clasificarHistorial(r.extractedText);
    if (r.liquidacionData?.fechaRetiro && !fechaSalida) {
      fechaSalida = r.liquidacionData.fechaRetiro;
      razonSalida = 'terminacion_unilateral_empleador';
    } else if (categoría === 'renuncia' && !fechaSalida) {
      fechaSalida = fechaEnTexto(r.extractedText);
      razonSalida = 'renuncia';
    }
  }

  return { esEmpleado: true, estado, fechaSalida, razonSalida, cedula };
}

/** Construye la CandidateFormData consolidada a partir de los resultados.
 *
 * Consolida informacion de TODOS los documentos del lote:
 * - Nombre (candidateData, contractData, idCardData).
 * - Correo/telefono (candidateData, healthData, contractData).
 * - Rol/cargo (contractData.position, funcionesData.position).
 * - Funciones (funcionesData.funciones -> experience[].responsibilities).
 * - Con prioridad a los campos ya editados en candidateData si existen.
 */
export function candidateDataDesdeHistorial(
  results: ExtractedDocumentData[],
  cedula: string
): CandidateFormData {
  let nombreCompleto: string | undefined;
  let birthDate: string | undefined;
  let cityResidence: string | undefined;
  let address: string | undefined;
  let phone: string | undefined;
  let email: string | undefined;
  let gender: string | undefined;
  let headline: string | undefined;
  const experienceMap = new Map<string, { position: string; responsibilities: string[] }>();

  const consolidar = (r: ExtractedDocumentData) => {
    const c = r.candidateData;
    if (c?.firstNames && !nombreCompleto) {
      nombreCompleto = [c.firstNames, c.lastNames].filter(Boolean).join(' ').trim();
    }
    if (c?.birthDate) birthDate = c.birthDate;
    if (c?.cityResidence) cityResidence = c.cityResidence;
    if (c?.address) address = c.address;
    // Prioridad a campos de candidateData para correo/telefono.
    if (c?.phone) phone = c.phone;
    if (c?.email) email = c.email;
    if (c?.gender) gender = c.gender;
    if (c?.headline) headline = c.headline;

    // Cédula: datos adicionales.
    if (r.idCardData?.birthDate) birthDate = r.idCardData.birthDate;
    if (r.idCardData?.address) address = r.idCardData.address;
    if (r.idCardData?.gender) gender = r.idCardData.gender;

    // Contrato: nombre, dirección, cargo, teléfono.
    if (r.contractData?.workerName && !nombreCompleto) {
      nombreCompleto = r.contractData.workerName;
    }
    if (r.contractData?.workerAddress) address = r.contractData.workerAddress;
    if (r.contractData?.position && !headline) {
      headline = r.contractData.position;
    }

    // Salud/EPS: teléfono, correo.
    if (r.healthData?.phone && !phone) {
      phone = r.healthData.phone;
    }
    if (r.healthData?.email && !email) {
      email = r.healthData.email;
    }

    // Funciones: cargo y lista de responsabilidades.
    if (r.funcionesData) {
      const pos = r.funcionesData.position || 'Sin especificar';
      const funciones = r.funcionesData.funciones || [];
      if (!experienceMap.has(pos)) {
        experienceMap.set(pos, { position: pos, responsibilities: funciones });
      }
      if (!headline && r.funcionesData.position) {
        headline = r.funcionesData.position;
      }
    }

    // Experiencia previa del candidateData.
    if (c?.experience) {
      for (const exp of c.experience) {
        const pos = exp.position || 'Sin especificar';
        if (!experienceMap.has(pos)) {
          experienceMap.set(pos, {
            position: exp.position,
            responsibilities: exp.responsibilities
              ? exp.responsibilities.split(';').map((r) => r.trim()).filter(Boolean)
              : [],
          });
        }
      }
    }
  };

  for (const r of results) consolidar(r);

  const { firstNames, lastNames } = repartirNombreDe(nombreCompleto);

  // Construir experience[] desde el mapa consolidado.
  const experience = Array.from(experienceMap.values()).map((exp, idx) => ({
    id: `exp-${idx}`,
    company: 'Rosimar S.A.S.',
    position: exp.position,
    responsibilities: exp.responsibilities.join('; '),
    isCurrent: idx === 0, // La primera es la actual.
  }));

  return {
    firstNames,
    lastNames,
    documentType: 'CC',
    documentNumber: cedula,
    birthDate,
    nationality: 'Colombiana',
    cityResidence,
    address,
    phone: phone ?? '',
    email: email ?? '',
    gender,
    headline,
    status: 'contratado',
    education: [],
    experience,
    skills: [],
    references: [],
  };
}

/** Busca la ficha completa de un empleado por su numero de documento. */
async function obtenerEmpleadoPorCedula(cedula: string): Promise<EmployeeItem | undefined> {
  const limpia = normalizarDocumento(cedula);
  if (!limpia) return undefined;
  const employees = await db.employees.toArray();
  return employees.find(
    (e) => normalizarDocumento(e.candidateData?.documentNumber) === limpia
  );
}

/** Crea o actualiza la ficha del empleado a partir de su historial documental. */
export async function crearOActualizarEmpleadoDesdeHistorial(input: {
  results: ExtractedDocumentData[];
  cedula: string;
  candidato?: CandidateFormData;
  estado: 'activo' | 'inactivo';
  fechaSalida?: string;
  razonSalida?: TerminationReason;
}): Promise<EmployeeItem> {
  const limpia = normalizarDocumento(input.cedula);
  const existente = limpia ? await obtenerEmpleadoPorCedula(limpia) : undefined;

  const candidateData =
    input.candidato ?? candidateDataDesdeHistorial(input.results, limpia);

  const now = new Date().toISOString();

  if (existente) {
    // Sobre la ficha existente no se pisa la informacion valida ya registrada.
    const actualizado: EmployeeItem = {
      ...existente,
      candidateData: {
        ...existente.candidateData,
        ...candidateData,
        documentType: existente.candidateData.documentType || candidateData.documentType,
        documentNumber: existente.candidateData.documentNumber || candidateData.documentNumber,
      },
      status: input.estado,
      terminationDate:
        input.estado === 'inactivo' ? input.fechaSalida ?? existente.terminationDate : undefined,
      terminationReason:
        input.estado === 'inactivo' ? input.razonSalida ?? existente.terminationReason : undefined,
      // `hireDate` es obligatorio: si no hay contrato del que sacarla, se
      // conserva la que ya tenia la ficha.
      hireDate: existente.hireDate || fechaDePrimerContrato(input.results) || existente.hireDate,
      updatedAt: now,
    };
    await db.employees.put(actualizado);
    await queueMutation('update', 'employees', actualizado.id, actualizado as unknown as Record<string, unknown>);
    return actualizado;
  }

  // Nueva ficha de empleado.
  const nuevo: EmployeeItem = {
    id: `emp-${Date.now()}`,
    employeeCode: `ROS-${Math.floor(1000 + Math.random() * 9000)}`,
    status: input.estado,
    hireDate: fechaDePrimerContrato(input.results) || new Date().toISOString().split('T')[0],
    terminationDate: input.estado === 'inactivo' ? input.fechaSalida : undefined,
    terminationReason: input.estado === 'inactivo' ? input.razonSalida : undefined,
    candidateData,
    memoCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.employees.put(nuevo);
  await queueMutation('create', 'employees', nuevo.id, nuevo as unknown as Record<string, unknown>);

  // Se vinculan los documentos de historial ya guardados por cedula a la ficha.
  await vincularExpedientePorCedula(nuevo.id, limpia);

  return nuevo;
}

/** Vincula los documentos del expediente por cedula al empleado recien creado. */
async function vincularExpedientePorCedula(employeeId: string, cedula: string): Promise<void> {
  const docs = await db.employeeDocuments.where('workerDocumentNumber').equals(cedula).toArray();
  for (const doc of docs) {
    if (!doc.employeeId) {
      const actualizado = {
        ...doc,
        employeeId,
        matchedEmployeeId: employeeId,
        updatedAt: new Date().toISOString(),
      };
      await db.employeeDocuments.put(actualizado);
      await queueMutation('update', 'employee_documents', doc.id, actualizado as unknown as Record<string, unknown>);
    }
  }
}

/** Fecha de inicio del primer contrato encontrado (para el campo hireDate). */
function fechaDePrimerContrato(results: ExtractedDocumentData[]): string | undefined {
  const fechas = results
    .map((r) => r.contractData?.startDate)
    .filter((f): f is string => Boolean(f))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  return fechas[0];
}

/** Reparte un nombre completo en nombres/apellidos de forma segura. */
function repartirNombreDe(nombre?: string): { firstNames: string; lastNames: string } {
  const partes = (nombre ?? '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return { firstNames: '', lastNames: '' };
  if (partes.length === 1) return { firstNames: partes[0], lastNames: '' };
  if (partes.length === 2) return { firstNames: partes[0], lastNames: partes[1] };
  // Convencion colombiana: 2 primeros nombres, resto apellidos.
  return { firstNames: partes.slice(0, 2).join(' '), lastNames: partes.slice(2).join(' ') };
}

/** Localiza una fecha ISO en un texto suelto (para la razon de renuncia). */
function fechaEnTexto(texto: string): string | undefined {
  const m = texto.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
  if (!m) return undefined;
  const [, d, mo, y] = m;
  const anio = y.length === 2 ? `20${y}` : y;
  return `${anio}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** Cedula detectada en un resultado, con prioridad a los datos estructurados. */
function cedulaDeResultado(r: ExtractedDocumentData): string | undefined {
  const candidato = r.candidateData?.documentNumber;
  if (candidato) return candidato;
  const contrato = r.contractData?.workerDocumentNumber;
  if (contrato) return contrato;
  const id = r.idCardData?.documentNumber;
  if (id) return id;
  const salud = r.healthData?.documentNumber;
  if (salud) return salud;
  const liquidacion = r.liquidacionData?.workerDocumentNumber;
  if (liquidacion) return liquidacion;
  return buscarCedulaEnTexto(r.extractedText);
}
