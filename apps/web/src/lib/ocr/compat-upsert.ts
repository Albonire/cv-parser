/**
 * Respaldo de `Map.prototype.getOrInsertComputed` y `getOrInsert`.
 *
 * pdfjs-dist 6 usa estos metodos del proposal "Upsert" sin traer respaldo
 * propio, ni en el build moderno ni en el legacy. Chromium 141 y anteriores no
 * los implementan, de modo que `PDFPageProxy.render()` lanza
 * `TypeError: this[#methodPromises].getOrInsertComputed is not a function`.
 *
 * Esa llamada esta EXACTAMENTE en la ruta de los PDF escaneados: los PDF con
 * capa de texto solo usan `getTextContent()` y nunca la tocan. Por eso el banco
 * de PDF digitales marcaba 100% mientras la lectura de escaneos fallaba entera
 * en cualquier navegador que no fuera de ultima generacion.
 *
 * Se importa como primera dependencia de `pdf-reader.ts` para que se evalue
 * antes que el modulo de pdf.js.
 */

type Calculador<K, V> = (clave: K) => V;

interface MapaConUpsert<K, V> {
  getOrInsert?(clave: K, valor: V): V;
  getOrInsertComputed?(clave: K, calcular: Calculador<K, V>): V;
}

function instalar(prototipo: MapaConUpsert<unknown, unknown> & Partial<Map<unknown, unknown>>): void {
  if (typeof prototipo.getOrInsert !== 'function') {
    prototipo.getOrInsert = function (this: Map<unknown, unknown>, clave, valor) {
      if (!this.has(clave)) this.set(clave, valor);
      return this.get(clave);
    };
  }

  if (typeof prototipo.getOrInsertComputed !== 'function') {
    prototipo.getOrInsertComputed = function (this: Map<unknown, unknown>, clave, calcular) {
      if (!this.has(clave)) this.set(clave, calcular(clave));
      return this.get(clave);
    };
  }
}

instalar(Map.prototype as MapaConUpsert<unknown, unknown> & Map<unknown, unknown>);
instalar(WeakMap.prototype as unknown as MapaConUpsert<unknown, unknown> & Map<unknown, unknown>);
