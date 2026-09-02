import React, { useMemo, useState } from 'react';
import { normalize } from '../../lib/ocr/text-utils';

/**
 * Bloque de texto reconocido por el OCR.
 *
 * Antes era un único <pre> con texto plano: los renglones y las secciones del
 * documento se perdían en un muro de texto. Ahora por defecto ofrece una vista
 * estructurada que reconstruye el orden de lectura, enumera las líneas y pone
 * en evidencia los encabezados de sección con las mismas expresiones que usa el
 * lector para segmentar, con un toggle para volver al texto original.
 */

interface TextoReconocidoProps {
  texto: string;
  /** Alto máximo del área desplazable. Por defecto, media pantalla. */
  alturaMaxima?: string;
  /** Mensaje cuando no se reconoció nada. */
  vacio?: string;
  /** Pestaña inicial: 'estructurado' por defecto. */
  modoInicial?: 'estructurado' | 'original';
}

/** Encabezados de sección típicos de los documentos que soporta el lector.
 *  Al comparar cada línea, cualquier coincidencia la marca como cabecera. */
const PATRONES_ENCABEZADOS: Array<{ clave: string; regex: RegExp }> = [
  { clave: 'datos', regex: /^\s*(datos\s+(personales|de\s+contacto)|informacion\s+personal|perfil\s+profesional)\s*$/i },
  { clave: 'educacion', regex: /^\s*(formacion\s+(academica|profesional)|educacion|estudios|estudios\s+realizados|preparacion\s+academica)\s*$/i },
  { clave: 'experiencia', regex: /^\s*experiencia\s*(laboral|profesional)?\s*$/i },
  { clave: 'habilidades', regex: /^\s*(habilidades|competencias|conocimientos|aptitudes|skills)\s*$/i },
  { clave: 'idiomas', regex: /^\s*idiomas\s*$/i },
  { clave: 'referencias', regex: /^\s*referencias\s*(personales|familiares|laborales)?\s*$/i },
  { clave: 'cursos', regex: /^\s*(cursos|certificaciones|seminarios)\s*$/i },
  { clave: 'contrato', regex: /^\s*contrato\s*(de\s+trabajo)?\s*$/i },
  { clave: 'clausula', regex: /^\s*(primera|segunda|tercera|cuarta|quinta|sexta|septima|octava|novena|decima)\s*(clausula|.[a]+)\b/i },
  { clave: 'memorando', regex: /^\s*memorando\s*$/i },
  { clave: 'para', regex: /^\s*para\s*[:]?\s+\S/i },
  { clave: 'asunto', regex: /^\s*asunto\s*[:]?\s+\S/i },
  { clave: 'liquidacion', regex: /^\s*(liquidacion\s*(final|de\s+contrato)?|liquidacion\s+y\s+finiquito)\s*$/i },
  { clave: 'empleador', regex: /^\s*empleador\s*[:]?\s+\S/i },
  { clave: 'trabajador', regex: /^\s*trabajador\s*[:]?\s+\S/i },
  { clave: 'eps', regex: /^\s*(eps|seguridad\s+social|salud)\s*[:]?\s+\S/i },
];

interface LineaRenderizada {
  n: number;
  texto: string;
  encabezado: { clave: string } | null;
}

export const TextoReconocido: React.FC<TextoReconocidoProps> = ({
  texto,
  alturaMaxima = '24rem',
  vacio = 'No se reconocieron líneas de texto.',
  modoInicial = 'estructurado',
}) => {
  const [modo, setModo] = useState<'estructurado' | 'original'>(modoInicial);
  const contenido = texto.trim();

  const lineas = useMemo<LineaRenderizada[]>(() => {
    if (!contenido) return [];
    return contenido.split('\n').map((raw, i) => {
      const linea = raw.replace(/\s+$/, '');
      // Se compara sin tildes: los patrones estan escritos sin diacriticos y
      // "FORMACIÓN ACADÉMICA" -- que es como se escribe de verdad y como llega
      // de un PDF o un Word -- no casaba, mientras que la version sin tildes del
      // OCR si. `normalize` es la misma funcion que usa el motor.
      const comparable = normalize(linea);
      const coincidencia = PATRONES_ENCABEZADOS.find(
        (p) => p.regex.test(comparable) && linea.length <= 60
      );
      return {
        n: i + 1,
        texto: linea,
        encabezado: coincidencia ? { clave: coincidencia.clave } : null,
      };
    });
  }, [contenido]);

  if (!contenido) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg bg-mist p-4">
        <p className="text-caption text-steel">{vacio}</p>
      </div>
    );
  }

  const totalLineas = lineas.length;
  const totalCaracteres = contenido.length;
  const seccionesDetectadas = lineas.filter((l) => l.encabezado).length;

  return (
    <div className="rounded-lg border border-fog overflow-hidden">
      {/* Encabezado del bloque: metadatos discretos y cambio de vista */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-fog bg-mist px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-steel">
          <span>{totalLineas} líneas</span>
          <span>{totalCaracteres.toLocaleString('es-CO')} caracteres</span>
          {seccionesDetectadas > 0 && (
            <span>
              {seccionesDetectadas} sección{seccionesDetectadas !== 1 ? 'es' : ''} detectada
              {seccionesDetectadas !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center rounded-md border border-fog bg-paper p-0.5 text-[11px] font-semibold">
          <button
            onClick={() => setModo('estructurado')}
            className={
              modo === 'estructurado'
                ? 'rounded bg-signal-blue px-2 py-0.5 text-white'
                : 'rounded px-2 py-0.5 text-steel hover:text-ink'
            }
          >
            Estructurado
          </button>
          <button
            onClick={() => setModo('original')}
            className={
              modo === 'original'
                ? 'rounded bg-signal-blue px-2 py-0.5 text-white'
                : 'rounded px-2 py-0.5 text-steel hover:text-ink'
            }
          >
            Original
          </button>
        </div>
      </div>

      {modo === 'original' ? (
        <pre
          className="overflow-auto rounded-b-lg bg-paper px-3 py-3 font-mono text-caption leading-relaxed text-ink"
          style={{ maxHeight: alturaMaxima, tabSize: 4 }}
        >
          {contenido}
        </pre>
      ) : (
        <div
          className="overflow-auto rounded-b-lg bg-paper"
          style={{ maxHeight: alturaMaxima }}
        >
          {lineas.map((linea, idx) => {
            const esNuevaSeccion =
              linea.encabezado &&
              (idx === 0 || lineas[idx - 1]?.encabezado?.clave !== linea.encabezado.clave);
            if (linea.texto.length === 0) return null;
            return linea.encabezado ? (
              <div
                key={linea.n}
                className={
                  'flex items-baseline gap-3 px-3 py-1.5' +
                  (esNuevaSeccion ? ' border-t border-fog bg-mist' : '')
                }
              >
                <span className="select-none font-mono text-[10px] text-ash">
                  {linea.n}
                </span>
                <span className="font-bold tracking-[-0.02em] text-ink uppercase">
                  {linea.texto}
                </span>
              </div>
            ) : (
              <div key={linea.n} className="flex items-baseline gap-3 px-3 py-px">
                <span className="select-none font-mono text-[10px] text-ash">
                  {linea.n}
                </span>
                <span className="font-mono text-caption text-ink">{linea.texto}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};