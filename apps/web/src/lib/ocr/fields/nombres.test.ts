import { describe, it, expect } from 'vitest';
import { repartirNombre } from './nombres';

/**
 * Casos de reparto de nombres colombianos. Estos cubren los fallos reportados:
 * - particulas de apellido ("de la Cruz", "del Rio", "de los Santos")
 * - nombres de 3 tokens
 * - nombres compuestos de 4 o mas tokens
 * - una unica palabra
 * - acentos
 */
describe('repartirNombre (convencion colombiana de dos apellidos)', () => {
  it('separa de manera simple dos palabras', () => {
    expect(repartirNombre('Juan Perez')).toEqual({ firstNames: 'Juan', lastNames: 'Perez' });
  });

  it('respeta particula "de la" pegada al apellido', () => {
    expect(repartirNombre('Ana de la Cruz')).toEqual({
      firstNames: 'Ana',
      lastNames: 'de la Cruz',
    });
  });

  it('respeta particula "del" pegada al apellido', () => {
    expect(repartirNombre('Luz del Carmen')).toEqual({
      firstNames: 'Luz',
      lastNames: 'del Carmen',
    });
  });

  it('respeta particula "de los" pegada al apellido', () => {
    expect(repartirNombre('Maria de los Santos')).toEqual({
      firstNames: 'Maria',
      lastNames: 'de los Santos',
    });
  });

  it('reparte 3 tokens con dos apellidos compuestos', () => {
    expect(repartirNombre('Carlos Andres Lopez')).toEqual({
      firstNames: 'Carlos',
      lastNames: 'Andres Lopez',
    });
  });

  it('reparte 4 tokens en primero=2, apellidos=2', () => {
    expect(repartirNombre('María Camila Torres Gómez')).toEqual({
      firstNames: 'María Camila',
      lastNames: 'Torres Gómez',
    });
  });

  it('reparte 4 tokens con particula en los apellidos', () => {
    expect(repartirNombre('Juan David de la Hoz')).toEqual({
      firstNames: 'Juan David',
      lastNames: 'de la Hoz',
    });
  });

  it('maneja una sola palabra (deja apellidos vacios)', () => {
    expect(repartirNombre('Jhonatan')).toEqual({ firstNames: 'Jhonatan', lastNames: '' });
  });

  it('acepta nombres con acentos y no los pierde', () => {
    expect(repartirNombre('CAMILO ANDRÉS VEGA ORTIZ')).toEqual({
      firstNames: 'CAMILO ANDRÉS',
      lastNames: 'VEGA ORTIZ',
    });
  });

  it('descarta tratamientos al inicio', () => {
    expect(repartirNombre('Lic. Ana María Pérez López')).toEqual({
      firstNames: 'Ana María',
      lastNames: 'Pérez López',
    });
  });

  it('reparte un nombre compuesto largo de 6 tokens', () => {
    expect(repartirNombre('Juan Carlos María José de los Santos')).toEqual({
      firstNames: 'Juan Carlos María José',
      lastNames: 'de los Santos',
    });
  });
});
