import React, { useState } from 'react';
import { HealthFormData } from '../../types/health';

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
    <div className="rounded-lg border border-fog bg-paper p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-fog mb-6 gap-3">
        <div>
          <h2 className="text-subheading font-semibold tracking-[-0.02em] text-ink">
            Formulario 5.4: Seguridad Social y EPS
          </h2>
          <p className="text-xs text-steel mt-0.5">
            Revisa y confirma los datos extraídos del certificado de afiliación.
          </p>
        </div>
        {confidenceScore !== undefined && (
          <p className="text-micro text-steel">Precisión OCR {confidenceScore}%</p>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="mb-4 text-caption font-semibold uppercase tracking-[0.08em] text-steel">
            Titular del Documento
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Nombre del Cotizante</label>
              <input
                type="text"
                value={formData.workerName || ''}
                onChange={(e) => handleFieldChange('workerName', e.target.value)}
                className="w-full px-3 py-2 border border-fog rounded-lg text-sm focus:ring-1 focus:ring-signal-blue focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Documento de Identidad</label>
              <input
                type="text"
                value={formData.documentNumber || ''}
                onChange={(e) => handleFieldChange('documentNumber', e.target.value)}
                className="w-full px-3 py-2 border border-fog rounded-lg text-sm focus:ring-1 focus:ring-signal-blue focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-caption font-semibold uppercase tracking-[0.08em] text-steel">
            Entidades de Seguridad Social
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink mb-1">EPS (Salud)</label>
              <input
                type="text"
                value={formData.epsName || ''}
                placeholder="Ej. Sura, Sanitas"
                onChange={(e) => handleFieldChange('epsName', e.target.value)}
                className="w-full px-3 py-2 border border-fog rounded-lg text-sm focus:ring-1 focus:ring-signal-blue focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Régimen EPS</label>
              <select
                value={formData.epsRegime || 'Contributivo'}
                onChange={(e) => handleFieldChange('epsRegime', e.target.value)}
                className="w-full px-3 py-2 border border-fog rounded-lg text-sm focus:ring-1 focus:ring-signal-blue focus:outline-none"
              >
                <option value="Contributivo">Contributivo</option>
                <option value="Subsidiado">Subsidiado</option>
                <option value="Especial">Especial</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">ARL (Riesgos Laborales)</label>
              <input
                type="text"
                value={formData.arlName || ''}
                placeholder="Ej. Sura, Positiva"
                onChange={(e) => handleFieldChange('arlName', e.target.value)}
                className="w-full px-3 py-2 border border-fog rounded-lg text-sm focus:ring-1 focus:ring-signal-blue focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Fondo de Pensiones (AFP)</label>
              <input
                type="text"
                value={formData.pensionFund || ''}
                placeholder="Ej. Protección, Porvenir"
                onChange={(e) => handleFieldChange('pensionFund', e.target.value)}
                className="w-full px-3 py-2 border border-fog rounded-lg text-sm focus:ring-1 focus:ring-signal-blue focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Fondo de Cesantías</label>
              <input
                type="text"
                value={formData.severanceFund || ''}
                onChange={(e) => handleFieldChange('severanceFund', e.target.value)}
                className="w-full px-3 py-2 border border-fog rounded-lg text-sm focus:ring-1 focus:ring-signal-blue focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Caja de Compensación Familiar</label>
              <input
                type="text"
                value={formData.compensationBox || ''}
                placeholder="Ej. Compensar, Comfama"
                onChange={(e) => handleFieldChange('compensationBox', e.target.value)}
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
            className="px-5 py-2 text-sm font-medium text-white bg-signal-blue hover:bg-signal-blue rounded-lg transition-colors flex items-center shadow-subtle"
          >
          Guardar Afiliaciones
          </button>
        </div>
      </div>
    </div>
  );
};
