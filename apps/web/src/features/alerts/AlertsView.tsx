import React from 'react';
import { AlertItem } from '../../types/alert';
import { db } from '../../lib/offline/db';
import { queueMutation } from '../../lib/offline/sync';
import { Alert02Icon, Shield02Icon, CheckmarkCircle01Icon, Notification01Icon, Clock01Icon } from 'hugeicons-react';

interface AlertsViewProps {
  alerts: AlertItem[];
  onReload: () => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({ alerts, onReload }) => {
  const handleMarkResolved = async (alertId: string) => {
    try {
      const alertItem = alerts.find((a) => a.id === alertId);
      if (!alertItem) return;

      const updated = {
        ...alertItem,
        status: 'resuelta' as const,
      };
      await db.alerts.put(updated);
      await queueMutation("update", "alerts", updated.id, updated as unknown as Record<string, unknown>);
      
      onReload();
    } catch (err) {
      console.error(err);
    }
  };

  const getSeverityBadge = (severity: 'info' | 'warning' | 'critical') => {
    switch (severity) {
      case 'critical':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 border border-red-300">Critica</span>;
      case 'warning':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">Advertencia</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">Informativa</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl border border-navy-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Notification01Icon className="h-6 w-6 text-brand-600" />
          <h2 className="text-lg font-bold text-navy-900">
            Centro de Alertas Automaticas ({alerts.filter((a) => a.status !== 'resuelta').length} Pendientes)
          </h2>
        </div>
      </div>

      <div className="space-y-3">
        {alerts.map((alertItem) => (
          <div
            key={alertItem.id}
            className={`p-4 rounded-xl border transition-all ${
              alertItem.severity === 'critical'
                ? 'bg-red-50/70 border-red-300 shadow-sm'
                : alertItem.severity === 'warning'
                ? 'bg-amber-50/70 border-amber-300'
                : 'bg-white border-navy-200'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start space-x-3">
                <div className="mt-0.5">
                  {alertItem.severity === 'critical' ? (
                    <Shield02Icon className="h-5 w-5 text-red-600" />
                  ) : alertItem.severity === 'warning' ? (
                    <Alert02Icon className="h-5 w-5 text-amber-600" />
                  ) : (
                    <Notification01Icon className="h-5 w-5 text-blue-600" />
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-bold text-navy-900">{alertItem.title}</h3>
                    {getSeverityBadge(alertItem.severity)}
                  </div>
                  <p className="text-xs text-navy-700 mt-1">{alertItem.description}</p>
                  {alertItem.dueDate && (
                    <div className="flex items-center text-[11px] text-navy-500 mt-1">
                      <Clock01Icon className="h-3 w-3 mr-1" />
                      Fecha limite / vencimiento: <strong>{alertItem.dueDate}</strong>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {alertItem.status !== 'resuelta' ? (
                  <button
                    onClick={() => handleMarkResolved(alertItem.id)}
                    className="inline-flex items-center px-3 py-1 bg-white hover:bg-navy-50 border border-navy-300 rounded text-xs font-semibold text-navy-800 shadow-sm"
                  >
                    <CheckmarkCircle01Icon className="h-3.5 w-3.5 mr-1 text-green-600" />
                    Marcar Resuelta
                  </button>
                ) : (
                  <span className="text-xs text-green-700 font-semibold flex items-center">
                    <CheckmarkCircle01Icon className="h-3.5 w-3.5 mr-1" />
                    Resuelta
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {alerts.length === 0 && (
          <div className="bg-white p-8 rounded-xl border border-navy-200 text-center text-navy-400 italic">
            No hay alertas activas en el sistema. Todos los contratos y memorandos estan al dia.
          </div>
        )}
      </div>
    </div>
  );
};
