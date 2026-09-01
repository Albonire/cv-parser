import React, { useState, useEffect } from 'react';
import { EmployerConfig, DEFAULT_EMPLOYER, EMPLOYER_ID_DEFAULT } from '../../types/employer';
import { db } from '../../lib/offline/db';
import { writeAudit } from '../../lib/audit';
import { cambiarClaveAdmin } from '../../lib/employer';

export const EmployerSettingsView: React.FC = () => {
  const [config, setConfig] = useState<EmployerConfig>({ ...DEFAULT_EMPLOYER });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [claveNueva, setClaveNueva] = useState('');
  const [claveGuardando, setClaveGuardando] = useState(false);
  const [claveMensaje, setClaveMensaje] = useState<string | null>(null);

  const loadConfig = async () => {
    const existing = await db.employers.get(EMPLOYER_ID_DEFAULT);
    if (existing) setConfig(existing);
  };

  useEffect(() => {
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const toSave: EmployerConfig = { ...config, updatedAt: new Date().toISOString() };
      await db.employers.put(toSave);
      await writeAudit('settings', 'employers', toSave.id, 'configuracion del empleador actualizada');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Error al guardar la configuracion.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-warning-surface border border-warning rounded-lg p-4 text-xs text-warning">
        <strong className="font-bold">Empleador unico (RN-8):</strong>{' '}
        Los datos del empleador se aplican a todos los contratos, reportes y documentos del sistema.
      </div>

      <div className="bg-paper rounded-lg border border-fog p-6 space-y-6">
        <h3 className="text-sm font-bold text-ink border-b border-fog pb-2">Datos del Empleador</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
          <div>
            <label className="block font-medium text-ink mb-1">Razon Social *</label>
            <input
              type="text"
              value={config.businessName}
              onChange={(e) => setConfig({ ...config, businessName: e.target.value })}
              className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block font-medium text-ink mb-1">NIT *</label>
            <input
              type="text"
              value={config.nit}
              onChange={(e) => setConfig({ ...config, nit: e.target.value })}
              className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block font-medium text-ink mb-1">Representante Legal</label>
            <input
              type="text"
              value={config.legalRepresentative ?? ''}
              onChange={(e) => setConfig({ ...config, legalRepresentative: e.target.value })}
              className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-medium text-ink mb-1">Direccion</label>
            <input
              type="text"
              value={config.address ?? ''}
              onChange={(e) => setConfig({ ...config, address: e.target.value })}
              className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-medium text-ink mb-1">Telefono</label>
            <input
              type="text"
              value={config.phone ?? ''}
              onChange={(e) => setConfig({ ...config, phone: e.target.value })}
              className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-medium text-ink mb-1">Email de gestion humana</label>
            <input
              type="email"
              value={config.email ?? ''}
              onChange={(e) => setConfig({ ...config, email: e.target.value })}
              className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-medium text-ink mb-1">Sitio web</label>
            <input
              type="text"
              value={config.website ?? ''}
              onChange={(e) => setConfig({ ...config, website: e.target.value })}
              className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="bg-paper rounded-lg border border-fog p-6 space-y-6">
        <h3 className="text-sm font-bold text-ink border-b border-fog pb-2">Parametros de Reglas de Negocio</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
          <div>
            <label className="block font-medium text-ink mb-1">Limite de memorandos (RN-2)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={config.memoWarningThreshold}
              onChange={(e) => setConfig({ ...config, memoWarningThreshold: Number(e.target.value) || 3 })}
              className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-steel">Alerta al alcanzar este numero (por defecto 3)</p>
          </div>
          <div>
            <label className="block font-medium text-ink mb-1">Dias de preaviso vencimiento contrato (RN-3)</label>
            <input
              type="number"
              min={1}
              max={90}
              value={config.noticeDaysDefault}
              onChange={(e) => setConfig({ ...config, noticeDaysDefault: Number(e.target.value) || 30 })}
              className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-steel">Dias antes del vencimiento para alertar</p>
          </div>
          <div>
            <label className="block font-medium text-ink mb-1">Meses max periodo de prueba (RN-4)</label>
            <input
              type="number"
              min={1}
              max={3}
              value={config.trialPeriodMonthsDefault}
              onChange={(e) => setConfig({ ...config, trialPeriodMonthsDefault: Number(e.target.value) || 2 })}
              className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-steel">Maximo legal 2 meses (Colombia)</p>
          </div>
        </div>
      </div>

      <div className="bg-paper rounded-lg border border-fog p-6 space-y-6">
        <h3 className="text-sm font-bold text-ink border-b border-fog pb-2">Contraseña de Administrador</h3>
        <p className="text-xs text-steel">
          El acceso al sistema se autentica localmente con esta contraseña (100% en el
          navegador, costo $0). Se guarda como hash en el dispositivo.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="block font-medium text-ink mb-1">Nueva contraseña (min. 6 caracteres)</label>
            <input
              type="password"
              value={claveNueva}
              onChange={(e) => setClaveNueva(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-fog rounded bg-paper focus:outline-none focus:border-rosimar-blue"
            />
          </div>
          <button
            onClick={async () => {
              setClaveMensaje(null);
              setClaveGuardando(true);
              try {
                await cambiarClaveAdmin(claveNueva);
                await writeAudit('settings', 'employers', EMPLOYER_ID_DEFAULT, 'contraseña de administrador actualizada');
                setClaveNueva('');
                setClaveMensaje('Contraseña actualizada correctamente.');
              } catch (err) {
                setClaveMensaje((err as Error).message);
              } finally {
                setClaveGuardando(false);
              }
            }}
            disabled={claveGuardando || !claveNueva}
            className="px-5 py-2 bg-signal-blue hover:bg-rosimar-blue-dark text-white rounded-lg text-xs font-semibold transition-colors shadow-subtle disabled:opacity-50"
          >
            {claveGuardando ? 'Guardando...' : 'Cambiar Contraseña'}
          </button>
        </div>

        {claveMensaje && (
          <p className="text-xs font-semibold text-ink">{claveMensaje}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 bg-signal-blue hover:bg-rosimar-blue-dark text-white rounded-lg text-xs font-semibold transition-colors shadow-subtle disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar Configuracion'}
        </button>
        {saved && (
          <span className="text-xs font-semibold text-ink">Guardado correctamente.</span>
        )}
      </div>
    </div>
  );
};