import React, { useState } from 'react';
import { SquareLockPasswordIcon } from 'hugeicons-react';
import { SessionUser } from '../../types/session';
import { verificarClaveAdmin, CLAVE_ADMIN_DEFAULT } from '../../lib/employer';
import './LoginView.css';

interface LoginViewProps {
  onLogin: (user: SessionUser) => void;
}

/**
 * Acceso de administrador. Sin Backend (costo $0, 100% en el navegador): la
 * contraseña se verifica contra un hash guardado en este dispositivo y se
 * cambia en Configuracion, seccion "Contraseña de Administrador".
 *
 * El estilo vive en LoginView.css (CSS plano con colores HEX literales), de
 * modo que la tarjeta se renderiza identica sin depender de utilidades de
 * Tailwind ni de tokens del tema.
 */
export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [clave, setClave] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!clave) {
      setError('Escriba la contraseña de administrador.');
      return;
    }

    setVerificando(true);
    try {
      const valida = await verificarClaveAdmin(clave);
      if (!valida) {
        setError('Contraseña incorrecta. Intentelo de nuevo.');
        setClave('');
        return;
      }
      onLogin({ role: 'admin', name: 'Administrador' });
    } finally {
      setVerificando(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Cabecera: marca institucional */}
        <header className="login-brand">
          <span className="login-brand-logo">R</span>
          <h1 className="login-brand-name">Rosimar S.A.S.</h1>
          <p className="login-brand-tagline">Gestión de Talento Humano</p>
        </header>

        {/* Formulario */}
        <div className="login-body">
          <h2 className="login-title">Iniciar sesión</h2>
          <p className="login-subtitle">
            Ingresa tus credenciales para administrar el talento humano.
          </p>

          <form className="login-form" onSubmit={handleSubmit}>
            <div>
              <label className="login-label" htmlFor="clave-admin">
                Contraseña
              </label>
              <div className="login-input-wrap">
                <span className="login-icon" aria-hidden="true">
                  <SquareLockPasswordIcon className="icon" width="16" height="16" />
                </span>
                <input
                  id="clave-admin"
                  name="clave-admin"
                  className="login-input"
                  type={mostrar ? 'text' : 'password'}
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  placeholder="Ingrese su contraseña"
                  autoComplete="current-password"
                  autoFocus
                />
                <button
                  type="button"
                  className="login-toggle"
                  onClick={() => setMostrar((v) => !v)}
                  aria-label={mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {mostrar ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            <button type="submit" className="login-submit" disabled={verificando}>
              {verificando ? 'Verificando...' : 'Ingresar'}
            </button>
          </form>

          <p className="login-info">
            <strong>Primer acceso:</strong> la contraseña predeterminada es{' '}
            <code>{CLAVE_ADMIN_DEFAULT}</code>. Cámbiela después desde{' '}
            <strong>Configuración</strong>. Todo se almacena en este dispositivo.
          </p>
        </div>

        {/* Pie */}
        <footer className="login-footer">
          Operación local y sin conexión · Costo mensual de $0 en infraestructura
        </footer>
      </div>
    </div>
  );
};