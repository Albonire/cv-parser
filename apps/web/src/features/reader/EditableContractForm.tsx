import React, { useState } from 'react';
import { ContractFormData, ContractType, PaymentFrequency } from '../../types/contract';

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
    <div className="rounded-lg border border-fog bg-paper p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-fog mb-6 gap-3">
        <div>
          <h2 className="text-subheading font-semibold tracking-[-0.02em] text-ink">
            Formulario 5.2: Contrato de Trabajo (Colombia)
          </h2>
          <p className="text-xs text-steel mt-0.5">
            Revisa y confirma las condiciones contractuales extraidas del documento.
          </p>
        </div>
        {confidenceScore !== undefined && (
          <p className="text-micro text-steel">
            Confianza de extracción {Math.round(confidenceScore * 100)}%
          </p>
        )}
      </div>

      <div className="space-y-6">
        {/* Seccion 1: Empleador y Trabajador */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="text-caption font-semibold uppercase tracking-[0.08em] text-steel">
            1. Datos del Empleador
            </h3>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Razon Social</label>
              <input
                type="text"
                value={formData.employerName}
                onChange={(e) => handleFieldChange('employerName', e.target.value)}
                className="w-full px-3 py-1.5 border border-fog rounded text-sm bg-paper"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">NIT</label>
              <input
                type="text"
                value={formData.employerNit}
                onChange={(e) => handleFieldChange('employerNit', e.target.value)}
                className="w-full px-3 py-1.5 border border-fog rounded text-sm bg-paper"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Domicilio del Empleador</label>
              <input
                type="text"
                value={formData.employerAddress || ''}
                onChange={(e) => handleFieldChange('employerAddress', e.target.value)}
                className="w-full px-3 py-1.5 border border-fog rounded text-sm bg-paper"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Correo del Empleador</label>
              <input
                type="text"
                value={formData.employerEmail || ''}
                onChange={(e) => handleFieldChange('employerEmail', e.target.value)}
                className="w-full px-3 py-1.5 border border-fog rounded text-sm bg-paper"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-caption font-semibold uppercase tracking-[0.08em] text-steel">
            2. Datos del Trabajador
            </h3>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Nombre Completo</label>
              <input
                type="text"
                value={formData.workerName}
                onChange={(e) => handleFieldChange('workerName', e.target.value)}
                className="w-full px-3 py-1.5 border border-fog rounded text-sm bg-paper"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Cedula / Documento</label>
              <input
                type="text"
                value={formData.workerDocumentNumber}
                onChange={(e) => handleFieldChange('workerDocumentNumber', e.target.value)}
                className="w-full px-3 py-1.5 border border-fog rounded text-sm bg-paper"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Fecha de Nacimiento</label>
              <input
                type="date"
                value={formData.workerDateOfBirth || ''}
                onChange={(e) => handleFieldChange('workerDateOfBirth', e.target.value)}
                className="w-full px-3 py-1.5 border border-fog rounded text-sm bg-paper"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Domicilio del Trabajador</label>
              <input
                type="text"
                value={formData.workerAddress || ''}
                onChange={(e) => handleFieldChange('workerAddress', e.target.value)}
                className="w-full px-3 py-1.5 border border-fog rounded text-sm bg-paper"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Correo del Trabajador</label>
              <input
                type="text"
                value={formData.workerEmail || ''}
                onChange={(e) => handleFieldChange('workerEmail', e.target.value)}
                className="w-full px-3 py-1.5 border border-fog rounded text-sm bg-paper"
              />
            </div>
          </div>
        </div>

        {/* Seccion 2: Condiciones Laborales */}
        <div>
          <h3 className="text-xs font-bold text-ink uppercase tracking-wider mb-3 flex items-center">
            3. Cargo, Salario y Modalidad
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Cargo a Desempeñar</label>
              <input
                type="text"
                value={formData.position}
                onChange={(e) => handleFieldChange('position', e.target.value)}
                className="w-full px-3 py-1.5 border border-fog rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Salario (Monto)</label>
              <input
                type="number"
                value={formData.salary}
                onChange={(e) => handleFieldChange('salary', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 border border-fog rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Forma de Pago</label>
              <select
                value={formData.paymentFrequency}
                onChange={(e) => handleFieldChange('paymentFrequency', e.target.value as PaymentFrequency)}
                className="w-full px-3 py-1.5 border border-fog rounded text-sm"
              >
                <option value="mensual">Mensual</option>
                <option value="quincenal">Quincenal</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Tipo de Contrato</label>
              <select
                value={formData.contractType}
                onChange={(e) => handleFieldChange('contractType', e.target.value as ContractType)}
                className="w-full px-3 py-1.5 border border-fog rounded text-sm"
              >
                <option value="termino_fijo">A Termino Fijo</option>
                <option value="indefinido">A Termino Indefinido</option>
                <option value="obra_labor">Por Obra o Labor</option>
                <option value="aprendizaje">Contrato de Aprendizaje</option>
                <option value="tiempo_parcial">Tiempo Parcial</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Duracion (Meses)</label>
              <input
                type="number"
                value={formData.durationMonths ?? ''}
                onChange={(e) => handleFieldChange('durationMonths', parseInt(e.target.value, 10) || undefined)}
                className="w-full px-3 py-1.5 border border-fog rounded text-sm"
              />
            </div>
          </div>
        </div>

        {/* Seccion 3: Fechas, Periodo de Prueba y Preaviso */}
        <div>
          <h3 className="text-xs font-bold text-ink uppercase tracking-wider mb-3 flex items-center">
            4. Fechas, Periodo de Prueba y Preaviso (RN-3 y RN-4)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Fecha de Inicio</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => handleFieldChange('startDate', e.target.value)}
                className="w-full px-3 py-1.5 border border-fog rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Fecha de Vencimiento</label>
              <input
                type="date"
                value={formData.endDate || ''}
                disabled={formData.contractType === 'indefinido'}
                onChange={(e) => handleFieldChange('endDate', e.target.value)}
                className="w-full px-3 py-1.5 border border-fog rounded text-sm disabled:bg-mist"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Periodo de Prueba (Dias)</label>
              <input
                type="number"
                value={formData.trialPeriodDays}
                onChange={(e) => handleFieldChange('trialPeriodDays', parseInt(e.target.value, 10) || 60)}
                className="w-full px-3 py-1.5 border border-fog rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Dias de Preaviso</label>
              <input
                type="number"
                value={formData.noticeDays}
                onChange={(e) => handleFieldChange('noticeDays', parseInt(e.target.value, 10) || 30)}
                className="w-full px-3 py-1.5 border border-fog rounded text-sm"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink mb-1">Lugar de Ejecucion</label>
          <input
            type="text"
            value={formData.executionPlace}
            onChange={(e) => handleFieldChange('executionPlace', e.target.value)}
            className="w-full px-3 py-1.5 border border-fog rounded text-sm"
          />
        </div>
      </div>

      <div className="mt-8 pt-4 border-t border-fog flex flex-col sm:flex-row justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-ink bg-mist hover:bg-fog rounded-lg transition-colors"
        >
          Descartar / Cancelar
        </button>
        <button
          type="button"
          onClick={() => onSave(formData)}
          className="inline-flex items-center justify-center px-5 py-2 text-sm font-semibold text-white bg-signal-blue hover:bg-rosimar-blue-dark rounded-lg transition-colors shadow-subtle"
        >
          Guardar Contrato en el Sistema
        </button>
      </div>
    </div>
  );
};
