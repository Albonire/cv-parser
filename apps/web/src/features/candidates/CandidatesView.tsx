import React, { useMemo, useState } from 'react';
import { CandidateFormData, CandidateStatus } from '../../types/candidate';
import { familiaDeCargo } from '../../lib/contexto/diccionario';
import { db } from '../../lib/offline/db';
import { queueMutation } from '../../lib/offline/sync';
import { EmployeeItem } from '../../types/employee';
import { Search01Icon, UserCheck01Icon, Briefcase01Icon, CapIcon, EyeIcon, Cancel01Icon, LanguageCircleIcon, Award01Icon, Dollar01Icon, Clock01Icon } from 'hugeicons-react';

interface CandidatesViewProps {
  candidates: CandidateFormData[];
  onReload: () => void;
}

export const CandidatesView: React.FC<CandidatesViewProps> = ({ candidates, onReload }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('todos');
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateFormData | null>(null);

  // Filtros por facetas (F1 de docs/ARQUITECTURA.md 3.2)
  const [filtroCargo, setFiltroCargo] = useState('todos');
  const [filtroCiudad, setFiltroCiudad] = useState('todos');
  const [filtroHabilidad, setFiltroHabilidad] = useState('todos');
  const [filtroIdioma, setFiltroIdioma] = useState('todos');
  const [filtroNivel, setFiltroNivel] = useState('todos');
  const [filtroEstadoCivil, setFiltroEstadoCivil] = useState('todos');

  /** Cargo principal normalizado del candidato: el de su experiencia mas reciente. */
  const cargoDe = (c: CandidateFormData): string => {
    const posicion = c.experience?.[0]?.position?.trim() || c.headline?.trim() || '';
    return posicion ? familiaDeCargo(posicion) ?? posicion : '';
  };

  const ciudadDe = (c: CandidateFormData): string =>
    (c.cityResidence || '').split(',')[0].trim();

  /** Opciones disponibles, construidas con lo que realmente hay en la bandeja. */
  const opciones = useMemo(() => {
    const unicos = (valores: string[]) =>
      [...new Set(valores.filter((v) => v && v.length > 1))].sort((a, b) =>
        a.localeCompare(b, 'es')
      );

    return {
      cargos: unicos(candidates.map(cargoDe)),
      ciudades: unicos(candidates.map(ciudadDe)),
      habilidades: unicos(candidates.flatMap((c) => (c.skills ?? []).map((s) => s.skillName))),
      idiomas: unicos(candidates.flatMap((c) => (c.languages ?? []).map((l) => l.language))),
      niveles: unicos(candidates.flatMap((c) => (c.education ?? []).map((e) => e.level))),
      estadosCiviles: unicos(candidates.map((c) => c.maritalStatus ?? '')),
    };
  }, [candidates]);

  const filteredCandidates = candidates.filter((c) => {
    const matchesSearch =
      `${c.firstNames} ${c.lastNames} ${c.documentNumber} ${c.email} ${c.phone} ${c.cityResidence || ''}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesStatus = selectedStatus === 'todos' || c.status === selectedStatus;
    const matchesCargo = filtroCargo === 'todos' || cargoDe(c) === filtroCargo;
    const matchesCiudad = filtroCiudad === 'todos' || ciudadDe(c) === filtroCiudad;
    const matchesHabilidad =
      filtroHabilidad === 'todos' || (c.skills ?? []).some((s) => s.skillName === filtroHabilidad);
    const matchesIdioma =
      filtroIdioma === 'todos' || (c.languages ?? []).some((l) => l.language === filtroIdioma);
    const matchesNivel =
      filtroNivel === 'todos' || (c.education ?? []).some((e) => e.level === filtroNivel);
    const matchesEstadoCivil =
      filtroEstadoCivil === 'todos' || c.maritalStatus === filtroEstadoCivil;

    return (
      matchesSearch &&
      matchesStatus &&
      matchesCargo &&
      matchesCiudad &&
      matchesHabilidad &&
      matchesIdioma &&
      matchesNivel &&
      matchesEstadoCivil
    );
  });

  const filtrosActivos = [
    filtroCargo,
    filtroCiudad,
    filtroHabilidad,
    filtroIdioma,
    filtroNivel,
    filtroEstadoCivil,
  ].filter((f) => f !== 'todos').length;

  const limpiarFiltros = () => {
    setFiltroCargo('todos');
    setFiltroCiudad('todos');
    setFiltroHabilidad('todos');
    setFiltroIdioma('todos');
    setFiltroNivel('todos');
    setFiltroEstadoCivil('todos');
  };

  const handleConvertToEmployee = async (candidate: CandidateFormData) => {
    if (
      !confirm(
        `¿Deseas contratar y convertir a ${candidate.firstNames} ${candidate.lastNames} en empleado activo de Rosimar S.A.S.? (Regla RN-1)`
      )
    ) {
      return;
    }

    try {
      // 1. Actualizar estado del candidato a 'contratado'
      const updatedCandidate: CandidateFormData = {
        ...candidate,
        status: 'contratado',
        updatedAt: new Date().toISOString(),
      };
      await db.candidates.put(updatedCandidate);
      await queueMutation("update", "candidates", updatedCandidate.id!, updatedCandidate as unknown as Record<string, unknown>);

      // 2. Crear registro de empleado
      const newEmployee: EmployeeItem = {
        id: `emp-${Date.now()}`,
        candidateId: candidate.id,
        employeeCode: `ROS-${Math.floor(1000 + Math.random() * 9000)}`,
        status: 'activo',
        hireDate: new Date().toISOString().split('T')[0],
        candidateData: updatedCandidate,
        memoCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.employees.put(newEmployee);
      await queueMutation("create", "employees", newEmployee.id, newEmployee as unknown as Record<string, unknown>);

      alert(`Empleado ${candidate.firstNames} ${candidate.lastNames} contratado exitosamente.`);
      onReload();
      setSelectedCandidate(null);
    } catch (err) {
      console.error(err);
      alert('Error al convertir candidato a empleado.');
    }
  };

  const getStatusBadge = (status: CandidateStatus) => {
    const map: Record<CandidateStatus, { label: string; color: string }> = {
      nuevo: { label: 'Nuevo', color: 'border border-fog text-steel' },
      en_revision: { label: 'En Revisión', color: 'bg-warning-surface text-warning' },
      preseleccionado: { label: 'Preseleccionado', color: 'bg-purple-100 text-purple-800' },
      en_entrevista: { label: 'En Entrevista', color: 'bg-indigo-100 text-indigo-800' },
      contratado: { label: 'Contratado', color: 'border border-ink text-ink font-semibold' },
      descartado: { label: 'Descartado', color: 'bg-alert-surface text-alert' },
      archivado: { label: 'Archivado', color: 'bg-mist text-ink' },
    };
    const item = map[status] || { label: status, color: 'bg-mist text-ink' };
    return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${item.color}`}>{item.label}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Barra de herramientas. El título de la sección lo pone la cabecera de
          la página: repetirlo aquí solo añadía una caja y una jerarquía falsa. */}
      <div className="flex flex-col items-start justify-between gap-4 pt-8 sm:flex-row sm:items-center">
        <p className="text-caption text-steel">
          {filteredCandidates.length}{' '}
          {filteredCandidates.length === 1 ? 'candidato' : 'candidatos'}
          {filteredCandidates.length !== candidates.length && ` de ${candidates.length}`}
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search01Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel" />
            <input
              type="text"
              placeholder="Buscar por nombre, cédula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-fog py-2 pl-9 pr-3 text-caption focus:outline-none"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full rounded-lg border border-fog bg-paper px-3 py-2 text-caption focus:outline-none sm:w-auto"
          >
            <option value="todos">Todos los Estados</option>
            <option value="nuevo">Nuevo</option>
            <option value="en_revision">En Revisión</option>
            <option value="preseleccionado">Preseleccionado</option>
            <option value="en_entrevista">En Entrevista</option>
            <option value="contratado">Contratado</option>
            <option value="descartado">Descartado</option>
          </select>
        </div>
      </div>

      {/* Filtros por facetas sobre los CV extraidos y confirmados (F1) */}
      <div className="bg-paper p-4 rounded-lg border border-fog space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-caption font-semibold uppercase tracking-[0.08em] text-steel">Filtros</h2>
          {filtrosActivos > 0 && (
            <button
              onClick={limpiarFiltros}
              className="text-xs font-semibold text-ink hover:text-ink underline"
            >
              Limpiar {filtrosActivos} filtro{filtrosActivos > 1 ? 's' : ''}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {(
            [
              { etiqueta: 'Cargo', valor: filtroCargo, set: setFiltroCargo, items: opciones.cargos },
              { etiqueta: 'Ciudad', valor: filtroCiudad, set: setFiltroCiudad, items: opciones.ciudades },
              { etiqueta: 'Habilidad', valor: filtroHabilidad, set: setFiltroHabilidad, items: opciones.habilidades },
              { etiqueta: 'Idioma', valor: filtroIdioma, set: setFiltroIdioma, items: opciones.idiomas },
              { etiqueta: 'Nivel educativo', valor: filtroNivel, set: setFiltroNivel, items: opciones.niveles },
              { etiqueta: 'Estado civil', valor: filtroEstadoCivil, set: setFiltroEstadoCivil, items: opciones.estadosCiviles },
            ] as const
          ).map((faceta) => (
            <label key={faceta.etiqueta} className="block">
              <span className="block text-[11px] font-medium text-steel mb-0.5">
                {faceta.etiqueta}
              </span>
              <select
                value={faceta.valor}
                onChange={(e) => faceta.set(e.target.value)}
                disabled={faceta.items.length === 0}
                className="w-full px-2 py-1.5 border border-fog rounded-lg text-xs bg-paper focus:outline-none disabled:bg-mist disabled:text-steel"
              >
                <option value="todos">Todos</option>
                {faceta.items.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>

      {/* Tabla de Candidatos */}
      <div className="bg-paper rounded-lg border border-fog overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-mist text-left text-xs">
            <thead className="bg-mist text-steel font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Candidato</th>
                <th className="px-4 py-3">Identificación</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3">Ciudad</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist bg-paper">
              {filteredCandidates.map((c) => (
                <tr key={c.id} className="hover:bg-paper transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-ink">
                      {c.firstNames} {c.lastNames}
                    </div>
                    <div className="text-[11px] text-steel">{c.headline || 'Sin titular'}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-ink">
                    {c.documentType} {c.documentNumber}
                  </td>
                  <td className="px-4 py-3 space-y-0.5">
                    <div className="text-ink">{c.email || 'Sin email'}</div>
                    <div className="text-steel">{c.phone || 'Sin teléfono'}</div>
                  </td>
                  <td className="px-4 py-3 text-steel">{c.cityResidence || 'No especificada'}</td>
                  <td className="px-4 py-3">{getStatusBadge(c.status)}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => setSelectedCandidate(c)}
                      className="p-1 text-steel hover:text-ink bg-mist hover:bg-fog rounded"
                      title="Ver Ficha Completa"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>
                    {c.status !== 'contratado' && (
                      <button
                        onClick={() => handleConvertToEmployee(c)}
                        className="inline-flex items-center px-2 py-1 bg-signal-blue hover:bg-signal-blue text-white rounded text-[11px] font-semibold shadow-subtle"
                        title="Contratar (RN-1)"
                      >
                        <UserCheck01Icon className="h-3.5 w-3.5 mr-1" />
                        Contratar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredCandidates.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-steel italic">
                    No se encontraron candidatos registrados. Utiliza el <strong>Lector OCR</strong> para escanear hojas
                    de vida.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ficha Completa del Candidato */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-paper rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-fog">
              <div>
                <h3 className="text-lg font-bold text-ink">
                  {selectedCandidate.firstNames} {selectedCandidate.lastNames}
                </h3>
                <p className="text-xs text-ink font-medium">{selectedCandidate.headline || 'Candidato'}</p>
              </div>
              <button onClick={() => setSelectedCandidate(null)} className="text-steel hover:text-ink">
                <Cancel01Icon className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="font-semibold text-steel">Documento:</span>
                <p className="text-ink">
                  {selectedCandidate.documentType} {selectedCandidate.documentNumber}
                </p>
              </div>
              <div>
                <span className="font-semibold text-steel">Nacionalidad:</span>
                <p className="text-ink">{selectedCandidate.nationality || 'No indicada'}</p>
              </div>
              <div>
                <span className="font-semibold text-steel">Estado Civil:</span>
                <p className="text-ink">{selectedCandidate.maritalStatus || 'No especificado'}</p>
              </div>
              <div>
                <span className="font-semibold text-steel">Correo Electrónico:</span>
                <p className="text-ink">{selectedCandidate.email || 'N/A'}</p>
              </div>
              <div>
                <span className="font-semibold text-steel">Teléfono:</span>
                <p className="text-ink">{selectedCandidate.phone || 'N/A'}</p>
              </div>
              <div>
                <span className="font-semibold text-steel">Ciudad / Dirección:</span>
                <p className="text-ink">
                  {selectedCandidate.cityResidence || 'N/A'}
                  {selectedCandidate.address ? ` (${selectedCandidate.address})` : ''}
                </p>
              </div>
              {selectedCandidate.salaryExpectation && (
                <div>
                  <span className="font-semibold text-steel flex items-center">
                    <Dollar01Icon className="h-3 w-3 mr-0.5 text-steel" />
                    Aspiración Salarial:
                  </span>
                  <p className="text-ink font-semibold">
                    ${selectedCandidate.salaryExpectation.toLocaleString('es-CO')} COP
                  </p>
                </div>
              )}
              {selectedCandidate.availability && (
                <div>
                  <span className="font-semibold text-steel flex items-center">
                    <Clock01Icon className="h-3 w-3 mr-0.5 text-steel" />
                    Disponibilidad:
                  </span>
                  <p className="text-ink">{selectedCandidate.availability}</p>
                </div>
              )}
              <div>
                <span className="font-semibold text-steel">Estado:</span>
                <div className="mt-0.5">{getStatusBadge(selectedCandidate.status)}</div>
              </div>
            </div>

            {selectedCandidate.summary && (
              <div className="text-xs">
                <span className="font-semibold text-steel">Perfil:</span>
                <p className="text-ink bg-mist p-2.5 rounded mt-1">{selectedCandidate.summary}</p>
              </div>
            )}

            {/* Educacion */}
            <div className="text-xs">
              <span className="font-semibold text-steel flex items-center mb-1">
                <CapIcon className="h-4 w-4 mr-1 text-steel" />
                Estudios ({selectedCandidate.education.length})
              </span>
              <div className="space-y-1">
                {selectedCandidate.education.map((e, idx) => (
                  <div key={idx} className="p-2 bg-mist rounded">
                    <strong>
                      {e.level}: {e.degree}
                    </strong>{' '}
                    — {e.institution} ({e.endYear || 'En curso'})
                  </div>
                ))}
              </div>
            </div>

            {/* Experiencia */}
            <div className="text-xs">
              <span className="font-semibold text-steel flex items-center mb-1">
                <Briefcase01Icon className="h-4 w-4 mr-1 text-steel" />
                Experiencia Laboral ({selectedCandidate.experience.length})
              </span>
              <div className="space-y-1">
                {selectedCandidate.experience.map((exp, idx) => (
                  <div key={idx} className="p-2 bg-mist rounded">
                    <strong>{exp.position}</strong> en {exp.company} ({exp.startDate} - {exp.endDate || 'Actual'})
                    {exp.responsibilities && (
                      <p className="text-steel text-[11px] mt-1">{exp.responsibilities}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Idiomas */}
            {selectedCandidate.languages && selectedCandidate.languages.length > 0 && (
              <div className="text-xs">
                <span className="font-semibold text-steel flex items-center mb-1">
                  <LanguageCircleIcon className="h-4 w-4 mr-1 text-steel" />
                  Idiomas ({selectedCandidate.languages.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCandidate.languages.map((l, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-paper text-steel border border-fog rounded text-[11px]"
                    >
                      {l.language}: {l.level}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Certificaciones */}
            {selectedCandidate.certifications && selectedCandidate.certifications.length > 0 && (
              <div className="text-xs">
                <span className="font-semibold text-steel flex items-center mb-1">
                  <Award01Icon className="h-4 w-4 mr-1 text-steel" />
                  Certificaciones y Diplomados ({selectedCandidate.certifications.length})
                </span>
                <div className="space-y-1">
                  {selectedCandidate.certifications.map((c, idx) => (
                    <div key={idx} className="p-1.5 bg-mist rounded text-[11px]">
                      <strong>{c.name}</strong> {c.institution ? `(${c.institution})` : ''} {c.year ? `— ${c.year}` : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Habilidades */}
            <div className="text-xs">
              <span className="font-semibold text-steel mb-1 block">Habilidades Reconocidas:</span>
              <div className="flex flex-wrap gap-1">
                {selectedCandidate.skills.map((s, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-mist text-ink border border-fog rounded text-[11px]"
                  >
                    {s.skillName}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-fog flex justify-end gap-2">
              <button
                onClick={() => setSelectedCandidate(null)}
                className="px-4 py-1.5 bg-mist hover:bg-fog text-ink rounded text-xs font-semibold"
              >
                Cerrar
              </button>
              {selectedCandidate.status !== 'contratado' && (
                <button
                  onClick={() => handleConvertToEmployee(selectedCandidate)}
                  className="px-4 py-1.5 bg-signal-blue hover:bg-signal-blue text-white rounded text-xs font-semibold shadow-subtle"
                >
                  Contratar Empleado (RN-1)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
