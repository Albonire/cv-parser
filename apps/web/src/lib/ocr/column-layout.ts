export interface TextItemWithCoords {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  isBold?: boolean;
}

/**
 * Reordena bloques de texto detectando si la pagina tiene 1 o 2 columnas.
 * Evita mezclar renglones de la columna izquierda (datos personales/habilidades)
 * con la columna derecha (experiencia/educacion).
 */
export function sortTextItemsByColumns(items: TextItemWithCoords[], pageWidth: number): string {
  if (items.length === 0) return '';

  // 1. Filtrar items vacios
  const validItems = items.filter((item) => item.text.trim().length > 0);
  if (validItems.length === 0) return '';

  // 2. Evaluar distribucion en eje X para detectar separador central
  const midX = pageWidth / 2;
  const leftItems = validItems.filter((i) => i.x + i.width / 2 < midX);
  const rightItems = validItems.filter((i) => i.x + i.width / 2 >= midX);

  // Si ambas columnas tienen al menos el 20% del contenido, tratamos como diseno de 2 columnas
  const isTwoColumns =
    leftItems.length > validItems.length * 0.2 &&
    rightItems.length > validItems.length * 0.2;

  if (isTwoColumns) {
    // Ordenar columna izquierda de arriba hacia abajo
    leftItems.sort((a, b) => a.y - b.y);
    // Ordenar columna derecha de arriba hacia abajo
    rightItems.sort((a, b) => a.y - b.y);

    const leftText = groupLines(leftItems);
    const rightText = groupLines(rightItems);

    return `${leftText}\n\n${rightText}`;
  }

  // Si es columna unica, ordenar de arriba hacia abajo (y) y luego izquierda a derecha (x)
  validItems.sort((a, b) => {
    // Si estan aproximadamente en la misma linea vertical (+/- 4px)
    if (Math.abs(a.y - b.y) <= 4) {
      return a.x - b.x;
    }
    return a.y - b.y;
  });

  return groupLines(validItems);
}

function groupLines(items: TextItemWithCoords[]): string {
  if (items.length === 0) return '';

  const lines: string[] = [];
  let currentLine: TextItemWithCoords[] = [items[0]];

  for (let i = 1; i < items.length; i++) {
    const prev = currentLine[currentLine.length - 1];
    const curr = items[i];

    // Misma linea si la diferencia en Y es menor a la mitad de la altura de fuente
    const sameLineThreshold = Math.max(4, (curr.fontSize || 10) * 0.5);
    if (Math.abs(curr.y - prev.y) <= sameLineThreshold) {
      currentLine.push(curr);
    } else {
      // Ordenar items de la linea por X
      currentLine.sort((a, b) => a.x - b.x);
      lines.push(currentLine.map((c) => c.text).join(' '));
      currentLine = [curr];
    }
  }

  if (currentLine.length > 0) {
    currentLine.sort((a, b) => a.x - b.x);
    lines.push(currentLine.map((c) => c.text).join(' '));
  }

  return lines.join('\n');
}
