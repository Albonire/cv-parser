import React, { useMemo, useState } from 'react';
import { EmployeeDocumentRecord, DocumentCategory } from '../../types/employee-document';
import { EmployeeItem } from '../../types/employee';
import { ContractFormData } from '../../types/contract';
import { MemorandumItem } from '../../types/memorandum';
import { LiquidacionRecord } from '../../types/liquidacion-record';
import { db } from '../../lib/offline/db';
import { queueMutation } from '../../lib/offline/sync';
import { normalizarDocumento } from '../../lib/offline/expediente';
import { ArchiveIcon, Link04Icon, ViewIcon } from 'hugeicons-react';

interface ExpedienteViewProps {
  documents: EmployeeDocumentRecord[];
  employees: EmployeeItem[];
  contracts: ContractFormData[];
  memoranda: MemorandumItem[];
  liquidaciones: LiquidacionRecord[];
  /** Permite editar el expediente (vincular documentos a empleados). */
  canManage?: boolean;
  preselectedEmployeeId?: string;
  onReload: () => void;
}

const CATEGORIA_LABEL: Record<DocumentCategory, string> = {
  contrato: 'Contrato laboral',
  liquidacion: 'Liquidacion final',
  memorando: 'Memorando',
  llamado_atencion: 'Llamado de atencion',
  renuncia: 'Renuncia',
  funciones: 'Funciones de cargo',
  salud: 'Seguridad social / EPS',
  cedula: 'Cedula de ciudadania',
  hoja_de_vida: 'Hoja de vida',
  desconocido: 'Documento',
};

const CATEGORIA_BADGE: Record<DocumentCategory, string> = {
  contrato: 'bg-mist text-ink',
  liquidacion: 'bg-signal-blue/10 text-signal-blue',
  memorando: 'bg-warning-surface text-warning',
  llamado_atencion: 'bg-warning-surface text-warning',
  renuncia: 'bg-mist text-steel',
  funciones: 'bg-mist text-steel',
  salud: 'bg-signal-blue/10 text-signal-blue',
  cedula: 'bg-mist text-ink',
  hoja_de_vida: 'bg-signal-blue/10 text-signal-blue',
  desconocido: 'bg-mist text-steel',
};

type FiltroEmpleado = string | 'todos' | 'sin_vincular';

/** Numero de grupos (empleados) que se muestran por pagina. */
const PAGE_SIZE = 6;

interface FilaDeSeccion {
  key: string;
  titulo: string;
  subtitulo?: string;
  docs: EmployeeDocumentRecord[];
}

export const ExpedienteView: React.FC<ExpedienteViewProps> = ({
  documents,
  employees,
  contracts,
  memoranda,
  liquidaciones,
  canManage = false,
  preselectedEmployeeId,
  onReload,
}) => {
  const [filtro, setFiltro] = useState<FiltroEmpleado>(
    preselectedEmployeeId ?? 'todos'
  );
  const [expandido, setExpandido] = useState<string | null>(null);
  const [pagina, setPagina] = useState(0);

  const empleadoDeDoc = useMemo(() => {
    const porId = new Map(employees.map((e) => [e.id, e]));
    const porCedula = new Map<string, EmployeeItem>();
    for (const e of employees) {
      const doc = normalizarDocumento(e.candidateData?.documentNumber);
      if (doc && !porCedula.has(doc)) porCedula.set(doc, e);
    }
    return (doc: EmployeeDocumentRecord): EmployeeItem | undefined => {
      if (doc.employeeId) return porId.get(doc.employeeId);
      const cedula = normalizarDocumento(doc.workerDocumentNumber);
      return (cedula && porCedula.get(cedula)) || undefined;
    };
  }, [employees]);

  const filtradas = useMemo(() => {
    if (filtro === 'todos') return documents;
    if (filtro === 'sin_vincular') {
      return documents.filter((d) => !empleadoDeDoc(d));
    }
    const emp = employees.find((e) => e.id === filtro);
    if (!emp) return [];
    const empDoc = normalizarDocumento(emp.candidateData?.documentNumber);
    return documents.filter((d) => {
      if (d.employeeId === emp.id) return true;
      if (empDoc && normalizarDocumento(d.workerDocumentNumber) === empDoc) return true;
      return false;
    });
  }, [documents, filtro, employees, empleadoDeDoc]);

  const ordenadas = useMemo(
    () =>
      [...filtradas].sort(
        (a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime()
      ),
    [filtradas]
  );

  /** Documentos agrupados por empleado; los sin vincular van al final. */
  const secciones = useMemo<FilaDeSeccion[]>(() => {
    const grupos = new Map<string, EmployeeDocumentRecord[]>();

    for (const doc of ordenadas) {
      const emp = empleadoDeDoc(doc);
      const key = emp
        ? `emp-${emp.id}`
        : `anon-${doc.workerName ?? ''}${doc.workerDocumentNumber ?? ''}`;
      const arr = grupos.get(key) ?? [];
      arr.push(doc);
      grupos.set(key, arr);
    }

    const conEmpleado: FilaDeSeccion[] = [];
    const anonimos: FilaDeSeccion[] = [];

    for (const [key, docs] of grupos) {
      const emp = key.startsWith('emp-')
        ? employees.find((e) => `emp-${e.id}` === key)
        : undefined;
      const fechaNueva = docs[0]?.processedAt;

      const seccion: FilaDeSeccion = emp
        ? {
            key,
            titulo: `${emp.candidateData.firstNames} ${emp.candidateData.lastNames}`,
            subtitulo: `${emp.employeeCode} · ${new Date(fechaNueva).toLocaleDateString('es-CO')}`,
            docs,
          }
        : {
            key,
            titulo: docs[0]?.workerName || 'Sin identificar',
            subtitulo: docs[0]?.workerDocumentNumber
              ? `CC ${docs[0].workerDocumentNumber}`
              : 'Sin vincular a empleado',
            docs,
          };

      if (emp) conEmpleado.push(seccion);
      else anonimos.push(seccion);
    }

    const porNombre = (a: FilaDeSeccion, b: FilaDeSeccion) =>
      a.titulo.localeCompare(b.titulo, 'es');
    return [...conEmpleado.sort(porNombre), ...anonimos.sort(porNombre)];
  }, [ordenadas, employees, empleadoDeDoc]);

  // Paginacion: PAGE_SIZE empleados por pagina.
  const paginas = Math.max(1, Math.ceil(secciones.length / PAGE_SIZE));
  const paginaActual = Math.min(pagina, paginas - 1);
  const visibles = secciones.slice(paginaActual * PAGE_SIZE, (paginaActual + 1) * PAGE_SIZE);

  const handleVincular = async (doc: EmployeeDocumentRecord, employeeId: string) => {
    const actualizado: EmployeeDocumentRecord = {
      ...doc,
      employeeId,
      matchedEmployeeId: employeeId,
      updatedAt: new Date().toISOString(),
    };
    await db.employeeDocuments.put(actualizado);
    await queueMutation('update', 'employee_documents', doc.id, actualizado as unknown as Record<string, unknown>);
    onReload();
  };

  const esSeleccionEmpleado = (f: FiltroEmpleado) => f !== 'todos' && f !== 'sin_vincular';
  const seleccionado = esSeleccionEmpleado(filtro) ? employees.find((e) => e.id === filtro) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 pt-8 sm:flex-row sm:items-center">
        <p className="text-caption text-steel">
          {documents.length} documentos en expediente
          {seleccionado ? ` · ${seleccionado.candidateData.firstNames} ${seleccionado.candidateData.lastNames}` : ''}
        </p>

        <select
          value={filtro}
          onChange={(e) => {
            setFiltro(e.target.value as FiltroEmpleado);
            setPagina(0);
          }}
          aria-label="Filtrar expediente por empleado"
          className="w-64 px-3 py-1.5 border border-fog rounded-lg text-xs bg-paper focus:outline-none"
        >
          <option value="todos">Todos los empleados</option>
          <option value="sin_vincular">Sin vincular a empleado</option>
          <optgroup label="Empleados">
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.candidateData.firstNames} {e.candidateData.lastNames} · {e.employeeCode}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      <div className="bg-paper rounded-lg border border-fog overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-mist text-left text-xs">
            <thead className="bg-mist text-steel font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Empleado</th>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">Origen</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Confianza</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist bg-paper">
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-steel italic">
                    No hay documentos en el expediente para este filtro. Lea los documentos
                    desde el <strong>Lector</strong> y guárdelos en el expediente.
                  </td>
                </tr>
              )}

              {visibles.map((seccion, si) => (
                <React.Fragment key={seccion.key}>
                  {/* Encabezado de agrupacion por empleado */}
                  {!esSeleccionEmpleado(filtro) && (
                    <tr className="bg-mist/60">
                      <td
                        colSpan={6}
                        className={"px-4 py-2.5" + (si > 0 ? " border-t border-fog/60" : "")}
                      >
                        <div className="flex items-baseline justify-between">
                          <span className="font-bold text-ink">{seccion.titulo}</span>
                          <span className="text-[11px] text-steel">
                            {seccion.subtitulo} · {seccion.docs.length} documento{seccion.docs.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}

                  {seccion.docs.map((doc) => {
                    const emp = empleadoDeDoc(doc);
                    const vinculable =
                      !doc.employeeId && emp
                        ? emp
                        : !doc.employeeId && doc.workerDocumentNumber
                        ? null
                        : undefined;
                    return (
                      <React.Fragment key={doc.id}>
                        <tr className="hover:bg-paper transition-colors align-top">
                          <td className="px-4 py-3">
                            {emp ? (
                              <>
                                <div className="font-semibold text-ink">
                                  {emp.candidateData.firstNames} {emp.candidateData.lastNames}
                                </div>
                                <div className="text-[11px] text-steel">{emp.employeeCode}</div>
                              </>
                            ) : (
                              <>
                                <div className="font-semibold text-ink">
                                  {doc.workerName || 'Sin identificar'}
                                </div>
                                <div className="text-[11px] text-steel font-mono">
                                  {doc.workerDocumentNumber ? `CC ${doc.workerDocumentNumber}` : 'Sin vincular'}
                                </div>
                              </>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${CATEGORIA_BADGE[doc.category]}`}>
                              {CATEGORIA_LABEL[doc.category]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-steel">{doc.sourceFileName}</td>
                          <td className="px-4 py-3 text-steel">
                            {new Date(doc.processedAt).toLocaleDateString('es-CO')}
                          </td>
                          <td className="px-4 py-3 text-steel">
                            {Math.round(doc.confidenceScore * 100)}%
                          </td>
                          <td className="px-4 py-3 space-x-2">
                            <button
                              onClick={() => setExpandido(expandido === doc.id ? null : doc.id)}
                              className="inline-flex items-center text-signal-blue text-[11px] font-semibold hover:underline"
                            >
                              <ViewIcon className="h-3.5 w-3.5 mr-1" />
                              {expandido === doc.id ? 'Ocultar' : 'Ver documento'}
                            </button>
                            {vinculable === null && canManage && (
                              <select
                                onChange={(e) => {
                                  if (e.target.value) handleVincular(doc, e.target.value);
                                }}
                                value=""
                                aria-label="Vincular documento a empleado"
                                className="border border-fog rounded px-1 py-0.5 text-[11px] bg-paper"
                              >
                                <option value="">Vincular a...</option>
                                {employees.map((e) => (
                                  <option key={e.id} value={e.id}>
                                    {e.candidateData.firstNames} {e.candidateData.lastNames}
                                  </option>
                                ))}
                              </select>
                            )}
                            {vinculable && canManage && (
                              <button
                                onClick={() => handleVincular(doc, vinculable.id)}
                                className="inline-flex items-center text-signal-blue text-[11px] font-semibold hover:underline"
                              >
                                <Link04Icon className="h-3.5 w-3.5 mr-1" />
                                Vincular a {vinculable.candidateData.firstNames}
                              </button>
                            )}
                          </td>
                        </tr>
                        {expandido === doc.id && (
                          <tr>
                            <td colSpan={6} className="px-6 py-4 bg-mist/40">
                              <div className="flex flex-col gap-4 lg:flex-row">
                                {doc.imageData && (
                                  <div className="shrink-0">
                                    <p className="text-[11px] text-steel font-semibold mb-1">
                                      Imagen del documento:
                                    </p>
                                    <img
                                      src={doc.imageData}
                                      alt={`Documento de ${doc.workerName ?? 'empleado'}`}
                                      className="max-h-72 rounded-lg border border-fog object-contain"
                                    />
                                  </div>
                                )}

                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] text-steel font-semibold mb-1">
                                    Datos extraídos:
                                  </p>
                                  <DatosExtraidos
                                    doc={doc}
                                    contracts={contracts}
                                    liquidaciones={liquidaciones}
                                    memoranda={memoranda}
                                    empleadoId={emp?.id}
                                  />
                                  <details className="mt-2">
                                    <summary className="cursor-pointer text-[11px] font-semibold text-steel hover:text-ink">
                                      Ver texto OCR original
                                    </summary>
                                    <pre className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap text-[11px] font-mono text-ink border border-fog rounded p-2 bg-paper">
                                      {doc.extractedText || 'Sin texto reconocido.'}
                                    </pre>
                                  </details>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginacion entre grupos de empleados */}
      {paginas > 1 && (
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
            disabled={paginaActual === 0}
            className="px-3 py-1.5 border border-fog rounded-lg text-xs font-semibold text-steel enabled:hover:border-rosimar-blue enabled:hover:text-rosimar-blue disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-caption text-steel">
            Página {paginaActual + 1} de {paginas}
          </span>
          <button
            onClick={() => setPagina((p) => Math.min(paginas - 1, p + 1))}
            disabled={paginaActual >= paginas - 1}
            className="px-3 py-1.5 border border-fog rounded-lg text-xs font-semibold text-steel enabled:hover:border-rosimar-blue enabled:hover:text-rosimar-blue disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}

      <p className="text-[11px] text-steel flex items-center gap-1.5">
        <ArchiveIcon className="h-3.5 w-3.5" />
        El expediente conserva la imagen original y el texto reconocido de cada documento del
        historial del empleado (contratos, memorandos, seguridad social, funciones, renuncias).
        Todo se almacena localmente en IndexedDB: costo $0, sin subir archivos a la nube.
      </p>
    </div>
  );
};

/** Datos estructurados relacionados al documento, segun su categoria. */
function DatosExtraidos({
  doc,
  contracts,
  liquidaciones,
  memoranda,
  empleadoId,
}: {
  doc: EmployeeDocumentRecord;
  contracts: ContractFormData[];
  liquidaciones: LiquidacionRecord[];
  memoranda: MemorandumItem[];
  empleadoId?: string;
}) {
  const pares = useMemo(() => {
    const cedula = normalizarDocumento(doc.workerDocumentNumber);

    if (doc.category === 'contrato') {
      const contrato = contracts.find(
        (c) => c.workerDocumentNumber && normalizarDocumento(c.workerDocumentNumber) === cedula
      );
      if (!contrato) return null;
      const monto = (n?: number) => (n ? `$${n.toLocaleString('es-CO')}` : '');
      return [
        ['Empleador', contrato.employerName],
        ['Identificacion del empleador (NIT)', contrato.employerNit],
        ['Domicilio del empleador', contrato.employerAddress],
        ['Correo electronico del empleador', contrato.employerEmail],
        ['Trabajador', contrato.workerName],
        ['Fecha de nacimiento', contrato.workerDateOfBirth],
        ['Identificacion del trabajador', contrato.workerDocumentNumber],
        ['Domicilio del trabajador', contrato.workerAddress],
        ['Correo electronico del trabajador', contrato.workerEmail],
        ['Cargo', contrato.position],
        ['Salario', monto(contrato.salary)],
        ['Forma de pago', etiquetaFrecuenciaPago(contrato.paymentFrequency)],
        ['Tipo de contrato', etiquetaTipoContrato(contrato.contractType)],
        ['Duracion', contrato.durationMonths ? `${contrato.durationMonths} meses` : ''],
        ['Fecha de iniciacion del contrato', contrato.startDate],
        ['Periodo de prueba', contrato.trialPeriodDays ? `${contrato.trialPeriodDays} dias` : ''],
        ['Fecha de vencimiento del contrato', contrato.endDate],
        ['Preaviso de terminacion / vencimiento', contrato.noticeDays ? `${contrato.noticeDays} dias` : ''],
        ['Lugar de ejecucion del contrato', contrato.executionPlace],
      ].filter((p) => p[1]);
    }

    if (doc.category === 'liquidacion') {
      const liq = liquidaciones.find(
        (l) => l.workerDocumentNumber === cedula
      );
      const d = liq?.liquidacionData;
      if (!d) return null;
      return [
        ['Cargo', d.cargo],
        ['Fecha de retiro', d.fechaRetiro],
        ['Días trabajados', d.diasTrabajados],
        ['Cesantías', d.cesantias ? `$${d.cesantias.toLocaleString('es-CO')}` : ''],
        ['Prima', d.prima ? `$${d.prima.toLocaleString('es-CO')}` : ''],
        ['Vacaciones', d.vacaciones ? `$${d.vacaciones.toLocaleString('es-CO')}` : ''],
        ['Total liquidado', d.totalLiquidacion ? `$${d.totalLiquidacion.toLocaleString('es-CO')}` : ''],
      ].filter((p) => p[1]);
    }

    if (doc.category === 'memorando' || doc.category === 'llamado_atencion') {
      const memos = (empleadoId
        ? memoranda.filter((m) => m.employeeId === empleadoId)
        : []
      ).sort((a, b) => b.memoDate.localeCompare(a.memoDate));
      if (memos.length === 0) return null;
      return memos.slice(0, 3).map<[string, string]>((m) => [
        `${m.memoDate} · ${m.memoType === 'llamado_atencion' ? 'Llamado' : 'Memorando'}`,
        `${m.subject}${m.responsiblePerson ? ` — ${m.responsiblePerson}` : ''}`,
      ]);
    }

    return null;
  }, [doc, contracts, liquidaciones, memoranda, empleadoId]);

  if (!pares) {
    return (
      <p className="text-xs text-steel italic">
        Sin datos estructurados para este documento. Consulta el texto OCR original.
      </p>
    );
  }

  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-0.5 sm:grid-cols-2">
      {pares.map(([clave, valor]) => (
        <div key={clave} className="flex items-baseline justify-between gap-2">
          <dt className="text-steel">{clave}:</dt>
          <dd className="text-right font-semibold text-ink">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

function etiquetaTipoContrato(tipo: ContractFormData['contractType']): string {
  const mapa: Record<ContractFormData['contractType'], string> = {
    termino_fijo: 'A termino fijo',
    indefinido: 'A termino indefinido',
    obra_labor: 'Por obra o labor',
    aprendizaje: 'De aprendizaje',
    tiempo_parcial: 'Tiempo parcial',
    otro: 'Otro',
  };
  return mapa[tipo];
}

function etiquetaFrecuenciaPago(frecuencia: ContractFormData['paymentFrequency']): string {
  const mapa: Record<ContractFormData['paymentFrequency'], string> = {
    mensual: 'Mensual',
    quincenal: 'Quincenal',
    otro: 'Otro',
  };
  return mapa[frecuencia];
}