import React, { useState } from 'react';
import { IdCardFormData } from '../../types/id-card';
import { UserIcon, Calendar01Icon, Location01Icon, FloppyDiskIcon, Shield01Icon } from 'hugeicons-react';

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
    <div className="bg-white rounded-xl border border-navy-200 shadow-md p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-navy-200 mb-6 gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy-900 flex items-center">
            <Shield01Icon className="h-5 w-5 mr-2 text-brand-600" />
            Formulario 5.3: Documento de Identidad
          </h2>
          <p className="text-xs text-navy-500 mt-0.5">
            Revisa y confirma los datos extraídos de la cédula o pasaporte.
          </p>
        </div>
        {confidenceScore !== undefined && (
          <div className="flex items-center space-x-2 bg-navy-50 px-3 py-1.5 rounded-lg border border-navy-200">
            <span className="text-xs font-medium text-navy-600">Precisión OCR:</span>
            <span className={`text-sm font-bold ${confidenceScore >= 80 ? 'text-green-600' : 'text-amber-500'}`}>
              {confidenceScore}%
            </span>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-bold text-navy-800 uppercase tracking-wider mb-3 flex items-center">
            <UserIcon className="h-4 w-4 mr-1.5 text-brand-600" />
            Datos Básicos
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Nombres</label>
              <input
                type="text"
                value={formData.firstNames || ''}
                onChange={(e) => handleFieldChange('firstNames', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Apellidos</label>
              <input
                type="text"
                value={formData.lastNames || ''}
                onChange={(e) => handleFieldChange('lastNames', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Tipo de Documento</label>
              <select
                value={formData.documentType || 'CC'}
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
                value={formData.documentNumber || ''}
                onChange={(e) => handleFieldChange('documentNumber', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Género</label>
              <select
                value={formData.gender || ''}
                onChange={(e) => handleFieldChange('gender', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              >
                <option value="">No especificado</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-navy-800 uppercase tracking-wider mb-3 flex items-center">
            <Calendar01Icon className="h-4 w-4 mr-1.5 text-brand-600" />
            Nacimiento y Expedición
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Fecha de Nacimiento</label>
              <input
                type="date"
                value={formData.birthDate || ''}
                onChange={(e) => handleFieldChange('birthDate', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Lugar de Expedición</label>
              <input
                type="text"
                value={formData.expeditionPlace || ''}
                onChange={(e) => handleFieldChange('expeditionPlace', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end pt-6 space-x-3 border-t border-navy-200">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-navy-600 hover:text-navy-900 border border-transparent hover:bg-navy-50 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(formData)}
            className="px-5 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition-colors flex items-center"
          >
            <FloppyDiskIcon className="w-4 h-4 mr-2" />
            Guardar Cédula
          </button>
        </div>
      </div>
    </div>
  );
};
