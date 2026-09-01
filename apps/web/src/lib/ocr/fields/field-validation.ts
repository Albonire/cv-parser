/**
 * Validación y corrección post-OCR de campos extraídos.
 * 
 * Aplica reglas de negocio y patrones comunes para asegurar que los campos
 * tengan el formato correcto tras la lectura con Tesseract.
 */

/**
 * Valida y normaliza un email.
 * @param email - Email a validar
 * @returns Email válido o string vacío si es inválido
 */
export function validarEmail(email: string): string {
  if (!email) return '';
  
  const limpio = email.trim().toLowerCase();
  
  // Debe tener @ y al menos un . después
  if (!limpio.includes('@')) return '';
  
  const partes = limpio.split('@');
  if (partes.length !== 2) return '';
  
  const [usuario, dominio] = partes;
  
  // Usuario no vacío
  if (!usuario || usuario.length < 1) return '';
  
  // Dominio debe tener .
  if (!dominio.includes('.') || dominio.length < 5) return '';
  
  // No debe terminar en punto
  if (dominio.endsWith('.')) return '';
  
  // Patrones comunes de corrupción OCR: si está mal pero podría corregirse
  // "usuario O dominio.com" -> "usuario@dominio.com" (ya manejado en extraction)
  
  // Validar con regex básico
  const patronEmail = /^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
  return patronEmail.test(limpio) ? limpio : '';
}

/**
 * Valida y normaliza un número de teléfono.
 * Acepta formatos variados pero garantiza 7-15 dígitos.
 * @param phone - Teléfono a validar
 * @returns Teléfono válido o string vacío
 */
export function validarTelefono(phone: string): string {
  if (!phone) return '';
  
  const limpio = phone.trim();
  
  // Extrae solo dígitos y +
  const digitos = limpio.replace(/[^\d+]/g, '').replace(/^(\+)/, '$1');
  
  // Cuenta dígitos sin el +
  const soloDigitos = digitos.replace(/\D/g, '');
  
  // Debe tener entre 7 y 15 dígitos
  if (soloDigitos.length < 7 || soloDigitos.length > 15) return '';
  
  // Si pasa, retorna el formato original limpio (podría ser +57 300 1234567, etc.)
  return limpio;
}

/**
 * Valida un número de documento de identidad colombiano.
 * Rango: 6-11 dígitos.
 * @param doc - Documento a validar
 * @returns Documento válido (sin separadores) o string vacío
 */
export function validarDocumento(doc: string): string {
  if (!doc) return '';
  
  const limpio = doc.trim();
  const soloDigitos = limpio.replace(/\D/g, '');
  
  // Colombia: 6-11 dígitos típicamente
  if (soloDigitos.length < 6 || soloDigitos.length > 11) return '';
  
  return soloDigitos;
}

/**
 * Valida un nombre (firstName o lastName).
 * @param nombre - Nombre a validar
 * @returns Nombre válido o string vacío
 */
export function validarNombre(nombre: string): string {
  if (!nombre) return '';
  
  const limpio = nombre.trim();
  
  // Debe tener al menos 1 carácter
  if (limpio.length < 1) return '';
  
  // No debe ser todo números
  if (/^\d+$/.test(limpio)) return '';
  
  // Limpia espacios múltiples pero preserva el caso original
  const normalizado = limpio.replace(/\s+/g, ' ');
  
  // Valida que sea principalmente letras (permite >=50% para casos como "S SIVARAMAN")
  const porcentajeLetras = (normalizado.match(/[A-ZÁÉÍÓÚÑ\s]/gi) || []).length / normalizado.length;
  if (porcentajeLetras < 0.5) return '';
  
  return normalizado;
}

/**
 * Valida una ciudad/ubicación.
 * @param ciudad - Ciudad a validar
 * @returns Ciudad válida o string vacío
 */
export function validarCiudad(ciudad: string): string {
  if (!ciudad) return '';
  
  const limpio = ciudad.trim();
  
  // Debe tener al menos 2 caracteres
  if (limpio.length < 2) return '';
  
  // No debe ser todo números
  if (/^\d+$/.test(limpio)) return '';
  
  // Limpia espacios múltiples
  const normalizado = limpio.replace(/\s+/g, ' ');
  
  return normalizado;
}

/**
 * Validador centralizado que aplica reglas a un objeto de datos personales.
 * Retorna siempre strings (nunca undefined).
 */
export function validarDatosPersonales(datos: {
  firstNames?: string;
  lastNames?: string;
  email?: string;
  phone?: string;
  documentNumber?: string;
  cityResidence?: string;
}): {
  firstNames: string;
  lastNames: string;
  email: string;
  phone: string;
  documentNumber: string;
  cityResidence: string;
} {
  return {
    firstNames: datos.firstNames ? validarNombre(datos.firstNames) : '',
    lastNames: datos.lastNames ? validarNombre(datos.lastNames) : '',
    email: datos.email ? validarEmail(datos.email) : '',
    phone: datos.phone ? validarTelefono(datos.phone) : '',
    documentNumber: datos.documentNumber ? validarDocumento(datos.documentNumber) : '',
    cityResidence: datos.cityResidence ? validarCiudad(datos.cityResidence) : '',
  };
}

/**
 * Valida que un campo de experiencia (company/position) sea válido.
 * @param texto - Texto a validar
 * @returns Texto válido o string vacío
 */
export function validarExperiencia(texto: string): string {
  if (!texto) return '';
  
  const limpio = texto.trim();
  
  // Debe tener al menos 2 caracteres
  if (limpio.length < 2) return '';
  
  // No debe ser todo números
  if (/^\d+$/.test(limpio)) return '';
  
  // No debe ser una fecha (patrón: XX/XX/XX o XXXX-XXXX)
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(limpio)) return '';
  if (/^\d{4}-\d{4}$/.test(limpio)) return '';
  if (/^\d{4}-\d{2}$/.test(limpio)) return '';
  
  return limpio;
}

/**
 * Valida que un campo de educación (degree/institution) sea válido.
 */
export function validarEducacion(texto: string): string {
  if (!texto) return '';
  
  const limpio = texto.trim();
  
  // Debe tener al menos 2 caracteres
  if (limpio.length < 2) return '';
  
  // No debe ser todo números
  if (/^\d+$/.test(limpio)) return '';
  
  return limpio;
}

/**
 * Detecta y marca campos que probablemente sean errores del OCR.
 * Útil para interfaces que quieren marcar campos sospechosos.
 */
export function marcarCamposSospechosos(datos: any): Record<string, boolean> {
  const sospechosos: Record<string, boolean> = {};
  
  // Email sin @ es sospechoso
  if (datos.email && !datos.email.includes('@')) {
    sospechosos.email = true;
  }
  
  // Teléfono que no tiene dígitos suficientes
  if (datos.phone) {
    const digitos = datos.phone.replace(/\D/g, '');
    if (digitos.length < 7) {
      sospechosos.phone = true;
    }
  }
  
  // Documento muy corto
  if (datos.documentNumber) {
    const digitos = datos.documentNumber.replace(/\D/g, '');
    if (digitos.length < 6) {
      sospechosos.documentNumber = true;
    }
  }
  
  // Nombre muy corto o sin letras
  if (datos.firstNames) {
    const letras = (datos.firstNames.match(/[A-Z]/gi) || []).length;
    if (letras < 2) {
      sospechosos.firstNames = true;
    }
  }
  
  return sospechosos;
}
