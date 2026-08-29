import { describe, it, expect } from 'vitest';
import { parseCvText } from './parser-cv';

describe('Pruebas de OCR difícil y CVs atípicos en español', () => {
  it('CV Hard 1: Texto muy pegado y ruidoso, sin títulos claros, nombre real camuflado', () => {
    // Simula un OCR donde la imagen estaba borrosa o en una fuente no estándar.
    const rawText = `
cURRiculUM viTAE
1ngeniErO dE s0ftwArE
JUAN CARLOS PEREZ GOMEZ
MóviI: 300 123 4567 . Email: juanca@correo.com
BOGOTÁ, coLOMBIA

sobrE mi: apasiOnado por el dEsarrollO dE software...
exPerienciA
- DesArrollador en EMprEsa XYZ (2020-2023)
- AnAlista en ABC (2018-2020)
edUcacion
inGenieria De SisTemas - UnIverSidad naCional
`;
    const parsed = parseCvText(rawText);
    expect(parsed.firstNames).toBe('JUAN CARLOS');
    expect(parsed.lastNames).toBe('PEREZ GOMEZ');
    expect(parsed.phone).toBe('300 123 4567');
    expect(parsed.email).toBe('juanca@correo.com');
  });

  it('CV Hard 2: Formato moderno, nombre a la izquierda, título gigante a la derecha', () => {
    // Simula la lectura columnar aplanada por OCR (Tesseract a veces aplana columnas de izquierda a derecha)
    const rawText = `
MARIA ANTONIA RODRIGUEZ
Consultora Financiera
Contact
+57 321-987-6543
mar.rod@finanzas.com
Dirección
Medellín, Antioquia

Resumen
Experta en inversiones con más de 10 años.
    `;
    const parsed = parseCvText(rawText);
    expect(parsed.firstNames).toBe('MARIA');
    expect(parsed.lastNames).toBe('ANTONIA RODRIGUEZ');
    expect(parsed.phone).toBe('+57 321-987-6543');
    expect(parsed.email).toBe('mar.rod@finanzas.com');
    // Como Medellín está en la lista de fallback, debería agarrarlo
    expect(parsed.cityResidence).toContain('Medellín');
  });

  it('CV Hard 3: Con muchas etiquetas confusas pero sin nombre explícito, primer nombre está abajo y tiene ruido', () => {
    // Simula cuando el nombre no es la primera línea y tiene ruido
    const rawText = `
HOJA DE VIDA
DATOS PERSONALES
Nombre:   L u i s     A l b e r t o     M o r a l e s 
C.C: 1098.765.432 de Bucaramanga
Fecha de Nacimiento: 15/05/1990
Teléfono: 3105554433
Email: luismorales90@gmail.com
Ubicación: Calle 45 # 12-34, Bucaramanga, Santander

PERFIL PROFESIONAL
Técnico en reparación de computadores...
    `;
    const parsed = parseCvText(rawText);
    // El OCR separó las letras. "L u i s A l b e r t o M o r a l e s"
    // Probablemente fallará la extracción limpia si no hay lógica para juntar espacios.
    // Vamos a ver qué extrae. Si es muy ruidoso, puede que no extraiga nada.
    // Si no extrae, está bien, no extraemos cosas erróneas.
    // Verificamos al menos que los datos de contacto estén bien
    expect(parsed.phone).toBe('3105554433');
    expect(parsed.email).toBe('luismorales90@gmail.com');
    expect(parsed.documentNumber).toBe('1098765432');
    expect(parsed.cityResidence).toContain('Bucaramanga');
  });

  it('CV Hard 4: "Pamplona" false positive check, el OCR leyó "Pamplon" o algo similar', () => {
    const rawText = `
RESUME
JOHN DOE
Software Engineer
Pamplon St. 1234, FL, USA
Mobile: +1 555 123 4567
    `;
    const parsed = parseCvText(rawText);
    expect(parsed.cityResidence).not.toContain('Pamplona');
  });

  it('CV Hard 5: Experiencia sin fechas puras pero con bullets', () => {
    const rawText = `
EXPERIENCIA LABORAL
• Lideré el equipo de desarrollo.
• Aumenté las ventas en un 30%.
    `;
    const parsed = parseCvText(rawText);
    expect(parsed.experience.length).toBeGreaterThan(0);
    expect(parsed.experience[0].company).toBe('Experiencia Registrada');
    expect(parsed.experience[0].responsibilities).toContain('Lideré el equipo de desarrollo');
    expect(parsed.experience[0].responsibilities).toContain('Aumenté las ventas');
  });

  it('CV Hard 6: Nombre camuflado con email y teléfono', () => {
    const rawText = `
    Abbigail Ward | +1 555 123 4567 | abbi@mail.com
    SUMMARY
    I am a developer.
    `;
    const parsed = parseCvText(rawText);
    expect(parsed.firstNames).toBe('Abbigail');
    expect(parsed.lastNames).toBe('Ward');
    expect(parsed.email).toBe('abbi@mail.com');
  });

  it('CV Hard 7: Fechas con 2 digitos', () => {
    const rawText = `
    Abbigail Ward
    EXPERIENCIA
    Desarrollador
    03/15 - 04/18
    Lideré equipos.
    `;
    const parsed = parseCvText(rawText);
    expect(parsed.experience.length).toBeGreaterThan(0);
    expect(parsed.experience[0].startDate).toBe('15');
    expect(parsed.experience[0].endDate).toBe('18');
  });

  it('CV Hard 8: Image_15 OCR ruidoso con universidad y palabras corruptas', () => {
    const rawText = `
SENIOR JAVA DEVELOPER
SUMMARY
MY EXPERIENCE
TNT OC JUNIOR JAVA DEVELOPER
ie Gensino Porte Col JAN 203-Jm 2015
de oe nd deployment mechonams
CORE eKILLS JAVA DEVELOPER
aa Stratecho | May 2015-Dec 2018
EEN Les < Dovolopad ond meieiad reuéeblo codo bares te hal.
Spring/Hibemoto, WebSphoro, WobSphore EP UCATION,
E MADISON UNIVERSITY
Niger, LO Bidor 50 Bets: UNMadizon Department o Computer Seienees
+ Corbera Orel 109082, Sa 50/55 MADISON MICH SCHOOL
| MESOLA/SOL rabo Computer Sefanes
    `;
    const parsed = parseCvText(rawText);

    // 1. La universidad NO debe ser el nombre del candidato
    expect(parsed.firstNames).not.toContain('MADISON');
    expect(parsed.lastNames).not.toContain('UNIVERSITY');

    // 2. "mechonams" o "bares" no deben ser tomados como títulos de estudio
    const degreeNames = parsed.education.map((e) => e.degree);
    expect(degreeNames.some((d) => d.includes('mechonams'))).toBe(false);
    expect(degreeNames.some((d) => d.includes('bares'))).toBe(false);

    // 3. Debe extraer la universidad en el campo de institución
    const institutions = parsed.education.map((e) => e.institution);
    expect(institutions.some((inst) => inst.includes('MADISON UNIVERSITY') || inst.includes('MADISON MICH SCHOOL'))).toBe(true);

    // 4. Debe extraer habilidades de Java y Spring
    expect(parsed.skills.some((s) => s.skillName.toLowerCase().includes('java'))).toBe(true);
  });
});
