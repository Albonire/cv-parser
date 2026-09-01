import { db } from './db';
import { normalizarDocumento } from './expediente';
import { EmployeeItem, TerminationReason } from '../../types/employee';
import { ContractFormData } from '../../types/contract';
import { MemorandumItem } from '../../types/memorandum';
import { EmployeeStatusHistoryItem } from '../../types/employee-status-history';
import { obtenerLineaTiempoEmpleado } from './status-history';

/**
 * Historial laboral de un empleado DENTRO de Rosimar.
 *
 * Cuando el Lector detecta la cedula de un trabajador que ya esta registrado como
 * empleado (activo o inactivo), este modulo rescata su historial interno: estado,
 * fecha de ingreso/salida, razon de salida, contratos (rol/salario/fechas) y
 * memorandos. Se muestra en el Lector junto a los datos leidos de las fotos para
 * que RRHH tenga la foto completa de la persona en la empresa.
 *
 * El historial registrado NO se modifica al leer documentos: solo se consulta
 * para mostrar. Los documentos leidos se adjuntan al expediente por separado.
 */

export interface HistorialEmpleado {
  empleado: EmployeeItem;
  /** Contratos del empleado (por employeeId o por documento), sin ordenar. */
  contratos: ContractFormData[];
  /** Memorandos del empleado. */
  memorandos: MemorandumItem[];
  /** Rol actual: position del contrato vigente o del mas reciente. */
  rolActual?: string;
  /** Numero de documentos ya guardados en el expediente del empleado. */
  numDocumentosExpediente: number;
}

export interface HistorialEmpleadoConLineaTiempo extends HistorialEmpleado {
  /** Linea de tiempo de estados (contratado / inactivo / reingreso), ordenada. */
  lineaTiempo: EmployeeStatusHistoryItem[];
}

/**
 * Busca un empleado por su numero de documento (cedula/nit) y rescata su
 * historial interno (contratos, memorandos, documentos de expediente).
 * Devuelve `null` cuando el trabajador NO esta registrado como empleado en
 * Rosimar (p. ej. un candidato aun no contratado).
 */
export async function obtenerHistorialEmpleado(
  cedula: string
): Promise<HistorialEmpleadoConLineaTiempo | null> {
  const limpia = normalizarDocumento(cedula);
  if (!limpia) return null;

  const employees = await db.employees.toArray();
  const empleado = employees.find(
    (e) => normalizarDocumento(e.candidateData?.documentNumber) === limpia
  );
  if (!empleado) return null;

  const [contratosPorId, contratosPorDoc] = await Promise.all([
    db.contracts.where('employeeId').equals(empleado.id).toArray(),
    db.contracts.where('workerDocumentNumber').equals(limpia).toArray(),
  ]);

  const porId = new Map(contratosPorId.map((c) => [c.id ?? c.workerDocumentNumber, c]));
  const contratos = [...contratosPorId];
  for (const c of contratosPorDoc) {
    const clave = c.id ?? c.workerDocumentNumber;
    if (!porId.has(clave)) contratos.push(c);
  }

  const memorandos = await db.memoranda.where('employeeId').equals(empleado.id).toArray();
  const numDocumentosExpediente = await db.employeeDocuments
    .where('employeeId')
    .equals(empleado.id)
    .count();
  const lineaTiempo = await obtenerLineaTiempoEmpleado(empleado.id);

  return {
    empleado,
    contratos,
    memorandos,
    rolActual: calcularRolActual(contratos),
    numDocumentosExpediente,
    lineaTiempo,
  };
}

/** Rol actual: position del contrato vigente o, a falta de este, del mas reciente. */
export function calcularRolActual(contratos: ContractFormData[]): string | undefined {
  if (contratos.length === 0) return undefined;
  const vigente = contratos.find((c) => c.status === 'vigente' && c.position);
  if (vigente) return vigente.position;
  const ordenados = [...contratos].sort(
    (a, b) => new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime()
  );
  return ordenados[0]?.position || undefined;
}

const RAZONES_LABEL: Partial<Record<TerminationReason, string>> = {
  renuncia: 'Renuncia',
  terminacion_unilateral_empleador: 'Terminacion unilateral del empleador',
  mutuo_acuerdo: 'Mutuo acuerdo',
  finalizacion_obra: 'Finalizacion de obra o labor',
  jubilacion: 'Jubilacion',
  despido_justificado: 'Despido justificado',
  despido_no_justificado: 'Despido no justificado',
  fallecimiento: 'Fallecimiento',
  otra: 'Otra',
};

/** Etiqueta legible de la razon de salida. */
export function etiquetaRazonSalida(razon?: TerminationReason): string | undefined {
  return razon ? RAZONES_LABEL[razon] ?? razon : undefined;
}

export interface AvisoHistorial {
  tipo: 'dato' | 'aviso';
  texto: string;
}

/**
 * Genera avisos sobre datos esenciales del historial: marca explicitamente
 * cuando uno falta ("No se encontro...") para que no quede en silencio. Solo
 * depende del historial (puro, testeable sin IndexedDB).
 */
export function mensajesHistorial(historial: HistorialEmpleado): AvisoHistorial[] {
  const avisos: AvisoHistorial[] = [];
  const { empleado, contratos } = historial;

  if (empleado.status === 'inactivo') {
    if (!empleado.terminationDate) {
      avisos.push({
        tipo: 'aviso',
        texto: 'No se encontro la fecha de salida del empleado.',
      });
    }
    if (!empleado.terminationReason) {
      avisos.push({
        tipo: 'aviso',
        texto: 'No se encontro la razon de salida en las fotos ni en el registro de Rosimar.',
      });
    }
  }

  if (empleado.status === 'activo' && !empleado.activeContract && contratos.length === 0) {
    avisos.push({
      tipo: 'aviso',
      texto: 'No se encontro un contrato vigente registrado para este empleado.',
    });
  }

  if (empleado.memoCount >= 3) {
    avisos.push({
      tipo: 'aviso',
      texto:
        'El empleado acumula 3 o mas memorandos (RN-2): requiere revision manual del contador.',
    });
  }

  if (contratos.length === 0 && empleado.status === 'activo') {
    avisos.push({
      tipo: 'aviso',
      texto: 'No se encontraron contratos registrados. Si aparecen en las fotos, se mostraran abajo.',
    });
  }

  return avisos;
}
