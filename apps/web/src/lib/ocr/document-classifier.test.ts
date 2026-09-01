import { describe, it, expect } from 'vitest';
import { clasificarHistorial, classifyDocumentType } from './document-classifier';

/**
 * Guarda de regresion del clasificador.
 *
 * Una hoja de vida colombiana menciona de forma natural media docena de
 * palabras que tambien aparecen en un contrato, en una liquidacion o en un
 * manual de funciones. Cuando esas palabras se buscaban sueltas y antes que las
 * senales de curriculum, el banco de 40 escaneos cayo de 73,9% a 19,6%: seis de
 * cada nueve hojas de vida salian como documento no estructurado y llegaban al
 * formulario vacias. Estas pruebas fijan las dos direcciones: la hoja de vida no
 * se pierde, y los demas documentos se siguen reconociendo.
 */

const HOJA_DE_VIDA_COMPLETA = `
MARTHA LUCIA CAICEDO BERMUDEZ
Auxiliar Administrativa
C.C. 1098234567 | Tel. 318 456 7821 | martha.caicedo@correo.com | Pamplona

PERFIL PROFESIONAL
Auxiliar administrativa con 6 anos de experiencia en gestion documental.

EXPERIENCIA LABORAL
Auxiliar Administrativa - Servicios Integrales del Norte SAS
Marzo 2019 a Presente. Contrato a termino fijo.
Responsable de las funciones propias del cargo de auxiliar administrativa.

FORMACION ACADEMICA
Primaria - Escuela Normal Superior, 2005
Tecnico en Asistencia Administrativa - SENA, 2016

HABILIDADES
Gestion Documental, Archivo, Atencion al Cliente

REFERENCIAS
Ing. Pedro Salazar - Laboral - 317 890 1234
`;

const MANUAL_DE_FUNCIONES = `
MANUAL DE FUNCIONES
CARGO: Auxiliar de Bodega
1. Recibir y verificar la mercancia que ingresa.
2. Mantener el orden del inventario.
3. Reportar novedades al jefe inmediato.
`;

const LIQUIDACION = `
LIQUIDACION FINAL DE CONTRATO
TRABAJADOR: Jhon Fredy Ospina Cardona
Cesantias 1.250.000
Intereses de cesantias 150.000
Prima de servicios 620.000
Vacaciones 310.000
TOTAL A PAGAR 2.330.000
`;

const CONTRATO = `
CONTRATO INDIVIDUAL DE TRABAJO A TERMINO FIJO
EMPLEADOR: Rosimar S.A.S. NIT 900.123.456-7
TRABAJADOR: Diana Carolina Murillo
PERIODO DE PRUEBA: dos meses
CLAUSULA PRIMERA: objeto del contrato.
`;

const MEMORANDO = `
MEMORANDO No. 026
PARA: Wilson Andres Pena Rojas
DE: Coordinacion de Talento Humano
ASUNTO: Llamado de atencion por incumplimiento de horario
FECHA: 12 de marzo de 2024
`;

describe('clasificarHistorial', () => {
  it('reconoce una hoja de vida aunque hable de contratos, primas y funciones', () => {
    expect(clasificarHistorial(HOJA_DE_VIDA_COMPLETA)).toBe('hoja_de_vida');
    expect(classifyDocumentType(HOJA_DE_VIDA_COMPLETA)).toBe('cv');
  });

  it('no confunde "Primaria" con la prima de una liquidacion', () => {
    const soloPrimaria = 'FORMACION\nPrimaria - Escuela Rural Mixta, 2004\nBachiller - 2010';
    expect(clasificarHistorial(soloPrimaria)).not.toBe('liquidacion');
  });

  it('no toma por manual de funciones una experiencia que menciona funciones', () => {
    const experiencia =
      'EXPERIENCIA\nOperario de Produccion\nResponsable de las funciones propias del cargo.';
    expect(clasificarHistorial(experiencia)).not.toBe('funciones');
  });

  it('sigue reconociendo un manual de funciones de verdad', () => {
    expect(clasificarHistorial(MANUAL_DE_FUNCIONES)).toBe('funciones');
  });

  it('sigue reconociendo una liquidacion', () => {
    expect(clasificarHistorial(LIQUIDACION)).toBe('liquidacion');
    expect(classifyDocumentType(LIQUIDACION)).toBe('liquidacion');
  });

  it('sigue reconociendo un contrato', () => {
    expect(clasificarHistorial(CONTRATO)).toBe('contrato');
    expect(classifyDocumentType(CONTRATO)).toBe('contract');
  });

  it('sigue reconociendo un memorando o llamado de atencion', () => {
    expect(['memorando', 'llamado_atencion']).toContain(clasificarHistorial(MEMORANDO));
  });

  it('deja en desconocido un texto que no es ninguna de las anteriores', () => {
    expect(clasificarHistorial('Factura de venta No. 4451\nValor total 89.000')).toBe(
      'desconocido'
    );
  });
});
