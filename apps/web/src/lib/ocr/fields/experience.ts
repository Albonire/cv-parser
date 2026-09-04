import { ExperienceItem } from '../../../types/candidate';
import { LayoutLine } from '../layout';
import { contieneCargo } from '../../contexto/diccionario';
import { normalize, splitLabeledPairs, stripBullets } from '../text-utils';
import { detectarRango, quitarRango } from './dates';

const SUFIJOS_EMPRESA =
  /\b(?:s\.?a\.?s\.?|s\.?a\.?|ltda\.?|e\.?u\.?|s\.?a\.?s|cia\.?|c[ií]a\.?|&\s*c[ií]a|inc\.?|corp\.?|llc|group|grupo|holding|fundaci[oó]n|corporaci[oó]n|cooperativa|asociaci[oó]n|ministerio|contralor[ií]a|procuradur[ií]a|alcald[ií]a|gobernaci[oó]n|instituto|agencia|industrias|distribuidora|comercializadora|constructora|inversiones|servicios|soluciones|consultores|laboratorios|almacenes|supermercados|transportes|frigor[ií]ficos|alimentos|auditor[ií]a|log[ií]stica|empresas?|compan[ií]as?|organizaciones?|entidades?|sociedades?)\b/i;

const ES_VINETA = /^[\s•*●▪·+\-–—>]/;

const SIN_EXPERIENCIA =
  /(?:sin\s+experiencia(?:\s+laboral)?(?:\s+(?:previa|formal))?|no\s+(?:tengo|cuento\s+con)\s+experiencia|reci[eé]n\s+egresad[oa]|primera\s+oportunidad\s+laboral|primer\s+empleo)/i;

function pareceEmpresa(texto: string): boolean {
  const limpio = stripBullets(texto).trim();
  
  // Un renglon de fechas no es una empresa, aunque empiece en mayuscula.
  if (detectarRango(limpio)) return false;
  
  // Demasiado corto no es empresa
  if (limpio.length < 2) return false;
  
  // Tiene sufijo societario conocido - ALTAMENTE probable que sea empresa
  if (SUFIJOS_EMPRESA.test(limpio)) return true;
  
  // Empieza en mayuscula, no es cargo y tiene razonable longitud
  if (/^[A-ZÁÉÍÓÚÑ]/.test(limpio) && limpio.length >= 3 && limpio.length <= 60) {
    // No contiene palabras que indiquen que es un cargo
    if (contieneCargo(limpio)) return false;
    
    // Descarta si es todas mayusculas y largo (probablemente una seccion)
    if (limpio === limpio.toUpperCase() && limpio.length > 20) return false;
    
    // Heurística adicional: si contiene números o palabras comunes de empresas,
    // es más probable que sea empresa
    if (/(\d+|\bde\b|\bdel\b|\by\b|\binc\b)/.test(limpio.toLowerCase())) {
      return true;
    }
    
    // Si solo tiene 1-2 palabras cortas, probablemente no es empresa
    const palabras = limpio.split(/\s+/);
    if (palabras.length <= 2 && palabras.every(p => p.length < 6)) {
      return false;
    }
    
    return true;
  }
  
  return false;
}

function pareceCargo(texto: string): boolean {
  const limpio = stripBullets(texto);
  if (limpio.length < 2 || limpio.length > 80) return false;
  
  // Coincide explicitamente con cargo conocido
  if (contieneCargo(limpio)) return true;
  
  // Patrones adicionales de cargo (más comprehensive)
  return /\b(?:ingenier|analista|asistente|auxiliar|coordinador|director|gerente|jefe|l[ií]der|operari|supervisor|t[eé]cnic|tecn[oó]log|asesor|consultor|especialista|desarrollador|dise[nñ]ador|contador|abogad|profesional|practicante|aprendiz|vendedor|cajer|conductor|mensajer|vigilante|secretari|recepcionista|enfermer|docente|profesor|especialista|ejecutivo|oficial|agente|operador|cajero|vendedor|asesor|contador|mecanico|electricista|plomero|albani|soldador|pintor|carpintero|cocinero|camarero|mesero|chofer)\b/i.test(
    limpio
  );
}

/** Separa "Empresa SAS - Cargo" o "Cargo - Empresa SAS" en sus dos partes. */
function partirEmpresaCargo(texto: string): { empresa: string; cargo: string } | null {
  const partes = texto.split(/\s+[-–—|]\s+/).map((p) => p.trim()).filter(Boolean);
  if (partes.length < 2) {
    // Formato "Empresa: Cargo" (lista "Transportadora Distransa: Conductor").
    const porDosPuntos = texto.split(/\s*:\s+/).map((p) => p.trim()).filter(Boolean);
    if (porDosPuntos.length === 2 && pareceCargo(porDosPuntos[1])) {
      return { empresa: porDosPuntos[0], cargo: porDosPuntos[1] };
    }
    return null;
  }

  const indiceCargo = partes.findIndex((p) => pareceCargo(p));
  if (indiceCargo < 0) return null;

  // La empresa es la parte con sufijo societario o, si no lo hay, la que no es cargo.
  const indiceEmpresa =
    partes.findIndex((p, i) => i !== indiceCargo && SUFIJOS_EMPRESA.test(p)) !== -1
      ? partes.findIndex((p, i) => i !== indiceCargo && SUFIJOS_EMPRESA.test(p))
      : partes.findIndex((p, i) => i !== indiceCargo && !pareceCargo(p));

  if (indiceEmpresa < 0) return null;

  return { empresa: partes[indiceEmpresa], cargo: partes[indiceCargo] };
}

/** Construye entradas desde formularios con etiquetas (Empresa / Cargo / Fecha). */
function desdeEtiquetas(lineas: LayoutLine[]): ExperienceItem[] {
  const items: ExperienceItem[] = [];
  let actual: Partial<ExperienceItem> | null = null;

  const cerrar = () => {
    if (actual && (actual.company || actual.position)) {
      items.push({
        company: actual.company ?? '',
        position: actual.position ?? '',
        startDate: actual.startDate,
        endDate: actual.endDate,
        isCurrent: actual.isCurrent ?? false,
        responsibilities: actual.responsibilities,
      });
    }
    actual = null;
  };

  for (const linea of lineas) {
    const pares = splitLabeledPairs(linea.text);
    if (pares.length === 0) continue;

    for (const par of pares) {
      const etiqueta = normalize(par.label);

      if (/^(empresa|compania|compa[nñ]ia|entidad|organizacion|empleador)$/.test(etiqueta)) {
        if (actual?.company) cerrar();
        actual = { ...(actual ?? {}), company: par.value };
      } else if (/^(cargo|puesto|posicion|rol|denominacion del cargo)$/.test(etiqueta)) {
        actual = { ...(actual ?? {}), position: par.value };
      } else if (/^(fecha|fechas|periodo|per[ií]odo|duracion|vinculacion)$/.test(etiqueta)) {
        const rango = detectarRango(par.value);
        actual = {
          ...(actual ?? {}),
          startDate: rango?.inicio,
          endDate: rango?.fin,
          isCurrent: rango?.esActual ?? false,
        };
      } else if (/^(funciones|responsabilidades|logros|actividades)$/.test(etiqueta)) {
        actual = { ...(actual ?? {}), responsibilities: par.value };
      }
    }
  }

  cerrar();
  return items;
}

/** Construye entradas ancladas en rangos de fecha. */
function desdeRangos(lineas: LayoutLine[]): ExperienceItem[] {
  const items: ExperienceItem[] = [];
  const textos = lineas.map((l) => l.text);

  for (let i = 0; i < textos.length; i++) {
    const rango = detectarRango(textos[i]);
    if (!rango) continue;

    const resto = quitarRango(textos[i], rango);
    let empresa = '';
    let cargo = '';

    const partido = partirEmpresaCargo(resto);
    if (partido) {
      empresa = partido.empresa;
      cargo = partido.cargo;
    } else if (resto.length > 2 && pareceCargo(resto)) {
      // "Cargo | Marzo 2021 a Diciembre 2023" con la empresa en el renglon anterior
      cargo = stripBullets(resto);
      empresa = buscarArriba(textos, i, (t) => !ES_VINETA.test(t) && pareceEmpresa(t));
    } else if (resto.length > 2 && pareceEmpresa(resto)) {
      empresa = stripBullets(resto);
      cargo = buscarArriba(textos, i, (t) => !ES_VINETA.test(t) && pareceCargo(t));
    } else {
      // Toda la linea es la fecha: empresa y cargo estan arriba
      const arriba = buscarLineaArriba(textos, i);
      if (arriba) {
        const partidoArriba = partirEmpresaCargo(arriba.texto);
        if (partidoArriba) {
          empresa = partidoArriba.empresa;
          cargo = partidoArriba.cargo;
        } else if (pareceCargo(arriba.texto)) {
          cargo = stripBullets(arriba.texto);
          empresa = buscarArriba(textos, arriba.indice, (t) => !ES_VINETA.test(t) && pareceEmpresa(t));
        } else {
          empresa = stripBullets(arriba.texto);
          cargo = buscarAbajo(textos, i, (t) => !ES_VINETA.test(t) && pareceCargo(t));
        }
      }
    }

    const responsabilidades: string[] = [];
    for (let j = i + 1; j < textos.length; j++) {
      if (detectarRango(textos[j])) break;
      if (!ES_VINETA.test(textos[j])) {
        if (responsabilidades.length > 0) break;
        continue;
      }
      responsabilidades.push(stripBullets(textos[j]));
      if (responsabilidades.length >= 6) break;
    }

    items.push({
      company: empresa.trim(),
      position: cargo.trim(),
      startDate: rango.inicio,
      endDate: rango.fin,
      isCurrent: rango.esActual,
      responsibilities: responsabilidades.join(' ') || undefined,
    });
  }

  return items;
}

function buscarArriba(textos: string[], desde: number, prueba: (t: string) => boolean): string {
  for (let i = desde - 1; i >= 0 && i >= desde - 4; i--) {
    if (prueba(textos[i])) return stripBullets(textos[i]);
  }
  return '';
}

function buscarAbajo(textos: string[], desde: number, prueba: (t: string) => boolean): string {
  for (let i = desde + 1; i < textos.length && i <= desde + 3; i++) {
    if (prueba(textos[i])) return stripBullets(textos[i]);
  }
  return '';
}

function buscarLineaArriba(textos: string[], desde: number): { texto: string; indice: number } | null {
  for (let i = desde - 1; i >= 0 && i >= desde - 3; i--) {
    if (!ES_VINETA.test(textos[i]) && textos[i].trim().length > 3) {
      return { texto: textos[i], indice: i };
    }
  }
  return null;
}

/**
 * Extrae la experiencia laboral. Cubre los tres formatos habituales en Colombia:
 * formulario con etiquetas (DAFP/Minerva), empresa arriba con cargo y fechas
 * debajo, y "Empresa - Cargo" con las fechas en el renglon siguiente.
 */
export function extraerExperiencia(
  lineasSeccion: LayoutLine[],
  todas: LayoutLine[],
  haySeccion: boolean
): ExperienceItem[] {
  const alcance = haySeccion && lineasSeccion.length > 0 ? lineasSeccion : todas;

  const porEtiquetas = desdeEtiquetas(alcance);
  const porRangos = desdeRangos(alcance);

  // Un formulario con etiquetas (Empresa:/Cargo:/Fechas:) es el mas fiable y
  // gana sobre los rangos. Pero si la ruta por etiquetas solo produjo fragmentos
  // sin empresa ("Cargo: Conductor - Repartidor" sin la "Empresa:" que la ancla),
  // es un formato de lista ("Empresa: cargo (año)") y el barrido por rangos es
  // mas completo: se favorece el que tenga mas datos.
  if (porEtiquetas.length > 0 && porEtiquetas.every((e) => e.company)) return porEtiquetas;
  if (porEtiquetas.length > 0 && !porEtiquetas.every((e) => e.company) && porRangos.length > 0) {
    return porRangos;
  }
  if (porEtiquetas.length > 0) return porEtiquetas;

  if (porRangos.length > 0) return porRangos;

  const textoAlcance = alcance.map((l) => l.text).join('\n');
  const textoCompleto = todas.map((l) => l.text).join('\n');

  if (SIN_EXPERIENCIA.test(textoAlcance) || SIN_EXPERIENCIA.test(textoCompleto)) {
    return [
      {
        company: 'Sin Experiencia / Perfil Junior',
        position: 'Candidato Junior',
        responsibilities:
          'El candidato indica en su hoja de vida no contar con experiencia laboral formal previa o menciona unicamente practicas academicas o del SENA.',
      },
    ];
  }

  // El CV declara una seccion de experiencia pero el OCR no dejo fechas legibles:
  // se conserva el contenido para que la persona de RRHH lo corrija (RN-7) en vez
  // de descartarlo en silencio.
  if (haySeccion && lineasSeccion.length > 0) {
    const detalle = lineasSeccion
      .map((l) => stripBullets(l.text))
      .filter((t) => t.length > 3)
      .slice(0, 8);

    if (detalle.length > 0) {
      return [
        {
          company: 'Experiencia Registrada',
          position: 'Ver descripcion',
          responsibilities: detalle.join('. '),
        },
      ];
    }
  }

  return [];
}
