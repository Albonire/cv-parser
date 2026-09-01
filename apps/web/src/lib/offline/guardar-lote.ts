import { db } from './db';
import { queueMutation } from './sync';
import { ExtractedDocumentData } from '../../types/reader';
import { EmployeeItem } from '../../types/employee';
import { ContractFormData } from '../../types/contract';
import { IdCardFormData } from '../../types/id-card';
import { HealthFormData } from '../../types/health';
import { MemorandumItem, MemorandumType } from '../../types/memorandum';
import { AlertItem } from '../../types/alert';
import { DocumentCategory, EmployeeDocumentRecord } from '../../types/employee-document';
import { guardarLiquidacionDesdeOcr, vincularLiquidacionAlEmpleado } from './liquidacion';
import { construirExpediente, guardarDocumentoExpediente, normalizarDocumento } from './expediente';
import { clasificarHistorial } from '../ocr/document-classifier';
import { writeAudit } from '../audit';

/**
 * Guarda un lote completo de documentos de un empleado en sus tablas respectivas.
 * 
 * El flujo es:
 * 1. Recorre cada resultado del OCR (results).
 * 2. Segun el tipo (contractData, liquidacionData, memorandoData, etc.),
 *    lo guarda en su tabla (contracts, liquidaciones, memoranda, etc.).
 * 3. Incrementa contadores en el empleado (memoCount, etc.) segun RN-2.
 * 4. Vincula cada documento al expediente del empleado con su imagen original.
 * 5. Persiste todo con sincronizacion offline.
 * 
 * Precondiciones:
 * - El empleado ya debe existir en db.employees (creado previamente).
 * - Cada file en files[] debe corresponder al orden de results[].
 */
/**
 * Registra el documento en el expediente del empleado.
 *
 * Reusa `construirExpediente`, que es quien sabe rellenar la ficha completa
 * (nombre y cedula del trabajador, texto, archivo de origen, fecha, confianza,
 * metodo y la imagen realzada en base64). Las llamadas de este modulo pasaban
 * un objeto suelto con `file` y `rawData`, campos que la ficha no tiene, y por
 * eso el proyecto no compilaba.
 */
async function registrarEnExpediente(
  result: ExtractedDocumentData,
  categoria: DocumentCategory,
  file: File | undefined,
  employeeId: string,
  cedula: string
): Promise<void> {
  if (!file) return;

  await guardarDocumentoExpediente({
    ...(await construirExpediente(result, categoria, file)),
    employeeId,
    workerDocumentNumber: cedula,
  });
}

export async function guardarLoteEmpleado(input: {
  employee: EmployeeItem;
  cedula: string;
  results: ExtractedDocumentData[];
  files: File[];
}): Promise<void> {
  const { employee, cedula, results, files } = input;
  const limpia = normalizarDocumento(cedula);
  if (!limpia) throw new Error(`Cedula invalida: ${cedula}`);

  let memoCount = employee.memoCount || 0;
  const alertasNuevas: AlertItem[] = [];
  const empleadoActualizado: EmployeeItem = { ...employee };
  let hayCambios = false;

  // Recorre cada documento del lote.
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const file = files[i];
    const categoria = clasificarHistorial(result.extractedText);

    try {
      // --- MEMORANDO / LLAMADO DE ATENCION ---
      if (
        result.memorandoData ||
        categoria === 'memorando' ||
        categoria === 'llamado_atencion'
      ) {
        const memoData = result.memorandoData;
        const memoType: MemorandumType = memoData?.memoType === 'amonestacion_disciplinaria'
          ? 'amonestacion_disciplinaria'
          : memoData?.memoType === 'amonestacion_preventiva'
          ? 'amonestacion_preventiva'
          : 'llamado_atencion';

        const newMemo: MemorandumItem = {
          id: `memo-${Date.now()}-${i}`,
          employeeId: employee.id,
          employeeName: `${employee.candidateData.firstNames} ${employee.candidateData.lastNames}`,
          memoType,
          subject: memoData?.subject || `Llamado de atención`,
          description: memoData?.description || result.extractedText.slice(0, 500),
          memoDate: memoData?.memoDate ?? '',
          responsiblePerson: memoData?.responsiblePerson || 'Gestion Humana - Rosimar S.A.S.',
          status: 'registrado',
          createdAt: new Date().toISOString(),
        };
        await db.memoranda.put(newMemo);
        await queueMutation('create', 'memoranda', newMemo.id, newMemo as unknown as Record<string, unknown>);

        // Incrementar contador RN-2
        memoCount++;
        empleadoActualizado.memoCount = memoCount;
        hayCambios = true;

        // Generar alerta si >= 3
        if (memoCount >= 3 && memoCount === 3) {
          // Solo en la transicion a 3 (evitar alertas duplicadas).
          const alerta: AlertItem = {
            id: `alert-memo-${Date.now()}-${i}`,
            employeeId: employee.id,
            employeeName: `${employee.candidateData.firstNames} ${employee.candidateData.lastNames}`,
            alertType: 'limite_memorandos',
            severity: 'critical',
            title: `Alerta RN-2: 3 Memorandos acumulados - ${employee.candidateData.firstNames} ${employee.candidateData.lastNames}`,
            description: `El empleado ha acumulado ${memoCount} llamados de atención o amonestaciones. El sistema invita a la revisión manual del contrato laboral.`,
            status: 'pendiente',
            createdAt: new Date().toISOString(),
          };
          alertasNuevas.push(alerta);
          await db.alerts.put(alerta);
        }

        // Guardar documento en expediente.
        await registrarEnExpediente(result, 'memorando', file, employee.id, limpia);
      }

      // --- LIQUIDACION ---
      if (result.liquidacionData || categoria === 'liquidacion') {
        const liquidacionData = result.liquidacionData;
        const liq = await guardarLiquidacionDesdeOcr(limpia, liquidacionData!);

        // RN-5: la liquidacion es prueba de salida; la salida posterior a un
        // contrato vigente lo invalida. Nunca se deriva de la fecha actual.
        empleadoActualizado.status = 'inactivo';
        empleadoActualizado.terminationDate =
          liquidacionData?.fechaRetiro ?? empleadoActualizado.terminationDate;
        empleadoActualizado.terminationReason =
          empleadoActualizado.terminationReason ?? 'terminacion_unilateral_empleador';
        hayCambios = true;

        // Vincular al empleado recien creado.
        if (liq && !liq.employeeId) {
          await vincularLiquidacionAlEmpleado(limpia, employee.id);
        }

        // Guardar documento en expediente.
        await registrarEnExpediente(result, 'liquidacion', file, employee.id, limpia);
      }

      // --- RENUNCIA ---
      if (categoria === 'renuncia') {
        // La renuncia no tiene formulario estructurado, pero es evidencia de
        // salida: marca al empleado como inactivo con razon 'renuncia'.
        const fechaSalida = fechaEnTexto(result.extractedText);
        empleadoActualizado.status = 'inactivo';
        empleadoActualizado.terminationDate = fechaSalida ?? empleadoActualizado.terminationDate;
        empleadoActualizado.terminationReason = empleadoActualizado.terminationReason ?? 'renuncia';
        hayCambios = true;

        await registrarEnExpediente(result, 'renuncia', file, employee.id, limpia);
      }

      // --- CONTRATO ---
      if (result.contractData || categoria === 'contrato') {
        const contractData = result.contractData;
        if (contractData) {
          const contract: ContractFormData = {
            ...contractData,
            id: `contract-${Date.now()}-${i}`,
            employeeId: employee.id,
          };
          await db.contracts.put(contract);
          await queueMutation(
            'create',
            'contracts',
            contract.id!,
            contract as unknown as Record<string, unknown>
          );

          // Actualizar empleado: activeContract guarda el contrato, no su id.
          empleadoActualizado.activeContract = contract;
          hayCambios = true;

          // Guardar documento en expediente.
          await registrarEnExpediente(result, 'contrato', file, employee.id, limpia);
        }
      }

      // --- CEDULA ---
      if (result.idCardData || categoria === 'cedula') {
        const idCardData = result.idCardData;
        if (idCardData) {
          const idCard: IdCardFormData = {
            ...idCardData,
            id: `idcard-${Date.now()}-${i}`,
          };
          await db.idCards.put(idCard);
          await queueMutation('create', 'idCards', idCard.id ?? '', idCard as unknown as Record<string, unknown>);

          // Guardar documento en expediente.
          await registrarEnExpediente(result, 'cedula', file, employee.id, limpia);
        }
      }

      // --- EPS / SALUD ---
      if (result.healthData || categoria === 'salud') {
        const healthData = result.healthData;
        if (healthData) {
          const health: HealthFormData = {
            ...healthData,
            id: `health-${Date.now()}-${i}`,
          };
          await db.healthAffiliations.put(health);
          await queueMutation(
            'create',
            'healthAffiliations',
            health.id ?? '',
            health as unknown as Record<string, unknown>
          );

          // Actualizar empleado: healthData.
          empleadoActualizado.healthData = health;
          hayCambios = true;

          // Guardar documento en expediente.
          await registrarEnExpediente(result, 'salud', file, employee.id, limpia);
        }
      }

      // --- FUNCIONES DE CARGO ---
      if (result.funcionesData) {
        const funcionesData = result.funcionesData;

        // Integrar funciones en el candidateData del empleado (experience[].responsibilities).
        if (funcionesData.position || funcionesData.funciones.length > 0) {
          const headline = funcionesData.position || empleadoActualizado.candidateData.headline || '';
          const responsibilities = funcionesData.funciones.join('; ');

          // Agregar a experience si no existe una entrada para este cargo.
          if (!empleadoActualizado.candidateData.experience) {
            empleadoActualizado.candidateData.experience = [];
          }

          const existeExperiencia = empleadoActualizado.candidateData.experience.find(
            (exp) => exp.position === headline
          );
          if (!existeExperiencia) {
            empleadoActualizado.candidateData.experience.push({
              id: `exp-${Date.now()}-${i}`,
              company: 'Rosimar S.A.S.',
              position: headline,
              responsibilities,
              isCurrent: true,
            });
          }

          // Actualizar headline de la ficha si no existe.
          if (!empleadoActualizado.candidateData.headline) {
            empleadoActualizado.candidateData.headline = headline;
          }

          hayCambios = true;
        }

        // Guardar documento en expediente.
        await registrarEnExpediente(result, 'funciones', file, employee.id, limpia);
      }
    } catch (err) {
      console.error(`Error procesando documento ${i} (${result.fileName}):`, err);
      await writeAudit('other', 'guardar_lote', employee.id, `Fallo al procesar ${result.fileName}: ${err}`);
      // Continua con el siguiente documento en lugar de abortar.
    }
  }

  // --- PERSISTIR CAMBIOS EN EL EMPLEADO ---
  if (hayCambios) {
    empleadoActualizado.updatedAt = new Date().toISOString();
    await db.employees.put(empleadoActualizado);
    await queueMutation('update', 'employees', employee.id, empleadoActualizado as unknown as Record<string, unknown>);
  }

  // --- GUARDAR ALERTAS NUEVAS ---
  for (const alerta of alertasNuevas) {
    await db.alerts.put(alerta);
    await queueMutation('create', 'alerts', alerta.id, alerta as unknown as Record<string, unknown>);
  }

  // Auditoria.
  await writeAudit(
    'create',
    'lote',
    employee.id,
    `Lote guardado: ${results.length} documentos, ${memoCount} memorandos`
  );
}

/** Localiza una fecha ISO en un texto suelto (para la razon de renuncia). */
function fechaEnTexto(texto: string): string | undefined {
  const m = texto.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
  if (!m) return undefined;
  const [, d, mo, y] = m;
  const anio = y.length === 2 ? `20${y}` : y;
  return `${anio}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}
