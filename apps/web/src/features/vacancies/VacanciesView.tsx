import React, { useState } from 'react';
import { VacancyFormData, VacancyRequirement, VacancyStatus, RequirementType, CandidateRanking } from '../../types/vacancy';
import { CandidateFormData } from '../../types/candidate';
import { db } from '../../lib/offline/db';
import { writeAudit } from '../../lib/audit';
import { rankCandidates } from '../../lib/matching';
import { Search01Icon, PlusSignIcon } from 'hugeicons-react';

interface VacanciesViewProps {
  vacancies: VacancyFormData[];
  candidates: CandidateFormData[];
  onReload: () => void;
}

const STATUS_LABELS: Record<VacancyStatus, string> = {
  borrador: 'Borrador',
  abierta: 'Abierta',
  en_proceso: 'En Proceso',
  cerrada: 'Cerrada',
  cancelada: 'Cancelada',
};

const emptyVacancy: () => VacancyFormData = () => ({
  id: `vac-${Date.now()}`,
  title: '',
  department: '',
  location: '',
  description: '',
  salaryRange: '',
  contractType: 'termino_indefinido',
  status: 'borrador',
  requirements: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export const VacanciesView: React.FC<VacanciesViewProps> = ({ vacancies, candidates, onReload }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<VacancyFormData>(emptyVacancy());
  const [saving, setSaving] = useState(false);

  // Edit existing requirement
  const [newReq, setNewReq] = useState<VacancyRequirement>({ skillOrReq: '', reqType: 'habilidad', weight: 5 });

  const filtered = vacancies.filter((v) =>
    `${v.title} ${v.department} ${v.location} ${v.status}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase()),
  );

  const handleAddRequirement = () => {
    if (!newReq.skillOrReq.trim()) return;
    setForm({ ...form, requirements: [...form.requirements, { ...newReq, id: `req-${Date.now()}` }] });
    setNewReq({ skillOrReq: '', reqType: 'habilidad', weight: 5 });
  };

  const handleRemoveRequirement = (idx: number) => {
    setForm({ ...form, requirements: form.requirements.filter((_, i) => i !== idx) });
  };

  const handleSaveVacancy = async () => {
    if (!form.title.trim()) { alert('El titulo es obligatorio.'); return; }
    setSaving(true);
    try {
      await db.vacancies.put({ ...form, updatedAt: new Date().toISOString() });
      setShowCreate(false);
      setForm(emptyVacancy());
      await writeAudit('create', 'vacancies', form.id, form.title);
      onReload();
    } catch (err) {
      console.error(err);
      alert('Error al guardar la vacante.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVacancy = async (id: string) => {
    if (!confirm('Eliminar esta vacante?')) return;
    await db.vacancies.delete(id);
    await writeAudit('delete', 'vacancies', id);
    onReload();
  };

  const handleRunMatching = async (vacancy: VacancyFormData) => {
    if (!vacancy.id) return;
    const ranked = rankCandidates(candidates, vacancy).slice(0, 10);
    const rankings: CandidateRanking[] = ranked.map((r, i) => ({
      id: `rank-${Date.now()}-${i}`,
      vacancyId: vacancy.id as string,
      candidateId: r.candidate.id ?? '',
      score: r.score,
      matchedSkills: r.matchedSkills,
      rankedAt: new Date().toISOString(),
    }));
    await db.vacancies.update(vacancy.id, { rankings, updatedAt: new Date().toISOString() });
    await writeAudit('update', 'vacancies', vacancy.id, `matching: ${ranked.length} candidatos`);
    onReload();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 pt-8 sm:flex-row sm:items-center">
        <p className="text-caption text-steel">
          {filtered.length} {filtered.length === 1 ? 'vacante' : 'vacantes'}
        </p>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-56">
            <Search01Icon className="h-4 w-4 absolute left-3 top-2.5 text-steel" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-fog rounded-lg text-xs focus:outline-none"
            />
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center px-4 py-2 bg-signal-blue hover:bg-rosimar-blue-dark text-white rounded-lg text-xs font-semibold transition-colors shadow-subtle whitespace-nowrap"
          >
            <PlusSignIcon className="h-4 w-4 mr-1" />
            Nueva Vacante
          </button>
        </div>
      </div>

      {/* Tabla de vacantes */}
      <div className="bg-paper rounded-lg border border-fog overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-mist text-left text-xs">
            <thead className="bg-mist text-steel font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Puesto</th>
                <th className="px-4 py-3">Ubicacion</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Requisitos</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist bg-paper">
              {filtered.map((v) => (
                <tr key={v.id} className="hover:bg-paper transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-ink">{v.title}</div>
                    <div className="text-[11px] text-steel">{v.department}</div>
                  </td>
                  <td className="px-4 py-3 text-steel">{v.location}</td>
                  <td className="px-4 py-3 text-steel capitalize">
                    {v.contractType ? v.contractType.replace(/_/g, ' ') : '—'}
                  </td>
                  <td className="px-4 py-3 text-steel">{v.requirements.length}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      v.status === 'abierta' ? 'border border-ink text-ink' : 'bg-mist text-steel'
                    }`}>
                      {STATUS_LABELS[v.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRunMatching(v)}
                        className="text-signal-blue text-[11px] font-semibold hover:underline"
                        title="Ejecutar matching contra todos los candidatos"
                      >
                        Matching
                      </button>
                      <button
                        onClick={() => v.id && handleDeleteVacancy(v.id)}
                        className="text-alert text-[11px] font-semibold hover:underline"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-steel italic">
                    No hay vacantes. Crea una nueva para empezar a vincular candidatos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal crear vacante */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSaveVacancy(); }}
            className="bg-paper rounded-lg max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-sm font-bold text-ink border-b border-fog pb-2">Nueva Vacante</h3>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block font-medium text-ink mb-1">Titulo del puesto *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-medium text-ink mb-1">Departamento</label>
                  <input
                    type="text"
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-ink mb-1">Ubicacion</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-ink mb-1">Rango salarial</label>
                  <input
                    type="text"
                    value={form.salaryRange}
                    onChange={(e) => setForm({ ...form, salaryRange: e.target.value })}
                    placeholder="Ej: 1.5M - 2.5M COP"
                    className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-ink mb-1">Tipo de contrato</label>
                  <select
                    value={form.contractType}
                    onChange={(e) => setForm({ ...form, contractType: e.target.value })}
                    className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
                  >
                    <option value="termino_indefinido">Termino Indefinido</option>
                    <option value="termino_fijo">Termino Fijo</option>
                    <option value="prestacion_servicios">Prestacion de Servicios</option>
                    <option value="obra_o_labor">Obra o Labor</option>
                    <option value="aprendizaje">Aprendizaje</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-ink mb-1">Estado</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as VacancyStatus })}
                    className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
                  >
                    {(Object.keys(STATUS_LABELS) as VacancyStatus[]).map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-ink mb-1">Descripcion</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
                />
              </div>

              {/* Requisitos ponderados */}
              <div>
                <label className="block font-medium text-ink mb-2">Requisitos ponderados (para matching)</label>

                <div className="space-y-2">
                  {form.requirements.map((req, idx) => (
                    <div key={req.id ?? idx} className="flex items-center gap-2 bg-mist/50 rounded px-3 py-2">
                      <span className="font-semibold text-ink text-[11px] w-6">{req.weight}</span>
                      <span className="px-1.5 py-0.5 bg-fog rounded text-[10px] text-steel uppercase">{req.reqType}</span>
                      <span className="flex-1 text-ink">{req.skillOrReq}</span>
                      <button type="button" onClick={() => handleRemoveRequirement(idx)} className="text-alert text-[11px] font-semibold hover:underline">x</button>
                    </div>
                  ))}
                </div>

                <div className="flex items-end gap-2 mt-3">
                  <div className="flex-1">
                    <label className="block text-[10px] text-steel mb-1">Requisito</label>
                    <input
                      type="text"
                      value={newReq.skillOrReq}
                      onChange={(e) => setNewReq({ ...newReq, skillOrReq: e.target.value })}
                      placeholder="Ej: Python, manejo de Excel,押记..."
                      className="w-full px-2 py-1.5 border border-fog rounded bg-paper text-xs focus:outline-none"
                    />
                  </div>
                  <div className="w-32">
                    <label className="block text-[10px] text-steel mb-1">Tipo</label>
                    <select
                      value={newReq.reqType}
                      onChange={(e) => setNewReq({ ...newReq, reqType: e.target.value as RequirementType })}
                      className="w-full px-2 py-1.5 border border-fog rounded bg-paper text-xs"
                    >
                      <option value="habilidad">Habilidad</option>
                      <option value="experiencia">Experiencia</option>
                      <option value="educacion">Educacion</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                  <div className="w-20">
                    <label className="block text-[10px] text-steel mb-1">Peso (1-10)</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={newReq.weight}
                      onChange={(e) => setNewReq({ ...newReq, weight: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })}
                      className="w-full px-2 py-1.5 border border-fog rounded bg-paper text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddRequirement}
                    className="px-3 py-1.5 bg-mist hover:bg-fog rounded text-[11px] font-semibold text-ink"
                  >
                    Agregar
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-fog flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowCreate(false); setForm(emptyVacancy()); }}
                className="px-3 py-1.5 bg-mist hover:bg-fog text-ink rounded text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 bg-signal-blue hover:bg-rosimar-blue-dark text-white rounded text-xs font-semibold shadow-subtle disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Crear Vacante'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};