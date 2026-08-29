import { describe, it, expect } from 'vitest';
import { parseCvText } from './parser-cv';

describe('Pruebas exhaustivas con casos reales de cv-examples', () => {
  it('Image_31.jpg: debe extraer Abbigail Ward, Los Angeles, CA y telefono sin dummies', () => {
    const textImage31 = `
      Abbigail Ward
      77577 Chauncey Inlet, Los Angeles, CA 4 Phone: +1 (555) 247 8411
      EXPERIENCE COMMERCIAL BANKING
      Philadelphia, PA
      03/2015 — present
      + Work closely with technology team to develop product roadmaps
      EDUCATION
      Master of Business Administration
      University of California
      2014
    `;

    const parsed = parseCvText(textImage31);

    expect(parsed.firstNames).toBe('Abbigail');
    expect(parsed.lastNames).toBe('Ward');
    expect(parsed.cityResidence).toContain('Los Angeles, CA');
    expect(parsed.phone).toBe('+1 (555) 247 8411');
    expect(parsed.nationality).toBe('');
    expect(parsed.cityResidence).not.toContain('Pamplona');
    expect(parsed.education.length).toBeGreaterThan(0);
  });

  it('Image_40.jpg: CV sin nombre en el encabezado no debe forzar nombre dummy y debe extraer contacto', () => {
    const textImage40 = `
      1 Main Street, New Cityland. CA 91010 | | C: (555) 322-7337 | example-email@example.com
      SUMMARY
      Knowledgeable General Maintenance technician successful at generating new business through referrals.
      HIGHLIGHTS
      + Familiar with engine mechanics
      + Customer service
    `;

    const parsed = parseCvText(textImage40);

    expect(parsed.firstNames).toBe('');
    expect(parsed.lastNames).toBe('');
    expect(parsed.email).toBe('example-email@example.com');
    expect(parsed.phone).toBe('(555) 322-7337');
    expect(parsed.cityResidence).toContain('New Cityland. CA 91010');
    expect(parsed.summary).toContain('Knowledgeable General Maintenance');
    expect(parsed.nationality).toBe('');
  });

  it('Image_23.jpg: debe extraer ROBERT ZEBULON MCCURLEY, titular y telefono', () => {
    const textImage23 = `
      ROBERT ZEBULON MCCURLEY
      AUTOMOTIVE & ELECTRICAL TECHNICIAN
      Generic Sample Drive e Place, Tennessee 37000 e (615) 884-1224 + Zeb@uwritersinthesky.com
      Expert Mechanic / 4-wheel Drive Specialist
      SUMMARY
      Talented mechanic with a 14-year proven record of accomplishment in the automotive industry.
    `;

    const parsed = parseCvText(textImage23);

    expect(parsed.firstNames).toBe('ROBERT');
    expect(parsed.lastNames).toBe('ZEBULON MCCURLEY');
    expect(parsed.phone).toBe('(615) 884-1224');
    expect(parsed.email).toBe('zeb@uwritersinthesky.com');
    expect(parsed.headline).toBe('AUTOMOTIVE & ELECTRICAL TECHNICIAN');
    expect(parsed.cityResidence).toContain('Tennessee 37000');
  });

  it('Image_16.png: debe extraer First Last, Honolulu, Hawaii e Investment Banking Analyst', () => {
    const textImage16 = `
      First Last
      Investment Banking Analyst
      Honolulu, Hawaii + +1-234-456-789 + professionalemail@resumeworded.com * linkedin.com/in/username
      WORK EXPERIENCE
      Resume Worded, New York, NY
      09/2015 — Present
      Investment Banking Analyst
    `;

    const parsed = parseCvText(textImage16);

    expect(parsed.firstNames).toBe('First');
    expect(parsed.lastNames).toBe('Last');
    expect(parsed.cityResidence).toContain('Honolulu, Hawaii');
    expect(parsed.email).toBe('professionalemail@resumeworded.com');
    expect(parsed.headline).toBe('Investment Banking Analyst');
  });

  it('Image_42.jpg: debe extraer correo, telefono internacional de India y ciudad Chennai', () => {
    const textImage42 = `
      S SIVARAMAN
      No.22, Vettu street, Lakshmi Amman nagar, Ambattur, Chennai - 600053
      Mobile.No :(+91) 9597099401
      Email: siva.seesha@gmail.com
      OBJECTIVE:
      Mechanical engineering in automobile industries with 9.5 years experience.
    `;

    const parsed = parseCvText(textImage42);

    expect(parsed.firstNames).toBe('S');
    expect(parsed.lastNames).toBe('SIVARAMAN');
    expect(parsed.email).toBe('siva.seesha@gmail.com');
    expect(parsed.phone).toBe('(+91) 9597099401');
    expect(parsed.cityResidence).toContain('Chennai');
    expect(parsed.nationality).toBe('');
  });

  it('Image_62.png: debe extraer Sammy Bradtke, Phoenix, AZ y telefono', () => {
    const textImage62 = `
      Sammy Bradtke
      Corporate Banking Analyst
      29608 Gleichner Roads, Phoenix, AZ + Phone: +1 (555) 885 0218
      EXPERIENCE
      HERMANN-MRAZ, Philadelphia, PA
      05/2018 — present
      Corporate Banking Analyst
    `;

    const parsed = parseCvText(textImage62);

    expect(parsed.firstNames).toBe('Sammy');
    expect(parsed.lastNames).toBe('Bradtke');
    expect(parsed.cityResidence).toContain('Phoenix, AZ');
    expect(parsed.phone).toBe('+1 (555) 885 0218');
    expect(parsed.headline).toBe('Corporate Banking Analyst');
  });

  it('Image_28.gif: debe extraer Damien Cave, Springfield, MI y telefono', () => {
    const textImage28 = `
      Damien Cave
      12345 Street Name Ave. e Springfield, MI 11111 e (555) 555-5555 y damien@xoc.net
      PROFILE
      Well-qualified and results-oriented Banking Professional with over 16 years of successful experience.
    `;

    const parsed = parseCvText(textImage28);

    expect(parsed.firstNames).toBe('Damien');
    expect(parsed.lastNames).toBe('Cave');
    expect(parsed.cityResidence).toContain('Springfield, MI 11111');
    expect(parsed.phone).toBe('(555) 555-5555');
    expect(parsed.email).toBe('damien@xoc.net');
    expect(parsed.summary).toContain('Well-qualified and results-oriented Banking Professional');
  });

  it('Image_70.jpg: debe extraer Cecile Gilan, Pittsburgh, PA y telefono', () => {
    const textImage70 = `
      Sample Corporate Banker Resume
      Cecile Gilan
      1565 Shim Avenue
      Pittsburgh, PA 15212
      (123) 638-8283
      cecile.gilan@email.com
      Job Objective: Dedicated and hardworking Corporate Banker.
    `;

    const parsed = parseCvText(textImage70);

    expect(parsed.firstNames).toBe('Cecile');
    expect(parsed.lastNames).toBe('Gilan');
    expect(parsed.cityResidence).toContain('Pittsburgh, PA 15212');
    expect(parsed.phone).toBe('(123) 638-8283');
    expect(parsed.headline).toContain('Dedicated and hardworking Corporate Banker');
  });

  it('Image_29.jpg: debe extraer Maxine Curry y titular Bank Teller', () => {
    const textImage29 = `
      Maxine Curry
      Bank Teller
      PERSONAL SUMMARY
      Maxine is professional in appearance as well as speech with bank customers.
    `;

    const parsed = parseCvText(textImage29);

    expect(parsed.firstNames).toBe('Maxine');
    expect(parsed.lastNames).toBe('Curry');
    expect(parsed.headline).toBe('Bank Teller');
    expect(parsed.summary).toContain('Maxine is professional');
  });
});
