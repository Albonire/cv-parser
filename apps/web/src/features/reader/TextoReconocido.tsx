import React from 'react';

/**
 * Bloque de texto reconocido por el OCR.
 *
 * Existía tres veces en ReaderView, cada una con un tamaño y una altura
 * distintos (11px/max-h-64, 11px/max-h-80, 12px/max-h-96) y ninguna con
 * interlineado: monoespaciada pequeña, con `whitespace-pre-wrap` y sin
 * `line-height`, los renglones del OCR se ven pegados unos a otros y el bloque
 * resulta ilegible. Aquí hay un solo tamaño, interlineado holgado y tabulares
 * alineadas.
 */

interface TextoReconocidoProps {
  texto: string;
  /** Alto máximo del área desplazable. Por defecto, media pantalla. */
  alturaMaxima?: string;
  /** Mensaje cuando no se reconoció nada. */
  vacio?: string;
}

export const TextoReconocido: React.FC<TextoReconocidoProps> = ({
  texto,
  alturaMaxima = '24rem',
  vacio = 'No se reconocieron líneas de texto.',
}) => {
  const contenido = texto.trim();

  if (!contenido) {
    return <p className="rounded-lg bg-mist p-4 text-caption text-steel">{vacio}</p>;
  }

  return (
    <pre
      className="overflow-auto rounded-lg bg-mist p-4 font-mono text-caption leading-relaxed text-ink"
      style={{ maxHeight: alturaMaxima, tabSize: 4 }}
    >
      {contenido}
    </pre>
  );
};
