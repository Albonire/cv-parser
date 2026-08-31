import React from 'react';
import { HistorialEmpleadoConLineaTiempo, mensajesHistorial, etiquetaRazonSalida } from '../../lib/offline/historial';
import { LiquidacionFormData } from '../../types/liquidacion';
import { ContractFormData } from '../../types/contract';
import { EmployeeStatusHistoryItem } from '../../types/employee-status-history';
import { TerminationReason } from '../../types/employee';

export interface DatosFotos {
  rol?: string;
  contrato?: ContractFormData;
  liquidacion?: LiquidacionFormData;
}

/** Evidencia laboral inferida de los documentos (empleado por historial). */
export interface EmpleadoPorHistorial {
  estado: 'activo' | 'inactivo';
  fechaSalida?: string;
  razonSalida?: TerminationReason;
}

interface HistorialEmpleadoPanelProps {
  /** Historial del empleado registrado en Rosimar; null si no esta registrado. */
  historial: HistorialEmpleadoConLineaTiempo | null;
  /** Datos leidos por OCR de las fotos del lote. */
  datosFotos?: DatosFotos;
  /** Evidencia laboral inferida de los documentos (empleado aun no en tabla). */
  porHistorial?: EmpleadoPorHistorial;
}

/** Panel que combina el historial registrado de un empleado de Rosimar con la
 *  informacion leida de las fotos (rol, contrato, liquidacion). Pone sobre la
 *  mesa los datos faltantes con avisos explicitos en lugar de dejarlos en silencio. */
export const HistorialEmpleadoPanel: React.FC<HistorialEmpleadoPanelProps> = ({
  historial,
  datosFotos,
  porHistorial,
}) => {
  if (!historial) {
    // Hay evidencia laboral en las fotos (contrato/liquidacion/renuncia) aunque
    // la persona aun no este en la tabla de empleados: es empleado por historial.
    if (porHistorial) {
      const esActivo = porHistorial.estado === 'activo';
      return (
        <div className="rounded-lg border border-fog bg-paper overflow-hidden">
          <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-3 bg-mist/50 border-b border-fog">
            <p className="text-caption font-semibold text-ink">Historial en Rosimar</p>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                esActivo ? 'bg-signal-blue/10 text-signal-blue' : 'bg-alert-surface text-alert'
              }`}
            >
              {esActivo ? 'EMPLEADO (HISTORIAL)' : 'EMPLEADO INACTIVO (HISTORIAL)'}
            </span>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-xs text-steel">
              Se detectaron documentos de relacion laboral (contrato, liquidacion o
              renuncia). <strong className="text-ink">Rosimar registrara a esta persona como empleado</strong>,
              no como candidato, al guardar.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <p className="text-[11px] text-steel uppercase tracking-wide">Estado</p>
                <p className={`text-sm font-semibold ${esActivo ? 'text-signal-blue' : 'text-alert'}`}>
                  {esActivo ? 'Activo' : 'Inactivo'}
                </p>
              </div>
              {!esActivo && (
                <div>
                  <p className="text-[11px] text-steel uppercase tracking-wide">Fecha de salida</p>
                  <p className="text-sm font-semibold text-ink">
                    {fechaLegible(porHistorial.fechaSalida) ?? 'No leida'}
                  </p>
                </div>
              )}
              {!esActivo && (
                <div>
                  <p className="text-[11px] text-steel uppercase tracking-wide">Razon de salida</p>
                  <p className="text-sm font-semibold text-ink">
                    {etiquetaRazonSalida(porHistorial.razonSalida) ?? 'No leida'}
                  </p>
                </div>
              )}
            </div>
            <p className="text-[11px] text-steel">
              Los formularios quedan precargados con los datos leidos; corrijalos antes de guardar (RN-7).
            </p>
          </div>
          {mostrarLeidoFotos(datosFotos)}
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-fog bg-paper p-4 space-y-2">
        <p className="text-caption font-semibold text-ink">Historial en Rosimar</p>
        <p className="text-xs text-steel">
          Este trabajador no esta registrado como empleado en Rosimar (activo o inactivo):
          se trata como candidato. Si aparece informacion de la empresa en las fotos,
          consulte el bloque "Leido de las fotos".
        </p>
        {mostrarLeidoFotos(datosFotos)}
      </div>
    );
  }

  const { empleado } = historial;
  const esActivo = empleado.status === 'activo';
  const avisos = mensajesHistorial(historial);

  return (
    <div className="rounded-lg border border-fog bg-paper overflow-hidden">
      <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-3 bg-mist/50 border-b border-fog">
        <p className="text-caption font-semibold text-ink">Historial en Rosimar</p>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            esActivo ? 'bg-signal-blue/10 text-signal-blue' : 'bg-alert-surface text-alert'
          }`}
        >
          {esActivo ? 'ACTIVO' : 'INACTIVO'}
        </span>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Campo label="Codigo" valor={empleado.employeeCode} />
          <Campo label="Rol actual" valor={historial.rolActual} faltante="No se encontro rol registrado" />
          <Campo label="Fecha de ingreso" valor={fechaLegible(empleado.hireDate)} />
          {!esActivo ? (
            <Campo
              label="Razon de salida"
              valor={etiquetaRazonSalida(empleado.terminationReason)}
              faltante="No se encontro la razon de salida"
            />
          ) : (
            <Campo label="Fecha de salida" valor={fechaLegible(empleado.terminationDate)} faltante="Empleado activo" />
          )}
        </div>

        {!esActivo && (
          <p className="text-xs text-steel">
            Fecha de salida:{' '}
            <strong className="text-ink">{fechaLegible(empleado.terminationDate) ?? 'No encontrada'}</strong>
          </p>
        )}

        {avisos.length > 0 && (
          <ul className="space-y-1">
            {avisos.map((a, i) => (
              <li
                key={i}
                className={`text-xs flex items-start ${
                  a.tipo === 'aviso' ? 'text-alert' : 'text-steel'
                }`}
              >
                <span className="mr-1.5 mt-0.5">•</span>
                {a.texto}
              </li>
            ))}
          </ul>
        )}

        <div>
          <p className="text-caption font-semibold uppercase tracking-[0.08em] text-steel mb-2">
            Linea de tiempo de estados
          </p>
          {historial.lineaTiempo && historial.lineaTiempo.length > 0 ? (
            <ol className="relative border-l border-mist ml-2 space-y-3 pl-4">
              {historial.lineaTiempo.map((ev) => (
                <li key={ev.id} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-steel" />
                  <p className="text-xs text-ink">
                    <strong>{etiquetaEventoEstado(ev.eventType)}</strong>{' '}
                    <span className="text-steel">· {fechaLegible(ev.date)}</span>
                  </p>
                  {(ev.terminationReason || ev.reason) && (
                    <p className="text-[11px] text-steel">
                      {etiquetaRazonSalida(ev.terminationReason)}
                      {ev.reason ? ` — ${ev.reason}` : ''}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-steel">
              Aun no hay eventos registrados (contratacion, salida o reingreso) para este empleado.
            </p>
          )}
        </div>

        {historial.contratos.length > 0 && (
          <div>
            <p className="text-caption font-semibold uppercase tracking-[0.08em] text-steel mb-2">
              Contratos registrados
            </p>
            <table className="min-w-full text-xs">
              <thead className="bg-mist text-steel font-semibold uppercase">
                <tr>
                  <th className="px-2 py-1 text-left">Rol</th>
                  <th className="px-2 py-1 text-left">Tipo</th>
                  <th className="px-2 py-1 text-left">Inicio</th>
                  <th className="px-2 py-1 text-left">Fin</th>
                  <th className="px-2 py-1 text-left">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist">
                {historial.contratos.map((c, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1 text-ink">{c.position || '-'}</td>
                    <td className="px-2 py-1 text-steel">{etiquetaTipoContrato(c.contractType)}</td>
                    <td className="px-2 py-1 text-steel">{fechaLegible(c.startDate) || '-'}</td>
                    <td className="px-2 py-1 text-steel">{fechaLegible(c.endDate) || '-'}</td>
                    <td className="px-2 py-1 text-steel">{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {historial.memorandos.length > 0 && (
          <div>
            <p className="text-caption font-semibold uppercase tracking-[0.08em] text-steel mb-2">
              Memorandos ({historial.empleado.memoCount})
            </p>
            <ul className="space-y-1">
              {historial.memorandos.map((m) => (
                <li key={m.id} className="text-xs text-steel flex justify-between">
                  <span>
                    {fechaLegible(m.memoDate)} · {m.subject || m.memoType}
                  </span>
                  {historial.empleado.memoCount >= 3 && (
                    <span className="text-alert font-bold">Alerta RN-2</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[11px] text-steel">
          {historial.numDocumentosExpediente} documentos en el expediente. Este documento se
          adjuntara a este empleado por su numero de documento al guardar.
        </p>
      </div>

      {mostrarLeidoFotos(datosFotos)}
    </div>
  );
};

function mostrarLeidoFotos(datosFotos?: DatosFotos) {
  if (!datosFotos || (!datosFotos.rol && !datosFotos.contrato && !datosFotos.liquidacion)) {
    return null;
  }
  return (
    <div className="px-4 py-3 border-t border-fog bg-paper space-y-2">
      <p className="text-caption font-semibold text-ink">Leido de las fotos (OCR)</p>
      {datosFotos.rol && (
        <p className="text-xs text-steel">
          Rol/cargo detectado: <strong className="text-ink">{datosFotos.rol}</strong>
        </p>
      )}
      {datosFotos.contrato && (
        <p className="text-xs text-steel">
          Contrato en las fotos: {datosFotos.contrato.position || 'sin cargo'} ·{' '}
          {datosFotos.contrato.salary
            ? `$${datosFotos.contrato.salary.toLocaleString('es-CO')}`
            : 'salario no leido'}{' '}
          · {etiquetaTipoContrato(datosFotos.contrato.contractType)}
          {datosFotos.contrato.startDate ? ` · desde ${fechaLegible(datosFotos.contrato.startDate)}` : ''}
        </p>
      )}
      {datosFotos.liquidacion && (
        <p className="text-xs text-steel">
          Liquidacion en las fotos:
          {datosFotos.liquidacion.fechaRetiro && ` retiro ${fechaLegible(datosFotos.liquidacion.fechaRetiro)}`}
          {datosFotos.liquidacion.totalLiquidacion !== undefined &&
            ` · total $${datosFotos.liquidacion.totalLiquidacion.toLocaleString('es-CO')}`}
          {!datosFotos.liquidacion.fechaRetiro && !datosFotos.liquidacion.totalLiquidacion &&
            ' datos parciales: revise el formulario'}
        </p>
      )}
      <p className="text-[11px] text-steel">
        Estos valores son una lectura automatica: verifique y corrija en los formularios antes de guardar (RN-7).
      </p>
    </div>
  );
}

function Campo({
  label,
  valor,
  faltante,
}: {
  label: string;
  valor?: string;
  faltante?: string;
}) {
  return (
    <div>
      <p className="text-[11px] text-steel uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-semibold ${valor ? 'text-ink' : 'text-alert'}`}>
        {valor ?? (faltante ?? 'No encontrado')}
      </p>
    </div>
  );
}

function fechaLegible(fecha?: string): string | undefined {
  if (!fecha) return undefined;
  const d = new Date(`${fecha}T00:00:00`);
  return isNaN(d.getTime()) ? fecha : d.toLocaleDateString('es-CO');
}

function etiquetaTipoContrato(tipo: string): string {
  const mapa: Record<string, string> = {
    termino_fijo: 'Termino fijo',
    indefinido: 'Indefinido',
    obra_labor: 'Obra o labor',
    aprendizaje: 'Aprendizaje',
    tiempo_parcial: 'Tiempo parcial',
    otro: 'Otro',
  };
  return mapa[tipo] ?? tipo;
}

function etiquetaEventoEstado(evento: EmployeeStatusHistoryItem['eventType']): string {
  switch (evento) {
    case 'contratado':
      return 'Contratacion';
    case 'inactivo':
      return 'Salida';
    case 'reingreso':
      return 'Reingreso';
  }
}
