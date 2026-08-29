import React, { useState } from 'react';
import { HealthFormData } from '../../types/health';
import { LegalDocument02Icon, FloppyDiskIcon, Shield01Icon, UserIcon } from 'hugeicons-react';

interface EditableHealthFormProps {
  initialData: HealthFormData;
  onSave: (data: HealthFormData) => void;
  onCancel: () => void;
  confidenceScore?: number;
}

export const EditableHealthForm: React.FC<EditableHealthFormProps> = ({
  initialData,
  onSave,
  onCancel,
  confidenceScore,
}) => {
  const [formData, setFormData] = useState<HealthFormData>(initialData);

  const handleFieldChange = (field: keyof HealthFormData, value: unknown) => {
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
            Formulario 5.4: Seguridad Social y EPS
          </h2>
          <p className="text-xs text-navy-500 mt-0.5">
            Revisa y confirma los datos extraídos del certificado de afiliación.
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
            Titular del Documento
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Nombre del Cotizante</label>
              <input
                type="text"
                value={formData.workerName || ''}
                onChange={(e) => handleFieldChange('workerName', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Documento de Identidad</label>
              <input
                type="text"
                value={formData.documentNumber || ''}
                onChange={(e) => handleFieldChange('documentNumber', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-navy-800 uppercase tracking-wider mb-3 flex items-center">
            <LegalDocument02Icon className="h-4 w-4 mr-1.5 text-brand-600" />
            Entidades de Seguridad Social
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">EPS (Salud)</label>
              <input
                type="text"
                value={formData.epsName || ''}
                placeholder="Ej. Sura, Sanitas"
                onChange={(e) => handleFieldChange('epsName', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Régimen EPS</label>
              <select
                value={formData.epsRegime || 'Contributivo'}
                onChange={(e) => handleFieldChange('epsRegime', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              >
                <option value="Contributivo">Contributivo</option>
                <option value="Subsidiado">Subsidiado</option>
                <option value="Especial">Especial</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">ARL (Riesgos Laborales)</label>
              <input
                type="text"
                value={formData.arlName || ''}
                placeholder="Ej. Sura, Positiva"
                onChange={(e) => handleFieldChange('arlName', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Fondo de Pensiones (AFP)</label>
              <input
                type="text"
                value={formData.pensionFund || ''}
                placeholder="Ej. Protección, Porvenir"
                onChange={(e) => handleFieldChange('pensionFund', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Fondo de Cesantías</label>
              <input
                type="text"
                value={formData.severanceFund || ''}
                onChange={(e) => handleFieldChange('severanceFund', e.target.value)}
                className="w-full px-3 py-2 border border-navy-300 rounded-md text-sm focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Caja de Compensación Familiar</label>
              <input
                type="text"
                value={formData.compensationBox || ''}
                placeholder="Ej. Compensar, Comfama"
                onChange={(e) => handleFieldChange('compensationBox', e.target.value)}
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
            Guardar Afiliaciones
          </button>
        </div>
      </div>
    </div>
  );
};
