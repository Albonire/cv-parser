/**
 * Normalizacion determinista de palabras reconocidas por el OCR de fotos.
 *
 * Tesseract (spa+eng sobre fotos de WhatsApp) comete confusiones sistematicas:
 * letras por numeros o numeros por letras en digitos y montos, mayusculas
 * sueltas inyectadas en medio de minusculas, y trocitos de ruido pegados a una
 * palabra limpia. Estas suciedades no se ven en PDF digital ni en Word, que
 * tiene texto perfecto, y no es ahi donde hay que aplicarla: solo se aplica a
 * las palabras que vienen del OCR de imagenes (`image_ocr` y `pdf_ocr`).
 *
 * Todo es determinista y por palabra, sin modelos. Cada regla es conservadora:
 * si no hay una senal solida de que sea un error, se deja la palabra igual. Asi
 * no se rompe lo que el OCR ya reconocio bien.
 *
 * La regla mas delicada es la de montos y digitos. En un contrato escaneado
 * "1.600.000" puede llegar como "1.600.00O" o "1.600.000" y "900.123.456-7"
 * como "900.123.456 ~7"; corregir esos glifos es lo que marca la diferencia en
 * el salario y el NIT. Pero convertir agresivamente toda 'O' en '0' destrozaria
 * palabras normales ("COMBARRANQUILLA"), asi que el cambio de glifo solo se
 * permite cuando la palabra (o un bloque de ella) es SOLO digitos y separadores.
 */

/**
 * Un bloque con forma de numero: empieza por un digito y, ademas de digitos y
 * separadores de numero, tolera las pocas letras que Tesseract confunde con
 * cifras ('O' por cero, 'I'/'l'/'|' por uno, 'S' por cinco, '~' por guion).
 * La exigencia de que empiece POR UN DIGITO es la barrera que deja fuera las
 * palabras normales: "Combarranquilla" o "Salario" no arrancan con digito.
 */
const PATRON_NUMERICO = /^\d[\d.,\-\s~|OoIiSsl]*$/;

/** Caracteres-lista comunes entre una cifra y una palabra en una cadena numerica. */
function corregirGlifosNumericos(palabra: string): string {
  // En un contexto puramente numerico, 'O'/'o' es casi siempre un cero mal
  // leido (muchos OCR pasan el cero sin el trazo, o el 8 como O).
  let limpio = palabra
    .replace(/[Oo]/g, '0')
    .replace(/[Ii]/g, '1')
    .replace(/[Ss]/g, '5');

  // El guion del NIT llega a veces como '~' o como la barra vertical '|'. La
  // barra separa dos bloques de digitos, asi que no es un '1' sino el guion.
  if (/^\d[\d.,]*\|[\d.,-]*$/.test(limpio)) {
    limpio = limpio.replace(/\|/, '-');
  } else {
    limpio = limpio.replace(/[l|]/g, '1');
  }
  limpio = limpio.replace(/~/, '-');

  return limpio;
}

/**
 * Limpia una palabra del OCR de una foto. No toca mayusculas (los extractores
 * las necesitan para distinguir nombres y encabezados).
 */
export function normalizarPalabraOcr(palabra: string): string {
  if (!palabra) return palabra;

  let salida = palabra;

  // 1. Glifos numericos: solo si la palabra es casi toda digitos y separadores.
  if (PATRON_NUMERICO.test(salida)) {
    salida = corregirGlifosNumericos(salida);
  }

  return salida;
}
