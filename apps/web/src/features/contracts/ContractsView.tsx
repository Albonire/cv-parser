import React, { useState } from 'react';
import { ContractFormData, ContractStatus, ContractType, ContractRenewal } from '../../types/contract';
import { EmployeeItem } from '../../types/employee';
import { db } from '../../lib/offline/db';
import { writeAudit } from '../../lib/audit';
import { Search01Icon, PlusSignIcon } from 'hugeicons-react';

interface ContractsViewProps {
  contracts: ContractFormData[];
  employees: EmployeeItem[];
  onReload: () => void;
}

const STATUS_LABELS: Record<ContractStatus, string> = {
  vigente: 'Vigente',
  por_vencer: 'Por vencer',
  vencido: 'Vencido',
  terminado: 'Terminado',
  cancelado: 'Cancelado',
  prorroga: 'Prorrogado',
};

const emptyContract: () => ContractFormData = () => ({
  id: `cont-${Date.now()}`,
  employerName: 'Rosimar S.A.S.',
  employerNit: '900.123.456-7',
  workerName: '',
  workerDocumentNumber: '',
  position: '',
  salary: 0,
  currency: 'COP',
  paymentFrequency: 'mensual',
  contractType: 'termino_fijo',
  durationMonths: 12,
  startDate: new Date().toISOString().split('T')[0],
  endDate: '',
  trialPeriodDays: 30,
  noticeDays: 30,
  executionPlace: 'Bogota, Colombia',
  status: 'vigente',
  renewals: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export const ContractsView: React.FC<ContractsViewProps> = ({ contracts, employees, onReload }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ContractFormData>(emptyContract());
  const [saving, setSaving] = useState(false);

  // Prorroga modal
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [renewalTarget, setRenewalTarget] = useState<ContractFormData | null>(null);
  const [renewalMonths, setRenewalMonths] = useState(12);
  const [renewalNotes, setRenewalNotes] = useState('');

  const filtered = contracts.filter((c) =>
    `${c.workerName} ${c.workerDocumentNumber} ${c.position} ${c.contractType}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase()),
  );

  const handleEdit = (contract: ContractFormData) => {
    setForm({ ...contract });
    setEditingId(contract.id ?? null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.workerName.trim() || !form.position.trim()) {
      alert('Trabajador y cargo son obligatorios.');
      return;
    }
    setSaving(true);
    try {
      const toSave = {
        ...form,
        id: editingId ?? form.id,
        updatedAt: new Date().toISOString(),
      };
      await db.contracts.put(toSave);

      // Also update the employee's activeContract if linked
      if (form.employeeId) {
        const emp = await db.employees.get(form.employeeId);
        if (emp) {
          await db.employees.update(form.employeeId, {
            activeContract: toSave,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      setShowForm(false);
      setEditingId(null);
      setForm(emptyContract());
      await writeAudit(editingId ? 'update' : 'create', 'contracts', toSave.id, toSave.workerName);
      onReload();
    } catch (err) {
      console.error(err);
      alert('Error al guardar el contrato.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar este contrato?')) return;
    await db.contracts.delete(id);
    await writeAudit('delete', 'contracts', id);
    onReload();
  };

  const handleTerminate = async (contract: ContractFormData) => {
    const reason = prompt('Razon de terminacion (renuncia, terminacion_unilateral_empleador, mutuo_acuerdo, finalizacion_obra, otra):');
    if (!reason) return;
    await db.contracts.update(contract.id!, {
      status: 'terminado',
      endDate: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString(),
    });
    await writeAudit('update', 'contracts', contract.id, `terminado: ${reason}`);
    onReload();
  };

  const openRenewalModal = (contract: ContractFormData) => {
    setRenewalTarget(contract);
    setRenewalMonths(contract.durationMonths ?? 12);
    setRenewalNotes('');
    setShowRenewalModal(true);
  };

  const handleCreateRenewal = async () => {
    if (!renewalTarget || !renewalTarget.id) return;
    const renewals = renewalTarget.renewals ?? [];
    const newRenewal: ContractRenewal = {
      id: `ren-${Date.now()}`,
      contractId: renewalTarget.id,
      renewalNumber: renewals.length + 1,
      effectiveDate: renewalTarget.endDate ?? new Date().toISOString().split('T')[0],
      extendedMonths: renewalMonths,
      newEndDate: computeNewEndDate(renewalTarget.endDate ?? new Date().toISOString().split('T')[0], renewalMonths),
      notes: renewalNotes || undefined,
      createdAt: new Date().toISOString(),
    };

    await db.contracts.update(renewalTarget.id, {
      renewals: [...renewals, newRenewal],
      endDate: newRenewal.newEndDate,
      status: 'prorroga',
      updatedAt: new Date().toISOString(),
    });

    await writeAudit('update', 'contracts', renewalTarget.id, `prorroga #${newRenewal.renewalNumber}: +${renewalMonths} meses`);
    setShowRenewalModal(false);
    setRenewalTarget(null);
    onReload();
  };

  const computeNewEndDate = (currentEnd: string, months: number): string => {
    const d = new Date(currentEnd);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split('T')[0];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 pt-8 sm:flex-row sm:items-center">
        <p className="text-caption text-steel">
          {filtered.length} {filtered.length === 1 ? 'contrato' : 'contratos'}
        </p>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-56">
            <Search01Icon className="h-4 w-4 absolute left-3 top-2.5 text-steel" />
            <input
              type="text"
              placeholder="Buscar por trabajador, cargo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-fog rounded-lg text-xs focus:outline-none"
            />
          </div>
          <button
            onClick={() => { setForm(emptyContract()); setEditingId(null); setShowForm(true); }}
            className="inline-flex items-center px-4 py-2 bg-signal-blue hover:bg-signal-blue text-white rounded-lg text-xs font-semibold transition-colors shadow-subtle whitespace-nowrap"
          >
            <PlusSignIcon className="h-4 w-4 mr-1" />
            Nuevo Contrato
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-paper rounded-lg border border-fog overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-mist text-left text-xs">
            <thead className="bg-mist text-steel font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Trabajador</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Salario</th>
                <th className="px-4 py-3">Vigencia</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist bg-paper">
              {filtered.map((con) => (
                <tr key={con.id} className="hover:bg-paper transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-ink">{con.workerName}</div>
                    <div className="text-[11px] text-steel font-mono">CC: {con.workerDocumentNumber}</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-ink">{con.position}</td>
                  <td className="px-4 py-3 text-steel capitalize">
                    {con.contractType.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3 font-semibold text-ink">
                    ${con.salary.toLocaleString('es-CO')} COP
                  </td>
                  <td className="px-4 py-3 text-steel">
                    <div>{con.startDate} al {con.endDate || 'Indefinido'}</div>
                    {con.renewals && con.renewals.length > 0 && (
                      <div className="text-[10px] text-signal-blue font-semibold">
                        {con.renewals.length} prorroga{con.renewals.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      con.status === 'vigente' ? 'border border-ink text-ink'
                        : con.status === 'prorroga' ? 'bg-signal-blue/10 text-signal-blue'
                          : con.status === 'terminado' ? 'bg-mist text-steel'
                            : con.status === 'por_vencer' ? 'bg-warning-surface text-warning'
                              : con.status === 'cancelado' ? 'bg-alert-surface text-alert'
                                : 'bg-mist text-ink'
                    }`}>
                      {STATUS_LABELS[con.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleEdit(con)} className="text-signal-blue text-[11px] font-semibold hover:underline">Editar</button>
                      <button onClick={() => openRenewalModal(con)} className="text-ink text-[11px] font-semibold hover:underline">Prorrogar</button>
                      {con.status === 'vigente' && (
                        <button onClick={() => handleTerminate(con)} className="text-warning text-[11px] font-semibold hover:underline">Terminar</button>
                      )}
                      {typeof con.id === 'string' && (
                        <button onClick={() => handleDelete(con.id!)} className="text-alert text-[11px] font-semibold hover:underline">Eliminar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-steel italic">
                    No hay contratos. Puedes escanearlos desde el <strong>Lector OCR</strong> o crear uno nuevo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal crear/editar contrato */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSave(); }}
            className="bg-paper rounded-lg max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-sm font-bold text-ink border-b border-fog pb-2">
              {editingId ? 'Editar Contrato' : 'Nuevo Contrato'}
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
              {/* Empleado vinculado (opcional) */}
              <div className="sm:col-span-2">
                <label className="block font-medium text-ink mb-1">Vincular a empleado existente (opcional)</label>
                <select
                  value={form.employeeId ?? ''}
                  onChange={(e) => {
                    const empId = e.target.value;
                    const emp = employees.find((em) => em.id === empId);
                    if (emp) {
                      setForm({
                        ...form,
                        employeeId: emp.id,
                        workerName: `${emp.candidateData.firstNames} ${emp.candidateData.lastNames}`,
                        workerDocumentNumber: emp.candidateData.documentNumber,
                      });
                    } else {
                      setForm({ ...form, employeeId: undefined });
                    }
                  }}
                  className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
                >
                  <option value="">Sin vincular</option>
                  {employees.filter((e) => e.status === 'activo').map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.candidateData.firstNames} {emp.candidateData.lastNames} ({emp.employeeCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-ink mb-1">Nombre del trabajador *</label>
                <input
                  type="text"
                  value={form.workerName}
                  onChange={(e) => setForm({ ...form, workerName: e.target.value })}
                  className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block font-medium text-ink mb-1">Documento *</label>
                <input
                  type="text"
                  value={form.workerDocumentNumber}
                  onChange={(e) => setForm({ ...form, workerDocumentNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block font-medium text-ink mb-1">Cargo *</label>
                <input
                  type="text"
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                  className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block font-medium text-ink mb-1">Salario mensual *</label>
                <input
                  type="number"
                  value={form.salary}
                  onChange={(e) => setForm({ ...form, salary: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block font-medium text-ink mb-1">Tipo de contrato</label>
                <select
                  value={form.contractType}
                  onChange={(e) => setForm({ ...form, contractType: e.target.value as ContractType })}
                  className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
                >
                  <option value="termino_fijo">Termino Fijo</option>
                  <option value="indefinido">Indefinido</option>
                  <option value="obra_labor">Obra o Labor</option>
                  <option value="aprendizaje">Aprendizaje</option>
                  <option value="tiempo_parcial">Tiempo Parcial</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-ink mb-1">Fecha de inicio</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-medium text-ink mb-1">Fecha de fin (vacio = indefinido)</label>
                <input
                  type="date"
                  value={form.endDate ?? ''}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-medium text-ink mb-1">Dias periodo de prueba</label>
                <input
                  type="number"
                  min={0}
                  max={180}
                  value={form.trialPeriodDays}
                  onChange={(e) => setForm({ ...form, trialPeriodDays: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-medium text-ink mb-1">Dias preaviso (vencimiento)</label>
                <input
                  type="number"
                  min={0}
                  max={90}
                  value={form.noticeDays}
                  onChange={(e) => setForm({ ...form, noticeDays: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-medium text-ink mb-1">Estado</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as ContractStatus })}
                  className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
                >
                  {(Object.keys(STATUS_LABELS) as ContractStatus[]).map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block font-medium text-ink mb-1">Lugar de ejecucion</label>
                <input
                  type="text"
                  value={form.executionPlace}
                  onChange={(e) => setForm({ ...form, executionPlace: e.target.value })}
                  className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-fog flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyContract()); }}
                className="px-3 py-1.5 bg-mist hover:bg-fog text-ink rounded text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 bg-signal-blue hover:bg-signal-blue text-white rounded text-xs font-semibold shadow-subtle disabled:opacity-50"
              >
                {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear Contrato'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal prorroga */}
      {showRenewalModal && renewalTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-paper rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-ink border-b border-fog pb-2">
              Prorrogar contrato de {renewalTarget.workerName}
            </h3>

            <div className="text-xs text-steel space-y-1">
              <p>Fecha de fin actual: <strong className="text-ink">{renewalTarget.endDate || 'Indefinido'}</strong></p>
              <p>Prorrogas anteriores: <strong className="text-ink">{renewalTarget.renewals?.length ?? 0}</strong></p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-ink mb-1">Meses a prorrogar</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={renewalMonths}
                  onChange={(e) => setRenewalMonths(Number(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-medium text-ink mb-1">Notas (opcional)</label>
                <textarea
                  rows={2}
                  value={renewalNotes}
                  onChange={(e) => setRenewalNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-fog flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowRenewalModal(false); setRenewalTarget(null); }}
                className="px-3 py-1.5 bg-mist hover:bg-fog text-ink rounded text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateRenewal}
                className="px-4 py-1.5 bg-signal-blue hover:bg-signal-blue text-white rounded text-xs font-semibold shadow-subtle"
              >
                Confirmar Prorroga
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};