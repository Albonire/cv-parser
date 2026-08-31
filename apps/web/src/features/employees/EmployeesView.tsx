import React, { useState } from 'react';
import { EmployeeItem, TerminationReason } from '../../types/employee';
import { finalizarEmpleado, reingresarEmpleado } from '../../lib/offline/status-history';
import { Alert02Icon, UserRemove01Icon, Search01Icon, Cancel01Icon, ArchiveIcon, UserAdd01Icon } from 'hugeicons-react';

interface EmployeesViewProps {
  employees: EmployeeItem[];
  onReload: () => void;
  onNavigateToMemo?: (employeeId: string) => void;
  onNavigateToExpediente?: (employeeId: string) => void;
}

export const EmployeesView: React.FC<EmployeesViewProps> = ({
  employees,
  onReload,
  onNavigateToMemo,
  onNavigateToExpediente,
}) => {
  const [activeTab, setActiveTab] = useState<'activo' | 'inactivo'>('activo');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedForExit, setSelectedForExit] = useState<EmployeeItem | null>(null);

  // Formulario de salida
  const [terminationDate, setTerminationDate] = useState(new Date().toISOString().split('T')[0]);
  const [terminationReason, setTerminationReason] = useState<TerminationReason>('renuncia');

  // Formulario de reingreso
  const [rehireTarget, setRehireTarget] = useState<EmployeeItem | null>(null);
  const [rehireDate, setRehireDate] = useState(new Date().toISOString().split('T')[0]);

  const filteredEmployees = employees.filter((e) => {
    const candidate = e.candidateData;
    const name = candidate ? `${candidate.firstNames} ${candidate.lastNames}` : '';
    const doc = candidate ? candidate.documentNumber : '';
    const matchesSearch = `${name} ${doc} ${e.employeeCode}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = e.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const handleInactivateEmployee = async () => {
    if (!selectedForExit) return;

    if (!terminationDate || !terminationReason) {
      alert('Debe especificar la fecha de salida y la razon de salida (Regla RN-5).');
      return;
    }

    try {
      const updated = await finalizarEmpleado({
        empleado: selectedForExit,
        terminationDate,
        terminationReason,
      });
      if (!updated) {
        alert('Debe especificar la fecha de salida y la razon de salida (Regla RN-5).');
        return;
      }
      alert(`Empleado ${selectedForExit.candidateData.firstNames} ${selectedForExit.candidateData.lastNames} registrado como inactivo.`);
      setSelectedForExit(null);
      onReload();
    } catch (err) {
      console.error(err);
      alert('Error al desactivar el empleado.');
    }
  };

  const handleReingresar = async () => {
    if (!rehireTarget) return;
    if (!rehireDate) {
      alert('Debe especificar la fecha de reingreso.');
      return;
    }
    try {
      const updated = await reingresarEmpleado({
        empleado: rehireTarget,
        rehireDate,
        note: 'Reingreso registrado desde Empleados.',
      });
      if (!updated) {
        alert('Debe especificar la fecha de reingreso.');
        return;
      }
      alert(`Empleado ${rehireTarget.candidateData.firstNames} ${rehireTarget.candidateData.lastNames} reingresado exitosamente.`);
      setRehireTarget(null);
      onReload();
    } catch (err) {
      console.error(err);
      alert('Error al reingresar al empleado.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado y Filtros */}
      <div className="flex flex-col items-start justify-between gap-4 pt-8 sm:flex-row sm:items-center">
        <p className="text-caption text-steel">
            {employees.filter((e) => e.status === 'activo').length} activos de {employees.length}
          </p>

        <div className="flex items-center space-x-3">
          <div className="flex bg-mist p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('activo')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'activo' ? 'bg-paper text-ink' : 'text-steel hover:text-ink'
              }`}
            >
              Activos ({employees.filter((e) => e.status === 'activo').length})
            </button>
            <button
              onClick={() => setActiveTab('inactivo')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'inactivo' ? 'bg-paper text-ink' : 'text-steel hover:text-ink'
              }`}
            >
              Inactivos ({employees.filter((e) => e.status === 'inactivo').length})
            </button>
          </div>

          <div className="relative w-48 sm:w-60">
            <Search01Icon className="h-4 w-4 absolute left-3 top-2.5 text-steel" />
            <input
              type="text"
              placeholder="Buscar empleado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-fog rounded-lg text-xs focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Tabla de Empleados */}
      <div className="bg-paper rounded-lg border border-fog overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-mist text-left text-xs">
            <thead className="bg-mist text-steel font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Codigo</th>
                <th className="px-4 py-3">Empleado</th>
                <th className="px-4 py-3">Identificacion</th>
                <th className="px-4 py-3">Fecha Ingreso</th>
                <th className="px-4 py-3 text-center">Memorandos</th>
                {activeTab === 'inactivo' && <th className="px-4 py-3">Razon Salida</th>}
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist bg-paper">
              {filteredEmployees.map((emp) => {
                const c = emp.candidateData;
                const hasWarning = emp.memoCount >= 3;
                return (
                  <tr key={emp.id} className="hover:bg-paper transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-ink">
                      {emp.employeeCode}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink">
                        {c?.firstNames} {c?.lastNames}
                      </div>
                      <div className="text-[11px] text-steel">{c?.headline || 'Empleado Rosimar S.A.S.'}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-ink">
                      {c?.documentType} {c?.documentNumber}
                    </td>
                    <td className="px-4 py-3 text-steel">
                      {emp.hireDate}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                          hasWarning
                            ? 'bg-alert text-paper'
                            : emp.memoCount > 0
                            ? 'bg-warning-surface text-warning'
                            : 'bg-mist text-ink'
                        }`}
                        title={hasWarning ? 'Regla RN-2: 3 memorandos acumulados. Requiere revision manual de contrato.' : ''}
                      >
                        {hasWarning && <Alert02Icon className="h-3 w-3 mr-1" />}
                        {emp.memoCount}
                      </span>
                    </td>
                    {activeTab === 'inactivo' && (
                      <td className="px-4 py-3 text-steel capitalize">
                        {emp.terminationReason?.replace(/_/g, ' ') || 'No especificada'}
                        <div className="text-[10px] text-steel">Salida: {emp.terminationDate}</div>
                      </td>
                    )}
                    <td className="px-4 py-3 text-right space-x-2">
                      {onNavigateToExpediente && (
                        <button
                          onClick={() => onNavigateToExpediente(emp.id)}
                          className="inline-flex items-center rounded-lg border border-fog px-2 py-1 text-[11px] font-semibold text-steel transition-colors hover:border-signal-blue hover:text-signal-blue"
                          title="Ver expediente documental del empleado"
                        >
                          <ArchiveIcon className="h-3.5 w-3.5 mr-1" />
                          Expediente
                        </button>
                      )}
                      {onNavigateToMemo && (
                        <button
                          onClick={() => onNavigateToMemo(emp.id)}
                          className="px-2 py-1 bg-mist hover:bg-fog text-ink rounded text-[11px] font-medium"
                        >
                          Memorandos
                        </button>
                      )}
                      {emp.status === 'activo' && (
                        <button
                          onClick={() => setSelectedForExit(emp)}
                          className="inline-flex items-center rounded-lg border border-fog px-2 py-1 text-[11px] font-semibold text-steel transition-colors hover:border-alert hover:text-alert"
                          title="Registrar Salida (RN-5)"
                        >
                          <UserRemove01Icon className="h-3.5 w-3.5 mr-1" />
                          Desactivar
                        </button>
                      )}
                      {emp.status === 'inactivo' && (
                        <button
                          onClick={() => setRehireTarget(emp)}
                          className="inline-flex items-center rounded-lg border border-fog px-2 py-1 text-[11px] font-semibold text-steel transition-colors hover:border-signal-blue hover:text-signal-blue"
                          title="Reingresar al empleado (nueva vinculacion)"
                        >
                          <UserAdd01Icon className="h-3.5 w-3.5 mr-1" />
                          Reingresar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-steel italic">
                    No hay empleados en este listado. Contrata candidatos desde el modulo de <strong>Candidatos</strong>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Desactivar Empleado con Razon de Salida Obligatoria (RN-5) */}
      {selectedForExit && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-paper rounded-lg max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-fog">
              <h3 className="text-base font-bold text-ink flex items-center text-alert">
            Registrar Salida de Empleado (RN-5)
              </h3>
              <button onClick={() => setSelectedForExit(null)} className="text-steel hover:text-ink">
                <Cancel01Icon className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-steel">
              Registrar la salida de <strong>{selectedForExit.candidateData.firstNames} {selectedForExit.candidateData.lastNames}</strong> ({selectedForExit.employeeCode}).
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-ink mb-1">Fecha de Salida *</label>
                <input
                  type="date"
                  value={terminationDate}
                  onChange={(e) => setTerminationDate(e.target.value)}
                  className="w-full px-3 py-2 border border-fog rounded text-xs"
                />
              </div>

              <div>
                <label className="block font-medium text-ink mb-1">Razon de la Salida *</label>
                <select
                  value={terminationReason}
                  onChange={(e) => setTerminationReason(e.target.value as TerminationReason)}
                  className="w-full px-3 py-2 border border-fog rounded text-xs bg-paper"
                >
                  <option value="renuncia">Renuncia voluntaria</option>
                  <option value="terminacion_unilateral_empleador">Terminacion unilateral por el empleador</option>
                  <option value="mutuo_acuerdo">Mutuo acuerdo</option>
                  <option value="finalizacion_obra">Finalizacion de obra o labor</option>
                  <option value="despido_justificado">Despido justificado</option>
                  <option value="despido_no_justificado">Despido no justificado</option>
                  <option value="jubilacion">Jubilacion</option>
                  <option value="fallecimiento">Fallecimiento</option>
                  <option value="otra">Otra</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-fog flex justify-end gap-2">
              <button
                onClick={() => setSelectedForExit(null)}
                className="px-3 py-1.5 bg-mist hover:bg-fog text-ink rounded text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleInactivateEmployee}
                className="px-4 py-1.5 bg-alert hover:bg-alert text-white rounded text-xs font-semibold"
              >
                Confirmar Desactivacion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reingreso de Empleado */}
      {rehireTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-paper rounded-lg max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-fog">
              <h3 className="text-base font-bold text-ink flex items-center text-signal-blue">
                Reingreso de Empleado
              </h3>
              <button onClick={() => setRehireTarget(null)} className="text-steel hover:text-ink">
                <Cancel01Icon className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-steel">
              Reingresar a <strong>{rehireTarget.candidateData.firstNames} {rehireTarget.candidateData.lastNames}</strong> ({rehireTarget.employeeCode}). Se conserva la historia completa de la salida anterior.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-ink mb-1">Fecha de Reingreso *</label>
                <input
                  type="date"
                  value={rehireDate}
                  onChange={(e) => setRehireDate(e.target.value)}
                  className="w-full px-3 py-2 border border-fog rounded text-xs"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-fog flex justify-end gap-2">
              <button
                onClick={() => setRehireTarget(null)}
                className="px-3 py-1.5 bg-mist hover:bg-fog text-ink rounded text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleReingresar}
                className="px-4 py-1.5 bg-signal-blue hover:bg-signal-blue text-white rounded text-xs font-semibold"
              >
                Confirmar Reingreso
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
