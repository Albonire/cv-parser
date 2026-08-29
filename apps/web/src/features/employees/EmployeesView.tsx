import React, { useState } from 'react';
import { EmployeeItem, TerminationReason } from '../../types/employee';
import { db } from '../../lib/offline/db';
import { queueMutation } from '../../lib/offline/sync';
import { Briefcase01Icon, Alert02Icon, UserRemove01Icon, CheckmarkCircle01Icon, Search01Icon, Cancel01Icon } from 'hugeicons-react';

interface EmployeesViewProps {
  employees: EmployeeItem[];
  onReload: () => void;
  onNavigateToMemo?: (employeeId: string) => void;
}

export const EmployeesView: React.FC<EmployeesViewProps> = ({
  employees,
  onReload,
  onNavigateToMemo,
}) => {
  const [activeTab, setActiveTab] = useState<'activo' | 'inactivo'>('activo');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedForExit, setSelectedForExit] = useState<EmployeeItem | null>(null);

  // Formulario de salida
  const [terminationDate, setTerminationDate] = useState(new Date().toISOString().split('T')[0]);
  const [terminationReason, setTerminationReason] = useState<TerminationReason>('renuncia');

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
      const updated: EmployeeItem = {
        ...selectedForExit,
        status: 'inactivo',
        terminationDate,
        terminationReason,
        updatedAt: new Date().toISOString(),
      };

      await db.employees.put(updated);
      await queueMutation("update", "employees", updated.id, updated as unknown as Record<string, unknown>);
      alert(`Empleado ${selectedForExit.candidateData.firstNames} ${selectedForExit.candidateData.lastNames} registrado como inactivo.`);
      setSelectedForExit(null);
      onReload();
    } catch (err) {
      console.error(err);
      alert('Error al desactivar el empleado.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado y Filtros */}
      <div className="bg-white p-4 rounded-xl border border-navy-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Briefcase01Icon className="h-6 w-6 text-brand-600" />
          <h2 className="text-lg font-bold text-navy-900">
            Plantilla Laboral de Empleados ({employees.filter((e) => e.status === 'activo').length} Activos)
          </h2>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex bg-navy-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('activo')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'activo' ? 'bg-white text-brand-700 shadow-sm' : 'text-navy-600 hover:text-navy-900'
              }`}
            >
              Activos ({employees.filter((e) => e.status === 'activo').length})
            </button>
            <button
              onClick={() => setActiveTab('inactivo')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'inactivo' ? 'bg-white text-navy-900 shadow-sm' : 'text-navy-600 hover:text-navy-900'
              }`}
            >
              Inactivos ({employees.filter((e) => e.status === 'inactivo').length})
            </button>
          </div>

          <div className="relative w-48 sm:w-60">
            <Search01Icon className="h-4 w-4 absolute left-3 top-2.5 text-navy-400" />
            <input
              type="text"
              placeholder="Buscar empleado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-navy-300 rounded-lg text-xs focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Tabla de Empleados */}
      <div className="bg-white rounded-xl border border-navy-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-navy-200 text-left text-xs">
            <thead className="bg-navy-50 text-navy-600 font-semibold uppercase tracking-wider">
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
            <tbody className="divide-y divide-navy-100 bg-white">
              {filteredEmployees.map((emp) => {
                const c = emp.candidateData;
                const hasWarning = emp.memoCount >= 3;
                return (
                  <tr key={emp.id} className="hover:bg-navy-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-brand-700">
                      {emp.employeeCode}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-navy-900">
                        {c?.firstNames} {c?.lastNames}
                      </div>
                      <div className="text-[11px] text-navy-500">{c?.headline || 'Empleado Rosimar S.A.S.'}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-navy-700">
                      {c?.documentType} {c?.documentNumber}
                    </td>
                    <td className="px-4 py-3 text-navy-600">
                      {emp.hireDate}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                          hasWarning
                            ? 'bg-red-600 text-white animate-bounce'
                            : emp.memoCount > 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-navy-100 text-navy-700'
                        }`}
                        title={hasWarning ? 'Regla RN-2: 3 memorandos acumulados. Requiere revision manual de contrato.' : ''}
                      >
                        {hasWarning && <Alert02Icon className="h-3 w-3 mr-1" />}
                        {emp.memoCount}
                      </span>
                    </td>
                    {activeTab === 'inactivo' && (
                      <td className="px-4 py-3 text-navy-600 capitalize">
                        {emp.terminationReason?.replace(/_/g, ' ') || 'No especificada'}
                        <div className="text-[10px] text-navy-400">Salida: {emp.terminationDate}</div>
                      </td>
                    )}
                    <td className="px-4 py-3 text-right space-x-2">
                      {onNavigateToMemo && (
                        <button
                          onClick={() => onNavigateToMemo(emp.id)}
                          className="px-2 py-1 bg-navy-100 hover:bg-navy-200 text-navy-800 rounded text-[11px] font-medium"
                        >
                          Memorandos
                        </button>
                      )}
                      {emp.status === 'activo' && (
                        <button
                          onClick={() => setSelectedForExit(emp)}
                          className="inline-flex items-center px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-[11px] font-semibold"
                          title="Registrar Salida (RN-5)"
                        >
                          <UserRemove01Icon className="h-3.5 w-3.5 mr-1" />
                          Desactivar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-navy-400 italic">
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
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-navy-200">
              <h3 className="text-base font-bold text-navy-900 flex items-center text-red-600">
                <UserRemove01Icon className="h-5 w-5 mr-2" />
                Registrar Salida de Empleado (RN-5)
              </h3>
              <button onClick={() => setSelectedForExit(null)} className="text-navy-400 hover:text-navy-700">
                <Cancel01Icon className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-navy-600">
              Registrar la salida de <strong>{selectedForExit.candidateData.firstNames} {selectedForExit.candidateData.lastNames}</strong> ({selectedForExit.employeeCode}).
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-navy-700 mb-1">Fecha de Salida *</label>
                <input
                  type="date"
                  value={terminationDate}
                  onChange={(e) => setTerminationDate(e.target.value)}
                  className="w-full px-3 py-2 border border-navy-300 rounded text-xs focus:ring-1 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-navy-700 mb-1">Razon de la Salida *</label>
                <select
                  value={terminationReason}
                  onChange={(e) => setTerminationReason(e.target.value as TerminationReason)}
                  className="w-full px-3 py-2 border border-navy-300 rounded text-xs bg-white focus:ring-1 focus:ring-red-500 focus:outline-none"
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

            <div className="pt-3 border-t border-navy-200 flex justify-end gap-2">
              <button
                onClick={() => setSelectedForExit(null)}
                className="px-3 py-1.5 bg-navy-100 hover:bg-navy-200 text-navy-800 rounded text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleInactivateEmployee}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold"
              >
                Confirmar Desactivacion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
