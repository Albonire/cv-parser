import React, { useState } from 'react';
import { MemorandumItem, MemorandumType } from '../../types/memorandum';
import { EmployeeItem } from '../../types/employee';
import { db } from '../../lib/offline/db';
import { AlertItem } from '../../types/alert';
import { PlusSignIcon, Shield02Icon } from 'hugeicons-react';

interface MemorandaViewProps {
  memoranda: MemorandumItem[];
  employees: EmployeeItem[];
  onReload: () => void;
  preselectedEmployeeId?: string;
}

export const MemorandaView: React.FC<MemorandaViewProps> = ({
  memoranda,
  employees,
  onReload,
  preselectedEmployeeId,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(preselectedEmployeeId || (employees[0]?.id || ''));
  const [memoType, setMemoType] = useState<MemorandumType>('llamado_atencion');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [responsiblePerson, setResponsiblePerson] = useState('Gestion Humana - Rosimar S.A.S.');
  const [memoDate, setMemoDate] = useState(new Date().toISOString().split('T')[0]);

  const handleRegisterMemo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId || !subject || !description) {
      alert('Por favor completa todos los campos requeridos.');
      return;
    }

    const employee = employees.find((emp) => emp.id === selectedEmployeeId);
    if (!employee) return;

    try {
      // 1. Guardar el nuevo memorando
      const newMemo: MemorandumItem = {
        id: `memo-${Date.now()}`,
        employeeId: employee.id,
        employeeName: `${employee.candidateData.firstNames} ${employee.candidateData.lastNames}`,
        memoType,
        subject,
        description,
        memoDate,
        responsiblePerson,
        status: 'registrado',
        createdAt: new Date().toISOString(),
      };
      await db.memoranda.put(newMemo);

      // 2. Incrementar el contador de memorandos en el empleado (RN-2)
      const newCount = (employee.memoCount || 0) + 1;
      const updatedEmployee: EmployeeItem = {
        ...employee,
        memoCount: newCount,
        updatedAt: new Date().toISOString(),
      };
      await db.employees.put(updatedEmployee);

      // 3. Si llega a 3 o mas memorandos, generar alerta informativa de revision de contrato (RN-2)
      if (newCount >= 3) {
        const newAlert: AlertItem = {
          id: `alert-memo-${Date.now()}`,
          employeeId: employee.id,
          employeeName: `${employee.candidateData.firstNames} ${employee.candidateData.lastNames}`,
          alertType: 'limite_memorandos',
          severity: 'critical',
          title: `Alerta RN-2: 3 Memorandos acumulados - ${employee.candidateData.firstNames} ${employee.candidateData.lastNames}`,
          description: `El empleado ha acumulado ${newCount} llamados de atención o amonestaciones. El sistema invita a la revisión manual del contrato laboral.`,
          status: 'pendiente',
          createdAt: new Date().toISOString(),
        };
        await db.alerts.put(newAlert);
      }

      alert('Memorando registrado exitosamente.');
      setShowModal(false);
      setSubject('');
      setDescription('');
      onReload();
    } catch (err) {
      console.error(err);
      alert('Error al registrar el memorando.');
    }
  };

  const getMemoBadge = (type: MemorandumType) => {
    switch (type) {
      case 'llamado_atencion':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-warning-surface text-warning">Llamado de Atencion</span>;
      case 'amonestacion_preventiva':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800">Amonestacion Preventiva</span>;
      case 'amonestacion_disciplinaria':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-alert-surface text-alert">Amonestacion Disciplinaria</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-mist text-ink">Otro</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner de regla de negocio RN-2 */}
      <div className="bg-warning-surface border border-warning rounded-lg p-4 flex items-start space-x-3 text-warning">
        <Shield02Icon className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
        <div className="text-xs">
          <strong className="font-bold">Regla de Negocio RN-2 (Rosimar S.A.S.):</strong> Al acumular 3 memorandos, el contador del empleado se destaca en rojo y se genera una alerta informativa para la revision manual del contrato. El sistema orienta el proceso pero nunca cancela contratos de forma automatica.
        </div>
      </div>

      <div className="flex flex-col items-start justify-between gap-4 pt-8 sm:flex-row sm:items-center">
        <p className="text-caption text-steel">
            {memoranda.length} {memoranda.length === 1 ? 'memorando' : 'memorandos'}
          </p>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center px-4 py-2 bg-signal-blue hover:bg-signal-blue text-white rounded-lg text-xs font-semibold transition-colors shadow-subtle"
        >
          <PlusSignIcon className="h-4 w-4 mr-1" />
          Registrar Nuevo Memorando
        </button>
      </div>

      {/* Tabla de Memorandos */}
      <div className="bg-paper rounded-lg border border-fog overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-mist text-left text-xs">
            <thead className="bg-mist text-steel font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Empleado</th>
                <th className="px-4 py-3">Tipo de Memorando</th>
                <th className="px-4 py-3">Asunto</th>
                <th className="px-4 py-3">Responsable</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist bg-paper">
              {memoranda.map((m) => (
                <tr key={m.id} className="hover:bg-paper transition-colors">
                  <td className="px-4 py-3 text-steel font-mono">{m.memoDate}</td>
                  <td className="px-4 py-3 font-semibold text-ink">{m.employeeName || 'Empleado'}</td>
                  <td className="px-4 py-3">{getMemoBadge(m.memoType)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">{m.subject}</div>
                    <div className="text-[11px] text-steel line-clamp-1">{m.description}</div>
                  </td>
                  <td className="px-4 py-3 text-steel">{m.responsiblePerson}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-mist text-ink capitalize">
                      {m.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                </tr>
              ))}
              {memoranda.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-steel italic">
                    No se han registrado memorandos. Haz clic en "Registrar Nuevo Memorando".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Registrar Memorando */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={handleRegisterMemo} className="bg-paper rounded-lg max-w-lg w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-ink border-b border-fog pb-2">
              Registrar Memorando a Empleado
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-ink mb-1">Empleado *</label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 border border-fog rounded text-xs bg-paper focus:outline-none"
                  required
                >
                  {employees.filter((e) => e.status === 'activo').map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.candidateData.firstNames} {emp.candidateData.lastNames} ({emp.employeeCode}) — Actual: {emp.memoCount} memorandos
                    </option>
                  ))}
                  {employees.length === 0 && (
                    <option value="">No hay empleados activos</option>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-ink mb-1">Tipo de Memorando *</label>
                  <select
                    value={memoType}
                    onChange={(e) => setMemoType(e.target.value as MemorandumType)}
                    className="w-full px-3 py-2 border border-fog rounded text-xs bg-paper"
                  >
                    <option value="llamado_atencion">Llamado de Atencion</option>
                    <option value="amonestacion_preventiva">Amonestacion Preventiva</option>
                    <option value="amonestacion_disciplinaria">Amonestacion Disciplinaria</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-ink mb-1">Fecha *</label>
                  <input
                    type="date"
                    value={memoDate}
                    onChange={(e) => setMemoDate(e.target.value)}
                    className="w-full px-3 py-2 border border-fog rounded text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-ink mb-1">Asunto *</label>
                <input
                  type="text"
                  placeholder="Ej. Incumplimiento reiterado de horario laboral"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-fog rounded text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-ink mb-1">Descripcion Detallada *</label>
                <textarea
                  rows={3}
                  placeholder="Detalle los hechos observados y compromisos..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-fog rounded text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-ink mb-1">Responsable / Emisor</label>
                <input
                  type="text"
                  value={responsiblePerson}
                  onChange={(e) => setResponsiblePerson(e.target.value)}
                  className="w-full px-3 py-2 border border-fog rounded text-xs"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-fog flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-3 py-1.5 bg-mist hover:bg-fog text-ink rounded text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-signal-blue hover:bg-signal-blue text-white rounded text-xs font-semibold shadow-subtle"
              >
                Guardar Memorando
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
