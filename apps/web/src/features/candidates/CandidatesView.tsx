import React, { useState } from 'react';
import { CandidateFormData, CandidateStatus } from '../../types/candidate';
import { db } from '../../lib/offline/db';
import { queueMutation } from '../../lib/offline/sync';
import { EmployeeItem } from '../../types/employee';
import { UserGroupIcon, Search01Icon, UserCheck01Icon, Briefcase01Icon, CapIcon, EyeIcon, Cancel01Icon, LanguageCircleIcon, Award01Icon, Dollar01Icon, Clock01Icon } from 'hugeicons-react';

interface CandidatesViewProps {
  candidates: CandidateFormData[];
  onReload: () => void;
}

export const CandidatesView: React.FC<CandidatesViewProps> = ({ candidates, onReload }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('todos');
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateFormData | null>(null);

  const filteredCandidates = candidates.filter((c) => {
    const matchesSearch =
      `${c.firstNames} ${c.lastNames} ${c.documentNumber} ${c.email} ${c.phone} ${c.cityResidence || ''}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesStatus = selectedStatus === 'todos' || c.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

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
      nuevo: { label: 'Nuevo', color: 'bg-blue-100 text-blue-800' },
      en_revision: { label: 'En Revisión', color: 'bg-amber-100 text-amber-800' },
      preseleccionado: { label: 'Preseleccionado', color: 'bg-purple-100 text-purple-800' },
      en_entrevista: { label: 'En Entrevista', color: 'bg-indigo-100 text-indigo-800' },
      contratado: { label: 'Contratado', color: 'bg-green-100 text-green-800' },
      descartado: { label: 'Descartado', color: 'bg-red-100 text-red-800' },
      archivado: { label: 'Archivado', color: 'bg-navy-100 text-navy-800' },
    };
    const item = map[status] || { label: status, color: 'bg-navy-100 text-navy-800' };
    return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${item.color}`}>{item.label}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Encabezado y Filtros */}
      <div className="bg-white p-4 rounded-xl border border-navy-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <UserGroupIcon className="h-6 w-6 text-brand-600" />
          <h2 className="text-lg font-bold text-navy-900">
            Módulo de Candidatos ({filteredCandidates.length})
          </h2>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search01Icon className="h-4 w-4 absolute left-3 top-2.5 text-navy-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, cédula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-navy-300 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full sm:w-auto px-3 py-1.5 border border-navy-300 rounded-lg text-xs bg-white focus:outline-none"
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

      {/* Tabla de Candidatos */}
      <div className="bg-white rounded-xl border border-navy-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-navy-200 text-left text-xs">
            <thead className="bg-navy-50 text-navy-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Candidato</th>
                <th className="px-4 py-3">Identificación</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3">Ciudad</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100 bg-white">
              {filteredCandidates.map((c) => (
                <tr key={c.id} className="hover:bg-navy-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-navy-900">
                      {c.firstNames} {c.lastNames}
                    </div>
                    <div className="text-[11px] text-navy-500">{c.headline || 'Sin titular'}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-navy-700">
                    {c.documentType} {c.documentNumber}
                  </td>
                  <td className="px-4 py-3 space-y-0.5">
                    <div className="text-navy-700">{c.email || 'Sin email'}</div>
                    <div className="text-navy-500">{c.phone || 'Sin teléfono'}</div>
                  </td>
                  <td className="px-4 py-3 text-navy-600">{c.cityResidence || 'No especificada'}</td>
                  <td className="px-4 py-3">{getStatusBadge(c.status)}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => setSelectedCandidate(c)}
                      className="p-1 text-navy-600 hover:text-navy-900 bg-navy-100 hover:bg-navy-200 rounded"
                      title="Ver Ficha Completa"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>
                    {c.status !== 'contratado' && (
                      <button
                        onClick={() => handleConvertToEmployee(c)}
                        className="inline-flex items-center px-2 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded text-[11px] font-semibold"
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
                  <td colSpan={6} className="px-4 py-8 text-center text-navy-400 italic">
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
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-navy-200">
              <div>
                <h3 className="text-lg font-bold text-navy-900">
                  {selectedCandidate.firstNames} {selectedCandidate.lastNames}
                </h3>
                <p className="text-xs text-brand-700 font-medium">{selectedCandidate.headline || 'Candidato'}</p>
              </div>
              <button onClick={() => setSelectedCandidate(null)} className="text-navy-400 hover:text-navy-700">
                <Cancel01Icon className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="font-semibold text-navy-500">Documento:</span>
                <p className="text-navy-900">
                  {selectedCandidate.documentType} {selectedCandidate.documentNumber}
                </p>
              </div>
              <div>
                <span className="font-semibold text-navy-500">Nacionalidad:</span>
                <p className="text-navy-900">{selectedCandidate.nationality || 'No indicada'}</p>
              </div>
              <div>
                <span className="font-semibold text-navy-500">Estado Civil:</span>
                <p className="text-navy-900">{selectedCandidate.maritalStatus || 'No especificado'}</p>
              </div>
              <div>
                <span className="font-semibold text-navy-500">Correo Electrónico:</span>
                <p className="text-navy-900">{selectedCandidate.email || 'N/A'}</p>
              </div>
              <div>
                <span className="font-semibold text-navy-500">Teléfono:</span>
                <p className="text-navy-900">{selectedCandidate.phone || 'N/A'}</p>
              </div>
              <div>
                <span className="font-semibold text-navy-500">Ciudad / Dirección:</span>
                <p className="text-navy-900">
                  {selectedCandidate.cityResidence || 'N/A'}
                  {selectedCandidate.address ? ` (${selectedCandidate.address})` : ''}
                </p>
              </div>
              {selectedCandidate.salaryExpectation && (
                <div>
                  <span className="font-semibold text-navy-500 flex items-center">
                    <Dollar01Icon className="h-3 w-3 mr-0.5 text-navy-400" />
                    Aspiración Salarial:
                  </span>
                  <p className="text-brand-700 font-semibold">
                    ${selectedCandidate.salaryExpectation.toLocaleString('es-CO')} COP
                  </p>
                </div>
              )}
              {selectedCandidate.availability && (
                <div>
                  <span className="font-semibold text-navy-500 flex items-center">
                    <Clock01Icon className="h-3 w-3 mr-0.5 text-navy-400" />
                    Disponibilidad:
                  </span>
                  <p className="text-navy-900">{selectedCandidate.availability}</p>
                </div>
              )}
              <div>
                <span className="font-semibold text-navy-500">Estado:</span>
                <div className="mt-0.5">{getStatusBadge(selectedCandidate.status)}</div>
              </div>
            </div>

            {selectedCandidate.summary && (
              <div className="text-xs">
                <span className="font-semibold text-navy-500">Perfil:</span>
                <p className="text-navy-800 bg-navy-50 p-2.5 rounded mt-1">{selectedCandidate.summary}</p>
              </div>
            )}

            {/* Educacion */}
            <div className="text-xs">
              <span className="font-semibold text-navy-500 flex items-center mb-1">
                <CapIcon className="h-4 w-4 mr-1 text-brand-600" />
                Estudios ({selectedCandidate.education.length})
              </span>
              <div className="space-y-1">
                {selectedCandidate.education.map((e, idx) => (
                  <div key={idx} className="p-2 bg-navy-50 rounded">
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
              <span className="font-semibold text-navy-500 flex items-center mb-1">
                <Briefcase01Icon className="h-4 w-4 mr-1 text-brand-600" />
                Experiencia Laboral ({selectedCandidate.experience.length})
              </span>
              <div className="space-y-1">
                {selectedCandidate.experience.map((exp, idx) => (
                  <div key={idx} className="p-2 bg-navy-50 rounded">
                    <strong>{exp.position}</strong> en {exp.company} ({exp.startDate} - {exp.endDate || 'Actual'})
                    {exp.responsibilities && (
                      <p className="text-navy-600 text-[11px] mt-1">{exp.responsibilities}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Idiomas */}
            {selectedCandidate.languages && selectedCandidate.languages.length > 0 && (
              <div className="text-xs">
                <span className="font-semibold text-navy-500 flex items-center mb-1">
                  <LanguageCircleIcon className="h-4 w-4 mr-1 text-brand-600" />
                  Idiomas ({selectedCandidate.languages.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCandidate.languages.map((l, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded text-[11px]"
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
                <span className="font-semibold text-navy-500 flex items-center mb-1">
                  <Award01Icon className="h-4 w-4 mr-1 text-brand-600" />
                  Certificaciones y Diplomados ({selectedCandidate.certifications.length})
                </span>
                <div className="space-y-1">
                  {selectedCandidate.certifications.map((c, idx) => (
                    <div key={idx} className="p-1.5 bg-navy-50 rounded text-[11px]">
                      <strong>{c.name}</strong> {c.institution ? `(${c.institution})` : ''} {c.year ? `— ${c.year}` : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Habilidades */}
            <div className="text-xs">
              <span className="font-semibold text-navy-500 mb-1 block">Habilidades Reconocidas:</span>
              <div className="flex flex-wrap gap-1">
                {selectedCandidate.skills.map((s, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-brand-50 text-brand-800 border border-brand-200 rounded text-[11px]"
                  >
                    {s.skillName}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-navy-200 flex justify-end gap-2">
              <button
                onClick={() => setSelectedCandidate(null)}
                className="px-4 py-1.5 bg-navy-100 hover:bg-navy-200 text-navy-800 rounded text-xs font-semibold"
              >
                Cerrar
              </button>
              {selectedCandidate.status !== 'contratado' && (
                <button
                  onClick={() => handleConvertToEmployee(selectedCandidate)}
                  className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded text-xs font-semibold"
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
