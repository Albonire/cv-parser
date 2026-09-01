import React, { useState } from 'react';
import { LiquidacionFormData, LiquidacionConcepto } from '../../types/liquidacion';

interface EditableLiquidacionFormProps {
  initialData: LiquidacionFormData;
  onSave: (data: LiquidacionFormData) => void;
  onCancel: () => void;
  confidenceScore?: number;
}

type CampoClave =
  | 'fechaIngreso'
  | 'fechaRetiro'
  | 'diasTrabajados'
  | 'salarioBase'
  | 'cesantias'
  | 'interesesCesantias'
  | 'prima'
  | 'vacaciones'
  | 'indemnizacion'
  | 'totalLiquidacion'
  | 'fechaPago';

const CAMPOS: { clave: CampoClave; label: string; dinero?: boolean }[] = [
  { clave: 'fechaIngreso', label: 'Fecha de ingreso' },
  { clave: 'fechaRetiro', label: 'Fecha de retiro' },
  { clave: 'diasTrabajados', label: 'Dias trabajados' },
  { clave: 'salarioBase', label: 'Salario base', dinero: true },
  { clave: 'cesantias', label: 'Cesantias', dinero: true },
  { clave: 'interesesCesantias', label: 'Intereses de cesantias', dinero: true },
  { clave: 'prima', label: 'Prima', dinero: true },
  { clave: 'vacaciones', label: 'Vacaciones', dinero: true },
  { clave: 'indemnizacion', label: 'Indemnizacion', dinero: true },
  { clave: 'totalLiquidacion', label: 'Total a pagar', dinero: true },
  { clave: 'fechaPago', label: 'Fecha de pago' },
];

export const EditableLiquidacionForm: React.FC<EditableLiquidacionFormProps> = ({
  initialData,
  onSave,
  onCancel,
  confidenceScore,
}) => {
  const [formData, setFormData] = useState<LiquidacionFormData>(initialData);

  const handleFieldChange = <K extends keyof LiquidacionFormData>(field: K, value: LiquidacionFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const actualizarConcepto = (idx: number, parcial: Partial<LiquidacionConcepto>) => {
    const lista = (formData.otrosConceptos ?? []).map((c, i) =>
      i === idx ? { ...c, ...parcial } : c
    );
    handleFieldChange('otrosConceptos', lista);
  };

  const agregarConcepto = () => {
    handleFieldChange('otrosConceptos', [...(formData.otrosConceptos ?? []), { concepto: '', valor: 0 }]);
  };

  const eliminarConcepto = (idx: number) => {
    handleFieldChange(
      'otrosConceptos',
      (formData.otrosConceptos ?? []).filter((_, i) => i !== idx)
    );
  };

  const totalConceptos =
    (formData.otrosConceptos?.reduce((s, c) => s + (c.valor || 0), 0) ?? 0) +
    (formData.salarioBase || 0) +
    (formData.cesantias || 0) +
    (formData.interesesCesantias || 0) +
    (formData.prima || 0) +
    (formData.vacaciones || 0) +
    (formData.indemnizacion || 0);

  const hayTotal = (formData.totalLiquidacion ?? 0) > 0;
  const inconsistente = hayTotal && Math.abs(totalConceptos - (formData.totalLiquidacion ?? 0)) > 1;

  return (
    <div className="rounded-lg border border-fog bg-paper p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-fog mb-6 gap-3">
        <div>
          <h2 className="text-subheading font-semibold tracking-[-0.02em] text-ink">
            Liquidacion final de contrato
          </h2>
          <p className="text-xs text-steel mt-0.5">
            Revisa y confirma los valores y fechas extraidos del documento. Corrige cualquier
            error de lectura antes de guardar (RN-7).
          </p>
        </div>
        {confidenceScore !== undefined && (
          <p className="text-micro text-steel">
            Confianza de extraccion {Math.round(confidenceScore * 100)}%
          </p>
        )}
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <h3 className="text-caption font-semibold uppercase tracking-[0.08em] text-steel">
              Trabajador
            </h3>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Nombre</label>
              <input
                type="text"
                value={formData.workerName || ''}
                onChange={(e) => handleFieldChange('workerName', e.target.value)}
                className="w-full px-3 py-1.5 border border-fog rounded text-sm bg-paper"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Cedula / Documento</label>
              <input
                type="text"
                value={formData.workerDocumentNumber || ''}
                onChange={(e) => handleFieldChange('workerDocumentNumber', e.target.value)}
                className="w-full px-3 py-1.5 border border-fog rounded text-sm bg-paper"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Cargo</label>
              <input
                type="text"
                value={formData.cargo || ''}
                onChange={(e) => handleFieldChange('cargo', e.target.value)}
                className="w-full px-3 py-1.5 border border-fog rounded text-sm bg-paper"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Empleador</label>
              <input
                type="text"
                value={formData.employerName || ''}
                onChange={(e) => handleFieldChange('employerName', e.target.value)}
                className="w-full px-3 py-1.5 border border-fog rounded text-sm bg-paper"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-caption font-semibold uppercase tracking-[0.08em] text-steel">
              Periodo liquidado
            </h3>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Fecha de ingreso</label>
              <input
                type="date"
                value={formData.fechaIngreso || ''}
                onChange={(e) => handleFieldChange('fechaIngreso', e.target.value)}
                className="w-full px-3 py-1.5 border border-fog rounded text-sm bg-paper"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Fecha de retiro</label>
              <input
                type="date"
                value={formData.fechaRetiro || ''}
                onChange={(e) => handleFieldChange('fechaRetiro', e.target.value)}
                className="w-full px-3 py-1.5 border border-fog rounded text-sm bg-paper"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Dias trabajados</label>
              <input
                type="number"
                value={formData.diasTrabajados ?? ''}
                onChange={(e) => handleFieldChange('diasTrabajados', parseInt(e.target.value, 10) || undefined)}
                className="w-full px-3 py-1.5 border border-fog rounded text-sm bg-paper"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Fecha de pago</label>
              <input
                type="date"
                value={formData.fechaPago || ''}
                onChange={(e) => handleFieldChange('fechaPago', e.target.value)}
                className="w-full px-3 py-1.5 border border-fog rounded text-sm bg-paper"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-caption font-semibold uppercase tracking-[0.08em] text-steel">
              Valores liquidados (COP)
            </h3>
            {CAMPOS.filter((c) => c.dinero && c.clave !== 'totalLiquidacion').map((campo) => (
              <div key={campo.clave}>
                <label className="block text-xs font-medium text-ink mb-1">{campo.label}</label>
                <input
                  type="number"
                  value={(formData[campo.clave] as number) ?? ''}
                  onChange={(e) =>
                    handleFieldChange(campo.clave, parseFloat(e.target.value) || undefined)
                  }
                  className="w-full px-3 py-1.5 border border-fog rounded text-sm bg-paper"
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold text-ink uppercase tracking-wider mb-3">
            Otros conceptos
          </h3>
          {(formData.otrosConceptos ?? []).map((c, idx) => (
            <div key={idx} className="flex gap-2 mb-2">
              <input
                type="text"
                value={c.concepto}
                onChange={(e) => actualizarConcepto(idx, { concepto: e.target.value })}
                placeholder="Concepto"
                className="flex-1 px-3 py-1.5 border border-fog rounded text-sm bg-paper"
              />
              <input
                type="number"
                value={c.valor || ''}
                onChange={(e) => actualizarConcepto(idx, { valor: parseFloat(e.target.value) || 0 })}
                placeholder="Valor"
                className="w-40 px-3 py-1.5 border border-fog rounded text-sm bg-paper"
              />
              <button
                type="button"
                onClick={() => eliminarConcepto(idx)}
                className="px-3 py-1.5 text-sm text-alert hover:underline"
                aria-label="Eliminar concepto"
              >
                Quitar
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={agregarConcepto}
            className="text-xs font-semibold text-signal-blue hover:underline"
          >
            + Agregar concepto
          </button>
        </div>

        <div className="rounded-lg border border-fog bg-mist/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs text-steel">Total de conceptos sumados</p>
            <p className="text-xl font-bold text-ink">${totalConceptos.toLocaleString('es-CO')}</p>
          </div>
          <div className="sm:text-right">
            <label className="block text-xs font-medium text-ink mb-1">Total a pagar (documento)</label>
            <input
              type="number"
              value={formData.totalLiquidacion ?? ''}
              onChange={(e) => handleFieldChange('totalLiquidacion', parseFloat(e.target.value) || undefined)}
              className="px-3 py-1.5 border border-fog rounded text-sm bg-paper w-44"
            />
            {inconsistente && (
              <p className="text-[11px] text-alert mt-1">
                El total del documento no coincide con la suma de los conceptos. Revise.
              </p>
            )}
          </div>
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
          Guardar en expediente
        </button>
      </div>
    </div>
  );
};
