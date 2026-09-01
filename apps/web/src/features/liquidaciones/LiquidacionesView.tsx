import React, { useState } from 'react';
import { LiquidacionRecord } from '../../types/liquidacion-record';
import { EmployeeItem } from '../../types/employee';
import { actualizarLiquidacion } from '../../lib/offline/liquidacion';

interface LiquidacionesViewProps {
  liquidaciones: LiquidacionRecord[];
  employees: EmployeeItem[];
  /** Permite editar la fecha de retiro. */
  canManage?: boolean;
  onReload: () => void;
}

/** Formatea un monto en pesos colombianos con separador de miles. */
function formatoCOP(valor?: number | null): string {
  if (valor === undefined || valor === null) return '—';
  return `$${valor.toLocaleString('es-CO')}`;
}

function nombreDelEmpleado(liq: LiquidacionRecord, employees: EmployeeItem[]): string {
  const vinculado = employees.find((e) => e.id === liq.employeeId);
  if (vinculado?.candidateData) {
    return `${vinculado.candidateData.firstNames} ${vinculado.candidateData.lastNames}`;
  }
  return liq.liquidacionData.workerName || liq.workerDocumentNumber || 'Sin identificar';
}

export const LiquidacionesView: React.FC<LiquidacionesViewProps> = ({
  liquidaciones,
  employees,
  canManage = false,
  onReload,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandida, setExpandida] = useState<string | null>(null);

  const ordenadas = [...liquidaciones].sort(
    (a, b) => new Date(b.fechaRetiro || 0).getTime() - new Date(a.fechaRetiro || 0).getTime()
  );

  const filtradas = ordenadas.filter((liq) => {
    if (!searchTerm) return true;
    const nombre = nombreDelEmpleado(liq, employees).toLowerCase();
    const doc = liq.workerDocumentNumber.toLowerCase();
    return `${nombre} ${doc} ${liq.liquidacionData.cargo ?? ''}`.includes(searchTerm.toLowerCase());
  });

  const sinIdentificar = ordenadas.filter((liq) => !liq.employeeId).length;

  const cambiarFechaRetiro = async (liq: LiquidacionRecord, fecha: string) => {
    await actualizarLiquidacion(liq.id, { fechaRetiro: fecha });
    onReload();
  };

  return (
    <div className="space-y-6">
      {/* Encabezado y filtros */}
      <div className="flex flex-col items-start justify-between gap-4 pt-8 sm:flex-row sm:items-center">
        <p className="text-caption text-steel">
          {ordenadas.length} liquidacion{ordenadas.length !== 1 ? 'es' : ''}
          {sinIdentificar > 0 && (
            <> · {sinIdentificar} sin vincular a un empleado</>
          )}
        </p>

        <div className="relative w-48 sm:w-60">
          <input
            type="text"
            placeholder="Buscar por empleado o documento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-3 pr-3 py-1.5 border border-fog rounded-lg text-xs focus:outline-none"
          />
        </div>
      </div>

      {/* Tabla de liquidaciones */}
      <div className="bg-paper rounded-lg border border-fog overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-mist text-left text-xs">
            <thead className="bg-mist text-steel font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Empleado</th>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">Fecha retiro</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3 text-right">Total liquidado</th>
                <th className="px-4 py-3 text-right">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist bg-paper">
              {filtradas.map((liq) => {
                const nombre = nombreDelEmpleado(liq, employees);
                const sinVincular = !liq.employeeId;
                const datos = liq.liquidacionData;
                const detalleAbierto = expandida === liq.id;

                return (
                  <React.Fragment key={liq.id}>
                    <tr className="hover:bg-mist transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-ink">{nombre}</div>
                        {sinVincular && (
                          <div className="text-[11px] text-steel">Sin empleado vinculado</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-ink">{liq.workerDocumentNumber}</td>
                      <td className="px-4 py-3">
                        {liq.fechaRetiro ? (
                          canManage ? (
                            <input
                              type="date"
                              value={liq.fechaRetiro}
                              onChange={(e) => cambiarFechaRetiro(liq, e.target.value)}
                              aria-label={`Fecha de retiro de ${nombre}`}
                              className="border border-fog rounded px-2 py-1 text-xs"
                            />
                          ) : (
                            <span className="text-ink">{liq.fechaRetiro}</span>
                          )
                        ) : (
                          <span className="text-steel italic">Sin fecha</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-steel">{datos.cargo || '—'}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-ink">
                        {formatoCOP(datos.totalLiquidacion)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setExpandida(detalleAbierto ? null : liq.id)}
                          className="inline-flex items-center rounded-lg border border-fog px-2 py-1 text-[11px] font-semibold text-steel transition-colors hover:border-rosimar-blue hover:text-rosimar-blue"
                        >
                          {detalleAbierto ? 'Ocultar' : 'Ver conceptos'}
                        </button>
                      </td>
                    </tr>

                    {detalleAbierto && (
                      <tr>
                        <td colSpan={6} className="bg-mist/50 px-6 py-4">
                          <div className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-steel mb-1">
                                Prestaciones
                              </p>
                              <p className="text-xs">Cesantías: <span className="font-mono">{formatoCOP(datos.cesantias)}</span></p>
                              <p className="text-xs">Intereses cesantías: <span className="font-mono">{formatoCOP(datos.interesesCesantias)}</span></p>
                              <p className="text-xs">Prima: <span className="font-mono">{formatoCOP(datos.prima)}</span></p>
                              <p className="text-xs">Vacaciones: <span className="font-mono">{formatoCOP(datos.vacaciones)}</span></p>
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-steel mb-1">
                                Datos laborales
                              </p>
                              <p className="text-xs">Ingreso: {datos.fechaIngreso || '—'}</p>
                              <p className="text-xs">Retiro: {datos.fechaRetiro || '—'}</p>
                              <p className="text-xs">Días trabajados: {datos.diasTrabajados ?? '—'}</p>
                              <p className="text-xs">Salario base: <span className="font-mono">{formatoCOP(datos.salarioBase)}</span></p>
                              <p className="text-xs">Indemnización: <span className="font-mono">{formatoCOP(datos.indemnizacion)}</span></p>
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-steel mb-1">
                                Otros conceptos
                              </p>
                              {(datos.otrosConceptos ?? []).length === 0 && (
                                <p className="text-xs text-steel">Sin otros conceptos.</p>
                              )}
                              {(datos.otrosConceptos ?? []).map((c, i) => (
                                <p key={i} className="text-xs">
                                  {c.concepto}: <span className="font-mono">{formatoCOP(c.valor)}</span>
                                </p>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-steel italic">
                    No hay liquidaciones registradas. Léelas desde el lector o registra el retiro de un empleado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};