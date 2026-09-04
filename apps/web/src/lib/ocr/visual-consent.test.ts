import { describe, it, expect } from 'vitest';
import { classifyCaption, visualConsent, resetVisualConsentModuleForTests } from './visual-consent';

describe('visualConsent.classifyCaption', () => {
  it('clasifica una firma/despedida como pagina de firma', () => {
    expect(classifyCaption('the document ends with the signature Atentamente Gerencia General')).toBe(
      'firma'
    );
  });

  it('reconoce el membrete institucional como firma', () => {
    expect(classifyCaption('header: Departamento de Talento Humano, Rosimar SAS')).toBe('firma');
  });

  it('reconoce una hoja de vida por sus encabezados', () => {
    expect(classifyCaption('curriculum vitae with experiencia laboral y formacion academica')).toBe(
      'hoja_de_vida'
    );
  });

  it('reconoce un contrato', () => {
    expect(classifyCaption('contrato de trabajo entre empleador y trabajador, clausulas')).toBe(
      'contrato'
    );
  });

  it('no marca como firma una pagina sin señales', () => {
    expect(classifyCaption('paisaje, montañas y un rio al atardecer')).toBe('otro');
  });
});

describe('visualConsent de integracion con bandera apagada', () => {
  it('devuelve null (sin efecto) cuando la bandera esta desactivada', async () => {
    resetVisualConsentModuleForTests();
    const resultado = await visualConsent([new Blob(['x'])], false);
    expect(resultado).toBeNull();
  });

  it('devuelve null (sin efecto) cuando no hay paginas', async () => {
    resetVisualConsentModuleForTests();
    const resultado = await visualConsent([], true);
    expect(resultado).toBeNull();
  });
});