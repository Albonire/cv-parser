import React, { useState } from 'react';
import {
  CandidateFormData,
  EducationItem,
  ExperienceItem,
  SkillItem,
  ReferenceItem,
  LanguageItem,
  CertificationItem,
} from '../../types/candidate';
import { UserIcon, Briefcase01Icon, CapIcon, Wrench01Icon, Call02Icon, PlusSignIcon, Delete02Icon, FloppyDiskIcon, LanguageCircleIcon, Award01Icon, Dollar01Icon, Clock01Icon } from 'hugeicons-react';

interface EditableCvFormProps {
  initialData: CandidateFormData;
  onSave: (data: CandidateFormData) => void;
  onCancel: () => void;
  confidenceScore?: number;
}

export const EditableCvForm: React.FC<EditableCvFormProps> = ({
  initialData,
  onSave,
  onCancel,
  confidenceScore,
}) => {
  const [formData, setFormData] = useState<CandidateFormData>(initialData);

  const handleFieldChange = (field: keyof CandidateFormData, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Manejo de Educacion
  const handleAddEducation = () => {
    const newItem: EducationItem = {
      level: 'Universitario',
      institution: '',
      degree: '',
      endYear: '',
    };
    setFormData((prev) => ({ ...prev, education: [...prev.education, newItem] }));
  };

  const handleRemoveEducation = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index),
    }));
  };

  const handleEducationChange = (index: number, field: keyof EducationItem, value: string) => {
    setFormData((prev) => {
      const updated = [...prev.education];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, education: updated };
    });
  };

  // Manejo de Experiencia
  const handleAddExperience = () => {
    const newItem: ExperienceItem = {
      company: '',
      position: '',
      startDate: '',
      endDate: '',
      responsibilities: '',
    };
    setFormData((prev) => ({ ...prev, experience: [...prev.experience, newItem] }));
  };

  const handleRemoveExperience = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      experience: prev.experience.filter((_, i) => i !== index),
    }));
  };

  const handleExperienceChange = (index: number, field: keyof ExperienceItem, value: string | boolean) => {
    setFormData((prev) => {
      const updated = [...prev.experience];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, experience: updated };
    });
  };

  // Manejo de Idiomas
  const handleAddLanguage = () => {
    const newItem: LanguageItem = {
      language: 'Inglés',
      level: 'Intermedio',
    };
    const current = formData.languages || [];
    setFormData((prev) => ({ ...prev, languages: [...current, newItem] }));
  };

  const handleRemoveLanguage = (index: number) => {
    const current = formData.languages || [];
    setFormData((prev) => ({
      ...prev,
      languages: current.filter((_, i) => i !== index),
    }));
  };

  const handleLanguageChange = (index: number, field: keyof LanguageItem, value: string) => {
    const current = [...(formData.languages || [])];
    current[index] = { ...current[index], [field]: value };
    setFormData((prev) => ({ ...prev, languages: current }));
  };

  // Manejo de Certificaciones
  const handleAddCertification = () => {
    const newItem: CertificationItem = {
      name: '',
      institution: '',
      year: '',
    };
    const current = formData.certifications || [];
    setFormData((prev) => ({ ...prev, certifications: [...current, newItem] }));
  };

  const handleRemoveCertification = (index: number) => {
    const current = formData.certifications || [];
    setFormData((prev) => ({
      ...prev,
      certifications: current.filter((_, i) => i !== index),
    }));
  };

  const handleCertificationChange = (index: number, field: keyof CertificationItem, value: string) => {
    const current = [...(formData.certifications || [])];
    current[index] = { ...current[index], [field]: value };
    setFormData((prev) => ({ ...prev, certifications: current }));
  };

  // Manejo de Habilidades
  const handleAddSkill = () => {
    const newItem: SkillItem = {
      category: 'General',
      skillName: '',
      level: 'Intermedio',
    };
    setFormData((prev) => ({ ...prev, skills: [...prev.skills, newItem] }));
  };

  const handleRemoveSkill = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index),
    }));
  };

  const handleSkillChange = (index: number, field: keyof SkillItem, value: string) => {
    setFormData((prev) => {
      const updated = [...prev.skills];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, skills: updated };
    });
  };

  // Manejo de Referencias
  const handleAddReference = () => {
    const newItem: ReferenceItem = {
      referenceType: 'personal',
      name: '',
      phone: '',
    };
    setFormData((prev) => ({ ...prev, references: [...prev.references, newItem] }));
  };

  const handleRemoveReference = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      references: prev.references.filter((_, i) => i !== index),
    }));
  };

  const handleReferenceChange = (index: number, field: keyof ReferenceItem, value: string) => {
    setFormData((prev) => {
      const updated = [...prev.references];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, references: updated };
    });
  };

  return (
    <div className="bg-white rounded-xl border border-navy-200 shadow-md p-6">
      {/* Encabezado y Confianza */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-navy-200 mb-6 gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy-900 flex items-center">
            <UserIcon className="h-5 w-5 mr-2 text-brand-600" />
            Formulario 5.1: Hoja de Vida / Candidato
          </h2>
          <p className="text-xs text-navy-500 mt-0.5">
            Revisa y edita los datos extraídos antes de guardar en la base de datos de Rosimar S.A.S.
          </p>
        </div>
        {confidenceScore !== undefined && (
          <div className="flex items-center space-x-2 bg-navy-50 px-3 py-1.5 rounded-lg border border-navy-200">
            <span className="text-xs text-navy-600 font-medium">Confianza OCR:</span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded ${
                confidenceScore >= 0.85 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {Math.round(confidenceScore * 100)}%
            </span>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* Seccion 1: Datos Personales */}
        <div>
          <h3 className="text-sm font-bold text-navy-800 uppercase tracking-wider mb-3 flex items-center">
            <UserIcon className="h-4 w-4 mr-1.5 text-brand-600" />
            1. Datos Personales y de Contacto
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Nombres</label>
              <input
                type="text"
                value={formData.firstNames}
                onChange={(e) => handleFieldChange('firstNames', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Apellidos</label>
              <input
                type="text"
                value={formData.lastNames}
                onChange={(e) => handleFieldChange('lastNames', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Tipo de Documento</label>
              <select
                value={formData.documentType}
                onChange={(e) => handleFieldChange('documentType', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              >
                <option value="CC">Cédula de Ciudadanía (CC)</option>
                <option value="CE">Cédula de Extranjería (CE)</option>
                <option value="TI">Tarjeta de Identidad (TI)</option>
                <option value="PAS">Pasaporte (PAS)</option>
                <option value="PEP">PEP</option>
                <option value="PPT">PPT</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Número de Identificación</label>
              <input
                type="text"
                value={formData.documentNumber}
                onChange={(e) => handleFieldChange('documentNumber', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Correo Electrónico</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleFieldChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Teléfono / Celular</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => handleFieldChange('phone', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Ciudad de Residencia</label>
              <input
                type="text"
                value={formData.cityResidence || ''}
                onChange={(e) => handleFieldChange('cityResidence', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Dirección Residencial</label>
              <input
                type="text"
                value={formData.address || ''}
                placeholder="Ej. Calle 19 # 12-40"
                onChange={(e) => handleFieldChange('address', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Estado Civil</label>
              <select
                value={formData.maritalStatus || ''}
                onChange={(e) => handleFieldChange('maritalStatus', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              >
                <option value="">No especificado</option>
                <option value="Soltero">Soltero(a)</option>
                <option value="Casado">Casado(a)</option>
                <option value="Unión libre">Unión libre</option>
                <option value="Divorciado">Divorciado(a)</option>
                <option value="Viudo">Viudo(a)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Género / Sexo</label>
              <select
                value={formData.gender || ''}
                onChange={(e) => handleFieldChange('gender', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              >
                <option value="">No especificado</option>
                <option value="Femenino">Femenino</option>
                <option value="Masculino">Masculino</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Lugar de Nacimiento</label>
              <input
                type="text"
                value={formData.birthPlace || ''}
                placeholder="Ej. Bogotá"
                onChange={(e) => handleFieldChange('birthPlace', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Libreta Militar</label>
              <input
                type="text"
                value={formData.militaryCard || ''}
                placeholder="Ej. Primera clase"
                onChange={(e) => handleFieldChange('militaryCard', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Licencia de Conducción</label>
              <input
                type="text"
                value={formData.driverLicense || ''}
                placeholder="Ej. A2, C2"
                onChange={(e) => handleFieldChange('driverLicense', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Tarjeta Profesional / T.P.</label>
              <input
                type="text"
                value={formData.professionalCard || ''}
                onChange={(e) => handleFieldChange('professionalCard', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-navy-700 mb-1">Redes Sociales / Enlaces</label>
              <input
                type="text"
                value={formData.socialLinks ? formData.socialLinks.join(', ') : ''}
                placeholder="LinkedIn, GitHub, Portafolio separados por comas"
                onChange={(e) => {
                  const links = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                  handleFieldChange('socialLinks', links.length > 0 ? links : undefined);
                }}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Fecha de Nacimiento</label>
              <input
                type="text"
                value={formData.birthDate || ''}
                placeholder="DD/MM/AAAA"
                onChange={(e) => handleFieldChange('birthDate', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1 flex items-center">
                <Dollar01Icon className="h-3 w-3 mr-0.5 text-navy-500" />
                Expectativa Salarial ($ COP)
              </label>
              <input
                type="number"
                value={formData.salaryExpectation || ''}
                placeholder="Ej. 3500000"
                onChange={(e) => handleFieldChange('salaryExpectation', parseInt(e.target.value, 10) || undefined)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1 flex items-center">
                <Clock01Icon className="h-3 w-3 mr-0.5 text-navy-500" />
                Disponibilidad
              </label>
              <input
                type="text"
                value={formData.availability || ''}
                placeholder="Ej. Inmediata / 15 días"
                onChange={(e) => handleFieldChange('availability', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Seccion 2: Perfil y Resumen */}
        <div>
          <h3 className="text-sm font-bold text-navy-800 uppercase tracking-wider mb-3">
            2. Perfil y Titular Profesional
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Titular Profesional</label>
              <input
                type="text"
                value={formData.headline || ''}
                placeholder="Ej. Técnico en Automatización / Psicóloga de Selección"
                onChange={(e) => handleFieldChange('headline', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Resumen del Perfil</label>
              <textarea
                rows={3}
                value={formData.summary || ''}
                onChange={(e) => handleFieldChange('summary', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Seccion 3: Formacion Academica */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-navy-800 uppercase tracking-wider flex items-center">
              <CapIcon className="h-4 w-4 mr-1.5 text-brand-600" />
              3. Formación Académica
            </h3>
            <button
              type="button"
              onClick={handleAddEducation}
              className="inline-flex items-center text-xs text-brand-700 bg-brand-50 hover:bg-brand-100 font-medium px-2.5 py-1 rounded border border-brand-200"
            >
              <PlusSignIcon className="h-3.5 w-3.5 mr-1" />
              Agregar Estudio
            </button>
          </div>
          <div className="space-y-3">
            {formData.education.map((item, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row gap-3 p-3 bg-navy-50/50 rounded-lg border border-navy-200 items-start"
              >
                <div className="w-full sm:w-1/4">
                  <label className="block text-[11px] font-medium text-navy-600 mb-0.5">Nivel</label>
                  <select
                    value={item.level}
                    onChange={(e) => handleEducationChange(idx, 'level', e.target.value)}
                    className="w-full px-2 py-1.5 border border-navy-300 rounded text-xs bg-white"
                  >
                    <option value="Primaria">Primaria</option>
                    <option value="Bachiller">Bachiller</option>
                    <option value="Tecnico">Técnico</option>
                    <option value="Tecnologo">Tecnólogo</option>
                    <option value="Universitario">Universitario</option>
                    <option value="Posgrado">Posgrado / Especialización / Maestría</option>
                    <option value="Diplomado">Diplomado / Curso</option>
                  </select>
                </div>
                <div className="w-full sm:w-1/3">
                  <label className="block text-[11px] font-medium text-navy-600 mb-0.5">Título / Área</label>
                  <input
                    type="text"
                    value={item.degree}
                    onChange={(e) => handleEducationChange(idx, 'degree', e.target.value)}
                    className="w-full px-2 py-1.5 border border-navy-300 rounded text-xs bg-white"
                  />
                </div>
                <div className="w-full sm:w-1/3">
                  <label className="block text-[11px] font-medium text-navy-600 mb-0.5">Institución</label>
                  <input
                    type="text"
                    value={item.institution}
                    onChange={(e) => handleEducationChange(idx, 'institution', e.target.value)}
                    className="w-full px-2 py-1.5 border border-navy-300 rounded text-xs bg-white"
                  />
                </div>
                <div className="w-full sm:w-20">
                  <label className="block text-[11px] font-medium text-navy-600 mb-0.5">Año</label>
                  <input
                    type="text"
                    value={item.endYear || ''}
                    placeholder="2022"
                    onChange={(e) => handleEducationChange(idx, 'endYear', e.target.value)}
                    className="w-full px-2 py-1.5 border border-navy-300 rounded text-xs bg-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveEducation(idx)}
                  className="mt-4 sm:mt-5 text-red-600 hover:text-red-800 p-1"
                  title="Eliminar"
                >
                  <Delete02Icon className="h-4 w-4" />
                </button>
              </div>
            ))}
            {formData.education.length === 0 && (
              <p className="text-xs text-navy-400 italic">No se detectaron estudios. Haz clic en "Agregar Estudio".</p>
            )}
          </div>
        </div>

        {/* Seccion 4: Experiencia Laboral */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-navy-800 uppercase tracking-wider flex items-center">
              <Briefcase01Icon className="h-4 w-4 mr-1.5 text-brand-600" />
              4. Experiencia Laboral
            </h3>
            <button
              type="button"
              onClick={handleAddExperience}
              className="inline-flex items-center text-xs text-brand-700 bg-brand-50 hover:bg-brand-100 font-medium px-2.5 py-1 rounded border border-brand-200"
            >
              <PlusSignIcon className="h-3.5 w-3.5 mr-1" />
              Agregar Experiencia
            </button>
          </div>
          <div className="space-y-3">
            {formData.experience.map((item, idx) => (
              <div key={idx} className="p-3 bg-navy-50/50 rounded-lg border border-navy-200 space-y-2">
                <div className="flex flex-col sm:flex-row gap-3 items-start">
                  <div className="w-full sm:w-1/3">
                    <label className="block text-[11px] font-medium text-navy-600 mb-0.5">Empresa</label>
                    <input
                      type="text"
                      value={item.company}
                      onChange={(e) => handleExperienceChange(idx, 'company', e.target.value)}
                      className="w-full px-2 py-1.5 border border-navy-300 rounded text-xs bg-white"
                    />
                  </div>
                  <div className="w-full sm:w-1/3">
                    <label className="block text-[11px] font-medium text-navy-600 mb-0.5">Cargo</label>
                    <input
                      type="text"
                      value={item.position}
                      onChange={(e) => handleExperienceChange(idx, 'position', e.target.value)}
                      className="w-full px-2 py-1.5 border border-navy-300 rounded text-xs bg-white"
                    />
                  </div>
                  <div className="w-full sm:w-1/6">
                    <label className="block text-[11px] font-medium text-navy-600 mb-0.5">Inicio</label>
                    <input
                      type="text"
                      value={item.startDate || ''}
                      placeholder="2020"
                      onChange={(e) => handleExperienceChange(idx, 'startDate', e.target.value)}
                      className="w-full px-2 py-1.5 border border-navy-300 rounded text-xs bg-white"
                    />
                  </div>
                  <div className="w-full sm:w-1/6">
                    <label className="block text-[11px] font-medium text-navy-600 mb-0.5">Fin</label>
                    <input
                      type="text"
                      value={item.endDate || ''}
                      placeholder="2022 o Actual"
                      onChange={(e) => handleExperienceChange(idx, 'endDate', e.target.value)}
                      className="w-full px-2 py-1.5 border border-navy-300 rounded text-xs bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveExperience(idx)}
                    className="mt-4 sm:mt-5 text-red-600 hover:text-red-800 p-1"
                    title="Eliminar"
                  >
                    <Delete02Icon className="h-4 w-4" />
                  </button>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-navy-600 mb-0.5">
                    Funciones / Responsabilidades
                  </label>
                  <textarea
                    rows={2}
                    value={item.responsibilities || ''}
                    onChange={(e) => handleExperienceChange(idx, 'responsibilities', e.target.value)}
                    className="w-full px-2 py-1.5 border border-navy-300 rounded text-xs bg-white"
                  />
                </div>
              </div>
            ))}
            {formData.experience.length === 0 && (
              <p className="text-xs text-navy-400 italic">No se detectó experiencia laboral previa.</p>
            )}
          </div>
        </div>

        {/* Seccion 5: Idiomas */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-navy-800 uppercase tracking-wider flex items-center">
              <LanguageCircleIcon className="h-4 w-4 mr-1.5 text-brand-600" />
              5. Idiomas
            </h3>
            <button
              type="button"
              onClick={handleAddLanguage}
              className="inline-flex items-center text-xs text-brand-700 bg-brand-50 hover:bg-brand-100 font-medium px-2.5 py-1 rounded border border-brand-200"
            >
              <PlusSignIcon className="h-3.5 w-3.5 mr-1" />
              Agregar Idioma
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {(formData.languages || []).map((item, idx) => (
              <div key={idx} className="flex items-center space-x-2 bg-navy-50 p-2 rounded-lg border border-navy-200">
                <input
                  type="text"
                  placeholder="Idioma (ej. Inglés)"
                  value={item.language}
                  onChange={(e) => handleLanguageChange(idx, 'language', e.target.value)}
                  className="w-1/2 px-2 py-1 border border-navy-300 rounded text-xs bg-white"
                />
                <select
                  value={item.level}
                  onChange={(e) => handleLanguageChange(idx, 'level', e.target.value)}
                  className="w-1/2 px-2 py-1 border border-navy-300 rounded text-xs bg-white"
                >
                  <option value="Básico">Básico (A1-A2)</option>
                  <option value="Intermedio">Intermedio (B1-B2)</option>
                  <option value="Avanzado">Avanzado (C1-C2)</option>
                  <option value="Nativo">Nativo</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleRemoveLanguage(idx)}
                  className="text-red-500 hover:text-red-700 p-1"
                >
                  <Delete02Icon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          {(!formData.languages || formData.languages.length === 0) && (
            <p className="text-xs text-navy-400 italic">No se detectaron idiomas adicionales.</p>
          )}
        </div>

        {/* Seccion 6: Certificaciones y Cursos */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-navy-800 uppercase tracking-wider flex items-center">
              <Award01Icon className="h-4 w-4 mr-1.5 text-brand-600" />
              6. Certificaciones y Diplomados
            </h3>
            <button
              type="button"
              onClick={handleAddCertification}
              className="inline-flex items-center text-xs text-brand-700 bg-brand-50 hover:bg-brand-100 font-medium px-2.5 py-1 rounded border border-brand-200"
            >
              <PlusSignIcon className="h-3.5 w-3.5 mr-1" />
              Agregar Certificación
            </button>
          </div>
          <div className="space-y-2">
            {(formData.certifications || []).map((item, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row gap-2 p-2 bg-navy-50/50 rounded-lg border border-navy-200 items-start sm:items-center">
                <input
                  type="text"
                  placeholder="Nombre de la certificación o curso"
                  value={item.name}
                  onChange={(e) => handleCertificationChange(idx, 'name', e.target.value)}
                  className="flex-1 px-2 py-1 border border-navy-300 rounded text-xs bg-white"
                />
                <input
                  type="text"
                  placeholder="Institución emisora (ej. SENA, AWS)"
                  value={item.institution || ''}
                  onChange={(e) => handleCertificationChange(idx, 'institution', e.target.value)}
                  className="w-48 px-2 py-1 border border-navy-300 rounded text-xs bg-white"
                />
                <input
                  type="text"
                  placeholder="Año"
                  value={item.year || ''}
                  onChange={(e) => handleCertificationChange(idx, 'year', e.target.value)}
                  className="w-20 px-2 py-1 border border-navy-300 rounded text-xs bg-white"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveCertification(idx)}
                  className="text-red-500 hover:text-red-700 p-1"
                >
                  <Delete02Icon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          {(!formData.certifications || formData.certifications.length === 0) && (
            <p className="text-xs text-navy-400 italic">No se detectaron certificaciones previas.</p>
          )}
        </div>

        {/* Seccion 7: Habilidades */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-navy-800 uppercase tracking-wider flex items-center">
              <Wrench01Icon className="h-4 w-4 mr-1.5 text-brand-600" />
              7. Habilidades y Competencias
            </h3>
            <button
              type="button"
              onClick={handleAddSkill}
              className="inline-flex items-center text-xs text-brand-700 bg-brand-50 hover:bg-brand-100 font-medium px-2.5 py-1 rounded border border-brand-200"
            >
              <PlusSignIcon className="h-3.5 w-3.5 mr-1" />
              Agregar Habilidad
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {formData.skills.map((item, idx) => (
              <div key={idx} className="flex items-center space-x-2 bg-navy-50 p-2 rounded border border-navy-200">
                <input
                  type="text"
                  value={item.skillName}
                  onChange={(e) => handleSkillChange(idx, 'skillName', e.target.value)}
                  className="w-full px-2 py-1 border border-navy-300 rounded text-xs bg-white"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveSkill(idx)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Delete02Icon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Seccion 8: Referencias */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-navy-800 uppercase tracking-wider flex items-center">
              <Call02Icon className="h-4 w-4 mr-1.5 text-brand-600" />
              8. Referencias Familiares y Personales
            </h3>
            <button
              type="button"
              onClick={handleAddReference}
              className="inline-flex items-center text-xs text-brand-700 bg-brand-50 hover:bg-brand-100 font-medium px-2.5 py-1 rounded border border-brand-200"
            >
              <PlusSignIcon className="h-3.5 w-3.5 mr-1" />
              Agregar Referencia
            </button>
          </div>
          <div className="space-y-2">
            {formData.references.map((item, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row gap-2 p-2 bg-navy-50/50 rounded border border-navy-200 items-start sm:items-center"
              >
                <select
                  value={item.referenceType}
                  onChange={(e) =>
                    handleReferenceChange(idx, 'referenceType', e.target.value as 'familiar' | 'personal' | 'laboral')
                  }
                  className="px-2 py-1 border border-navy-300 rounded text-xs bg-white"
                >
                  <option value="personal">Personal</option>
                  <option value="familiar">Familiar</option>
                  <option value="laboral">Laboral</option>
                </select>
                <input
                  type="text"
                  placeholder="Nombre"
                  value={item.name}
                  onChange={(e) => handleReferenceChange(idx, 'name', e.target.value)}
                  className="flex-1 px-2 py-1 border border-navy-300 rounded text-xs bg-white"
                />
                <input
                  type="text"
                  placeholder="Teléfono"
                  value={item.phone}
                  onChange={(e) => handleReferenceChange(idx, 'phone', e.target.value)}
                  className="w-36 px-2 py-1 border border-navy-300 rounded text-xs bg-white"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveReference(idx)}
                  className="text-red-500 hover:text-red-700 p-1"
                >
                  <Delete02Icon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Botones de Accion */}
      <div className="mt-8 pt-4 border-t border-navy-200 flex flex-col sm:flex-row justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-navy-700 bg-navy-100 hover:bg-navy-200 rounded-lg transition-colors"
        >
          Descartar / Cancelar
        </button>
        <button
          type="button"
          onClick={() => onSave(formData)}
          className="inline-flex items-center justify-center px-5 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition-colors"
        >
          <FloppyDiskIcon className="h-4 w-4 mr-1.5" />
          Guardar Candidato en el Sistema
        </button>
      </div>
    </div>
  );
};
