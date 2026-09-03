/**
 * Reconstruccion de direcciones de correo que el OCR ha leido mal.
 *
 * La arroba es el caracter que peor lee Tesseract en un escaneo: de los 40
 * documentos del banco de hojas de vida, veinte se quedaban sin correo y en
 * todos los casos revisados la arroba estaba leida como otra cosa. Se ha
 * medido que aparece de tres formas distintas, y las tres hay que cubrirlas:
 *
 *   gerencia Qrosimar.com.co    el glifo pegado al dominio
 *   jhon.ospinaQ gmail.com      el glifo pegado al usuario
 *   demurilloGhotmail.com       el glifo dentro de una sola palabra
 *
 * El modulo es comun a la ruta de hojas de vida y a la de contratos: la arroba
 * se lee igual de mal en las dos.
 */

/**
 * Glifos con los que el OCR confunde la arroba, medidos sobre los dos bancos.
 * Todos son mayusculas o simbolos: la arroba se suplanta siempre por un trazo
 * cerrado, y eso es lo que permite distinguirla de una letra de verdad. Sin
 * esa restriccion no habria forma de separar la "g" de "gmail" de una arroba
 * mal leida.
 */
const GLIFOS_ARROBA = 'CGOQE0©()@';

/** A veces son dos glifos seguidos: "martha.caicedoOQ correo.com". */
const GLIFOS_MAXIMOS = 2;

/** Dominios frecuentes: si el texto trae uno, la reconstruccion es casi segura. */
export const DOMINIOS_CONOCIDOS =
  /^(?:gmail|hotmail|outlook|yahoo|correo|live|icloud|protonmail)\.[a-z]{2,}(?:\.[a-z]{2,})?$/i;

/** Forma minima de un dominio: algo, un punto y una extension de letras. */
const FORMA_DOMINIO = /^[a-z0-9-]{2,}(?:\.[a-z]{2,}){1,2}$/i;

/** Un usuario tiene que tener letras y no ser el final de una frase. */
function usuarioValido(usuario: string): boolean {
  return usuario.length >= 2 && /[a-z]/i.test(usuario) && /^[a-z0-9_.+-]+$/i.test(usuario);
}

function todosGlifos(texto: string): boolean {
  return texto.length > 0 && [...texto].every((c) => GLIFOS_ARROBA.includes(c));
}

/**
 * Candidatos de corte entre dos fragmentos contiguos: el glifo pudo quedar al
 * final del primero o al principio del segundo, y pueden ser uno o dos.
 */
function cortes(izquierda: string, derecha: string): { usuario: string; dominio: string }[] {
  const salida: { usuario: string; dominio: string }[] = [];
  for (let k = GLIFOS_MAXIMOS; k >= 1; k--) {
    if (izquierda.length > k && todosGlifos(izquierda.slice(-k))) {
      salida.push({ usuario: izquierda.slice(0, -k), dominio: derecha });
    }
  }
  for (let k = 1; k <= GLIFOS_MAXIMOS; k++) {
    if (derecha.length > k && todosGlifos(derecha.slice(0, k))) {
      salida.push({ usuario: izquierda, dominio: derecha.slice(k) });
    }
  }
  return salida;
}

/**
 * Elige entre los cortes posibles. Primero los que dejan un dominio conocido,
 * que son seguros; despues vale con que tenga forma de dominio, que es el caso
 * de los corporativos ("rosimar.com.co").
 */
function unir(izquierda: string, derecha: string): string {
  const candidatos = cortes(izquierda, derecha).filter((c) => usuarioValido(c.usuario));
  const conocido = candidatos.find((c) => DOMINIOS_CONOCIDOS.test(c.dominio));
  const elegido = conocido ?? candidatos.find((c) => FORMA_DOMINIO.test(c.dominio));
  return elegido ? `${elegido.usuario}@${elegido.dominio}` : '';
}

/**
 * Una direccion es verosimil en un contexto flojo cuando el dominio es
 * conocido o el usuario tiene la forma habitual `nombre.apellido`. Sin esto,
 * un renglon degradado del perfil duro se convierte en un correo inventado:
 * medido, "conacivtusimat@om.co" en CT_04.
 */
function verosimil(direccion: string): boolean {
  const [usuario, dominio] = direccion.split('@');
  return DOMINIOS_CONOCIDOS.test(dominio) || usuario.includes('.');
}

/**
 * Reconstruye la primera direccion de correo verosimil del texto. Devuelve
 * cadena vacia si no hay ninguna: es preferible dejar el campo en blanco a
 * inventar una direccion, porque quien revisa ve el hueco y no ve el error.
 *
 * Se recorre renglon a renglon y palabra a palabra en vez de con una sola
 * expresion regular: una direccion partida en dos ("jhon.ospinaQ gmail.com")
 * queda en dos palabras contiguas, y una expresion global se come la primera
 * mitad al fallar el intento anterior.
 *
 * Con `estricto` se exige ademas que la direccion sea verosimil por si sola.
 * Se usa cuando no hay etiqueta que respalde la lectura y hay que barrer texto
 * cualquiera, donde el riesgo de inventar es real.
 */
export function reconstruirCorreoOcr(texto: string, opciones?: { estricto?: boolean }): string {
  const estricto = opciones?.estricto ?? false;
  const aceptar = (direccion: string): string => {
    const limpia = direccion.toLowerCase();
    return !estricto || verosimil(limpia) ? limpia : '';
  };

  for (const renglon of texto.split('\n')) {
    const palabras = renglon.split(/[ \t]+/).filter((p) => p.length > 0);

    // Direccion partida en dos palabras.
    for (let i = 0; i + 1 < palabras.length; i++) {
      const unido = unir(palabras[i], palabras[i + 1]);
      if (unido) {
        const aceptada = aceptar(unido);
        if (aceptada) return aceptada;
      }
    }

    // Direccion en una sola palabra, con el glifo dentro.
    for (const palabra of palabras) {
      if (!/\.[A-Za-z]{2,}$/.test(palabra)) continue;
      // Se prueba cada posicion como arroba, de izquierda a derecha, y se acepta
      // la primera que deje un usuario y un dominio validos.
      for (let i = 1; i < palabra.length - 3; i++) {
        if (!GLIFOS_ARROBA.includes(palabra[i])) continue;
        const usuario = palabra.slice(0, i);
        const dominio = palabra.slice(i + 1);
        if (!usuarioValido(usuario)) continue;
        if (DOMINIOS_CONOCIDOS.test(dominio) || (FORMA_DOMINIO.test(dominio) && usuario.includes('.'))) {
          const aceptada = aceptar(`${usuario}@${dominio}`);
          if (aceptada) return aceptada;
        }
      }
    }
  }

  return '';
}
