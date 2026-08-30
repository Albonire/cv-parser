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
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-alert-surface text-alert border border-alert">Critica</span>;
      case 'warning':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-warning-surface text-warning border border-warning">Advertencia</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-mist text-steel border border-fog">Informativa</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 pt-8">
        <p className="text-caption text-steel">
          {alerts.filter((a) => a.status !== 'resuelta').length} pendientes de {alerts.length}
        </p>
      </div>

      <div className="space-y-3">
        {alerts.map((alertItem) => (
          <div
            key={alertItem.id}
            className={`p-4 rounded-lg border transition-all ${
              alertItem.severity === 'critical'
                ? 'bg-alert-surface/70 border-alert'
                : alertItem.severity === 'warning'
                ? 'bg-warning-surface/70 border-warning'
                : 'bg-paper border-fog'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start space-x-3">
                <div className="mt-0.5">
                  {alertItem.severity === 'critical' ? (
                    <Shield02Icon className="h-5 w-5 text-alert" />
                  ) : alertItem.severity === 'warning' ? (
                    <Alert02Icon className="h-5 w-5 text-warning" />
                  ) : (
                    <Notification01Icon className="h-5 w-5 text-steel" />
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-bold text-ink">{alertItem.title}</h3>
                    {getSeverityBadge(alertItem.severity)}
                  </div>
                  <p className="text-xs text-ink mt-1">{alertItem.description}</p>
                  {alertItem.dueDate && (
                    <div className="flex items-center text-[11px] text-steel mt-1">
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
                    className="inline-flex items-center px-3 py-1 bg-paper hover:bg-mist border border-fog rounded text-xs font-semibold text-ink"
                  >
                    <CheckmarkCircle01Icon className="h-3.5 w-3.5 mr-1 text-steel" />
                    Marcar Resuelta
                  </button>
                ) : (
                  <span className="text-xs text-steel font-semibold flex items-center">
                    <CheckmarkCircle01Icon className="h-3.5 w-3.5 mr-1" />
                    Resuelta
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {alerts.length === 0 && (
          <div className="bg-paper p-8 rounded-lg border border-fog text-center text-steel italic">
            No hay alertas activas en el sistema. Todos los contratos y memorandos estan al dia.
          </div>
        )}
      </div>
    </div>
  );
};
