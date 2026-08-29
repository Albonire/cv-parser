import React, { useState } from 'react';
import { ContractFormData, ContractType, PaymentFrequency, ContractStatus } from '../../types/contract';
import { DocumentValidationIcon, Building01Icon, UserIcon, Calendar01Icon, Dollar01Icon, FloppyDiskIcon } from 'hugeicons-react';

interface EditableContractFormProps {
  initialData: ContractFormData;
  onSave: (data: ContractFormData) => void;
  onCancel: () => void;
  confidenceScore?: number;
}

export const EditableContractForm: React.FC<EditableContractFormProps> = ({
  initialData,
  onSave,
  onCancel,
  confidenceScore,
}) => {
  const [formData, setFormData] = useState<ContractFormData>(initialData);

  const handleFieldChange = (field: keyof ContractFormData, value: unknown) => {
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
            <DocumentValidationIcon className="h-5 w-5 mr-2 text-brand-600" />
            Formulario 5.2: Contrato de Trabajo (Colombia)
          </h2>
          <p className="text-xs text-navy-500 mt-0.5">
            Revisa y confirma las condiciones contractuales extraidas del documento.
          </p>
        </div>
        {confidenceScore !== undefined && (
          <div className="flex items-center space-x-2 bg-navy-50 px-3 py-1.5 rounded-lg border border-navy-200">
            <span className="text-xs text-navy-600 font-medium">Confianza OCR:</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-green-100 text-green-800">
              {Math.round(confidenceScore * 100)}%
            </span>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* Seccion 1: Empleador y Trabajador */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-navy-50/50 rounded-lg border border-navy-200 space-y-3">
            <h3 className="text-xs font-bold text-navy-800 uppercase tracking-wider flex items-center">
              <Building01Icon className="h-4 w-4 mr-1 text-brand-600" />
              1. Datos del Empleador
            </h3>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Razon Social</label>
              <input
                type="text"
                value={formData.employerName}
                onChange={(e) => handleFieldChange('employerName', e.target.value)}
                className="w-full px-3 py-1.5 border border-navy-300 rounded text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">NIT</label>
              <input
                type="text"
                value={formData.employerNit}
                onChange={(e) => handleFieldChange('employerNit', e.target.value)}
                className="w-full px-3 py-1.5 border border-navy-300 rounded text-sm bg-white"
              />
            </div>
          </div>

          <div className="p-4 bg-navy-50/50 rounded-lg border border-navy-200 space-y-3">
            <h3 className="text-xs font-bold text-navy-800 uppercase tracking-wider flex items-center">
              <UserIcon className="h-4 w-4 mr-1 text-brand-600" />
              2. Datos del Trabajador
            </h3>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Nombre Completo</label>
              <input
                type="text"
                value={formData.workerName}
                onChange={(e) => handleFieldChange('workerName', e.target.value)}
                className="w-full px-3 py-1.5 border border-navy-300 rounded text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Cedula / Documento</label>
              <input
                type="text"
                value={formData.workerDocumentNumber}
                onChange={(e) => handleFieldChange('workerDocumentNumber', e.target.value)}
                className="w-full px-3 py-1.5 border border-navy-300 rounded text-sm bg-white"
              />
            </div>
          </div>
        </div>

        {/* Seccion 2: Condiciones Laborales */}
        <div>
          <h3 className="text-xs font-bold text-navy-800 uppercase tracking-wider mb-3 flex items-center">
            <Dollar01Icon className="h-4 w-4 mr-1 text-brand-600" />
            3. Cargo, Salario y Modalidad
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Cargo a Desempeñar</label>
              <input
                type="text"
                value={formData.position}
                onChange={(e) => handleFieldChange('position', e.target.value)}
                className="w-full px-3 py-1.5 border border-navy-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Salario (Monto)</label>
              <input
                type="number"
                value={formData.salary}
                onChange={(e) => handleFieldChange('salary', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 border border-navy-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Forma de Pago</label>
              <select
                value={formData.paymentFrequency}
                onChange={(e) => handleFieldChange('paymentFrequency', e.target.value as PaymentFrequency)}
                className="w-full px-3 py-1.5 border border-navy-300 rounded text-sm"
              >
                <option value="mensual">Mensual</option>
                <option value="quincenal">Quincenal</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Tipo de Contrato</label>
              <select
                value={formData.contractType}
                onChange={(e) => handleFieldChange('contractType', e.target.value as ContractType)}
                className="w-full px-3 py-1.5 border border-navy-300 rounded text-sm"
              >
                <option value="termino_fijo">A Termino Fijo</option>
                <option value="indefinido">A Termino Indefinido</option>
                <option value="obra_labor">Por Obra o Labor</option>
                <option value="aprendizaje">Contrato de Aprendizaje</option>
                <option value="tiempo_parcial">Tiempo Parcial</option>
              </select>
            </div>
          </div>
        </div>

        {/* Seccion 3: Fechas, Periodo de Prueba y Preaviso */}
        <div>
          <h3 className="text-xs font-bold text-navy-800 uppercase tracking-wider mb-3 flex items-center">
            <Calendar01Icon className="h-4 w-4 mr-1 text-brand-600" />
            4. Fechas, Periodo de Prueba y Preaviso (RN-3 y RN-4)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Fecha de Inicio</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => handleFieldChange('startDate', e.target.value)}
                className="w-full px-3 py-1.5 border border-navy-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Fecha de Vencimiento</label>
              <input
                type="date"
                value={formData.endDate || ''}
                disabled={formData.contractType === 'indefinido'}
                onChange={(e) => handleFieldChange('endDate', e.target.value)}
                className="w-full px-3 py-1.5 border border-navy-300 rounded text-sm disabled:bg-navy-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Periodo de Prueba (Dias)</label>
              <input
                type="number"
                value={formData.trialPeriodDays}
                onChange={(e) => handleFieldChange('trialPeriodDays', parseInt(e.target.value, 10) || 60)}
                className="w-full px-3 py-1.5 border border-navy-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">Dias de Preaviso</label>
              <input
                type="number"
                value={formData.noticeDays}
                onChange={(e) => handleFieldChange('noticeDays', parseInt(e.target.value, 10) || 30)}
                className="w-full px-3 py-1.5 border border-navy-300 rounded text-sm"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-navy-700 mb-1">Lugar de Ejecucion</label>
          <input
            type="text"
            value={formData.executionPlace}
            onChange={(e) => handleFieldChange('executionPlace', e.target.value)}
            className="w-full px-3 py-1.5 border border-navy-300 rounded text-sm"
          />
        </div>
      </div>

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
          Guardar Contrato en el Sistema
        </button>
      </div>
    </div>
  );
};
