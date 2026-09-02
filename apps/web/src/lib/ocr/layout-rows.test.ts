import { describe, expect, it } from 'vitest';
import { groupWordsIntoRows, type Word } from './layout';

/**
 * El agrupado por renglones se hace por solapamiento vertical, y el umbral sale
 * de una altura de referencia. Estas pruebas fijan de donde tiene que salir esa
 * altura: del renglon que se esta armando, no de la primera palabra de la
 * pagina. Con una sola referencia para toda la pagina el resultado depende de
 * que palabra cae primero al ordenar, que en una hoja de vida es el titulo.
 */

function palabra(text: string, x: number, y: number, height: number): Word {
  return { text, x, y, width: text.length * height * 0.5, height, fontSize: height };
}

describe('groupWordsIntoRows', () => {
  it('mantiene en un renglon dos palabras de la misma linea con alturas distintas', () => {
    // Cualquier maquetacion mezcla tamaños: un titulo de 24 pt sobre un cuerpo
    // de 10. Y dentro de una misma linea las cajas del OCR no miden igual:
    // "Telefono:" lleva ascendentes y "3184567821" no, asi que el solapamiento
    // entre las dos es la altura de la mas baja.
    const palabras = [
      palabra('HOJA', 0, 10, 24),
      palabra('DE', 60, 10, 24),
      palabra('VIDA', 100, 10, 24),
      palabra('Telefono:', 0, 60, 12),
      palabra('3184567821', 80, 65, 7),
    ];

    const renglones = groupWordsIntoRows(palabras);

    expect(renglones).toHaveLength(2);
    expect(renglones[0].map((w) => w.text)).toEqual(['HOJA', 'DE', 'VIDA']);
    expect(renglones[1].map((w) => w.text)).toEqual(['Telefono:', '3184567821']);
  });

  it('no funde dos lineas seguidas del cuerpo aunque el titulo sea mucho mayor', () => {
    const palabras = [
      palabra('CURRICULUM', 0, 10, 26),
      palabra('Ingeniero', 0, 70, 10),
      palabra('industrial', 60, 70, 10),
      palabra('Bogota', 0, 84, 10),
      palabra('Colombia', 60, 84, 10),
    ];

    const renglones = groupWordsIntoRows(palabras);

    expect(renglones).toHaveLength(3);
    expect(renglones[1].map((w) => w.text)).toEqual(['Ingeniero', 'industrial']);
    expect(renglones[2].map((w) => w.text)).toEqual(['Bogota', 'Colombia']);
  });

  it('agrupa las celdas de una tabla con las filas desfasadas media linea', () => {
    // Es la tabla del contrato en papel: la columna de valores va desfasada
    // respecto a la de etiquetas, y aun asi etiqueta y valor son el mismo
    // renglon porque se solapan de sobra.
    const palabras = [
      palabra('Identificacion:', 0, 100, 11),
      palabra('9876527', 200, 105, 11),
      palabra('Cargo:', 0, 130, 11),
      palabra('CONDUCTOR', 200, 135, 11),
    ];

    const renglones = groupWordsIntoRows(palabras);

    expect(renglones).toHaveLength(2);
    expect(renglones[0].map((w) => w.text)).toEqual(['Identificacion:', '9876527']);
    expect(renglones[1].map((w) => w.text)).toEqual(['Cargo:', 'CONDUCTOR']);
  });
});
