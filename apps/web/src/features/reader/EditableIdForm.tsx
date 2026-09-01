import React, { useState } from 'react';
import { IdCardFormData } from '../../types/id-card';

interface EditableIdFormProps {
  initialData: IdCardFormData;
  onSave: (data: IdCardFormData) => void;
  onCancel: () => void;
  confidenceScore?: number;
}

export const EditableIdForm: React.FC<EditableIdFormProps> = ({
  initialData,
  onSave,
  onCancel,
  confidenceScore,
}) => {
  const [formData, setFormData] = useState<IdCardFormData>(initialData);

  const handleFieldChange = (field: keyof IdCardFormData, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="rounded-lg border border-fog bg-paper p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-fog mb-6 gap-3">
        <div>
          <h2 className="text-subheading font-semibold tracking-[-0.02em] text-ink">
            Formulario 5.3: Documento de Identidad
          </h2>
          <p className="text-xs text-steel mt-0.5">
            Revisa y confirma los datos extraídos de la cédula o pasaporte.
          </p>
        </div>
        {confidenceScore !== undefined && (
          <p className="text-micro text-steel">Precisión OCR {confidenceScore}%</p>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="mb-4 text-caption font-semibold uppercase tracking-[0.08em] text-steel">
            Datos Básicos
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Nombres</label>
              <input
                type="text"
                value={formData.firstNames || ''}
                onChange={(e) => handleFieldChange('firstNames', e.target.value)}
                className="w-full px-3 py-2 border border-fog rounded-lg text-sm focus:ring-1 focus:ring-signal-blue focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Apellidos</label>
              <input
                type="text"
                value={formData.lastNames || ''}
                onChange={(e) => handleFieldChange('lastNames', e.target.value)}
                className="w-full px-3 py-2 border border-fog rounded-lg text-sm focus:ring-1 focus:ring-signal-blue focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Tipo de Documento</label>
              <select
                value={formData.documentType || 'CC'}
                onChange={(e) => handleFieldChange('documentType', e.target.value)}
                className="w-full px-3 py-2 border border-fog rounded-lg text-sm focus:ring-1 focus:ring-signal-blue focus:outline-none"
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
              <label className="block text-xs font-medium text-ink mb-1">Número de Identificación</label>
              <input
                type="text"
                value={formData.documentNumber || ''}
                onChange={(e) => handleFieldChange('documentNumber', e.target.value)}
                className="w-full px-3 py-2 border border-fog rounded-lg text-sm focus:ring-1 focus:ring-signal-blue focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Género</label>
              <select
                value={formData.gender || ''}
                onChange={(e) => handleFieldChange('gender', e.target.value)}
                className="w-full px-3 py-2 border border-fog rounded-lg text-sm focus:ring-1 focus:ring-signal-blue focus:outline-none"
              >
                <option value="">No especificado</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-caption font-semibold uppercase tracking-[0.08em] text-steel">
            Nacimiento y Expedición
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Fecha de Nacimiento</label>
              <input
                type="date"
                value={formData.birthDate || ''}
                onChange={(e) => handleFieldChange('birthDate', e.target.value)}
                className="w-full px-3 py-2 border border-fog rounded-lg text-sm focus:ring-1 focus:ring-signal-blue focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Lugar de Expedición</label>
              <input
                type="text"
                value={formData.expeditionPlace || ''}
                onChange={(e) => handleFieldChange('expeditionPlace', e.target.value)}
                className="w-full px-3 py-2 border border-fog rounded-lg text-sm focus:ring-1 focus:ring-signal-blue focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end pt-6 space-x-3 border-t border-fog">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-steel hover:text-ink border border-transparent hover:bg-mist rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(formData)}
            className="px-5 py-2 text-sm font-medium text-white bg-signal-blue hover:bg-rosimar-blue-dark rounded-lg transition-colors flex items-center shadow-subtle"
          >
          Guardar Cédula
          </button>
        </div>
      </div>
    </div>
  );
};
