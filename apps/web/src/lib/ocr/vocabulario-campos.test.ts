import { describe, it, expect } from 'vitest';
import { coberturaCampos, puntajeFormulario } from './vocabulario-campos';

describe('Vocabulario de campos para la seleccion automatica de preprocesado', () => {
  it('cuenta las palabras del formulario que trae una lectura', () => {
    const lectura = `
      DATOS PERSONALES
      Nombres: JUAN PEREZ   Telefono: 3001234567
      Correo electronico: juan@correo.com
      EXPERIENCIA LABORAL
      Analista en Empresa XYZ
    `;
    // telefono, experiencia laboral y al menos parte de las etiquetas personales.
    expect(coberturaCampos(lectura)).toBeGreaterThanOrEqual(3);
  });

  it('tolera mayusculas, tildes y palabras pegadas a su valor', () => {
    const lectura = 'EXPERIENCIA LABORAL\nTeléfono:3184567821\nfoRMACiÓN ACAdémica';
    expect(coberturaCampos(lectura)).toBeGreaterThanOrEqual(3);
  });

  it('no da falsos positivos con basura de OCR ni subcadenas cortas', () => {
    const basura = 'asdf qwzx poiu trex nompu kolli uniting accelerated passportless';
    // "nit" y "cc" viven dentro de "uniting"/"accelerated": no deben contar como campo.
    expect(coberturaCampos(basura)).toBe(0);
  });

  it('puntajeFormulario premia la lectura que alimenta los campos', () => {
    const basura =
      'qwerty 1234567890 98 09128301 abcdefghijklmnop rstuvwxyz qwertyuiop asdfghjkl zxcvbnm poiuytrewq';
    const util =
      'Bogota, 300 123 4567, juan@correo.com, C.C. 1098765432, EXPERIENCIA LABORAL, ' +
      'telefono, correo electronico, formacion academica, habilidades, referencias personales';
    expect(puntajeFormulario(util)).toBeGreaterThan(puntajeFormulario(basura));
  });

  it('puntajeFormulario cuenta un dato como mas valioso que una palabra suelta', () => {
    const conDato = 'correo: ana.maria@empresa.com';
    const conPalabra = 'correo electronico de la candidata descripcion larga';
    expect(puntajeFormulario(conDato)).toBeGreaterThan(puntajeFormulario(conPalabra));
  });
});