import React, { useMemo, useState } from 'react';
import { EmployeeDocumentRecord, DocumentCategory } from '../../types/employee-document';
import { EmployeeItem } from '../../types/employee';
import { db } from '../../lib/offline/db';
import { queueMutation } from '../../lib/offline/sync';
import { normalizarDocumento } from '../../lib/offline/expediente';
import { ArchiveIcon, Link04Icon, ViewIcon } from 'hugeicons-react';

interface ExpedienteViewProps {
  documents: EmployeeDocumentRecord[];
  employees: EmployeeItem[];
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

export const ExpedienteView: React.FC<ExpedienteViewProps> = ({
  documents,
  employees,
  preselectedEmployeeId,
  onReload,
}) => {
  const [filtro, setFiltro] = useState<FiltroEmpleado>(
    preselectedEmployeeId ?? 'todos'
  );
  const [expandido, setExpandido] = useState<string | null>(null);

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
          onChange={(e) => setFiltro(e.target.value as FiltroEmpleado)}
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
              {ordenadas.map((doc) => {
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
                        {vinculable === null && (
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
                        {vinculable && (
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
                        <td colSpan={6} className="px-4 py-3 bg-mist/40">
                          <div className="flex flex-col gap-3 lg:flex-row">
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
                                Texto reconocido:
                              </p>
                              <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap text-[11px] font-mono text-ink">
                                {doc.extractedText || 'Sin texto reconocido.'}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {ordenadas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-steel italic">
                    No hay documentos en el expediente para este filtro. Lea los documentos
                    desde el <strong>Lector</strong> y guárdelos en el expediente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-steel flex items-center gap-1.5">
        <ArchiveIcon className="h-3.5 w-3.5" />
        El expediente conserva la imagen original y el texto reconocido de cada documento del
        historial del empleado (contratos, memorandos, seguridad social, funciones, renuncias).
        Todo se almacena localmente en IndexedDB: costo $0, sin subir archivos a la nube.
      </p>
    </div>
  );
};
