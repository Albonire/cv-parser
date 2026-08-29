import { describe, it, expect } from 'vitest';
import { parseCvText } from './parser-cv';

describe('Image_15 and Image_31 reproduction', () => {
  it('Image_15.jpg: SENIOR JAVA DEVELOPER', () => {
    const textImage15 = `
SENIOR JAVA DEVELOPER
SUMMARY
MY EXPERIENCE
TNT OC JUNIOR JAVA DEVELOPER
ie Gensino Porte Col JAN 203-Jm 2015
de oe nd deployment mechonams
CORE eKILLS JAVA DEVELOPER
aa Stratecho | May 2015-Dec 2018
EEN Les < Dovolopad ond meieiad reuéeblo codo bares te hal.
teni Eneida ol
Spring/Hibemoto, WebSphoro, WobSphore EP UCATION,
E MADISON UNIVERSITY
Niger, LO Bidor 50 Bets: UNMadizon Department o Computer Seienees
+ Corbera Orel 109082, Sa 50/55 MADISON MICH SCHOOL
| MESOLA/SOL rabo Computer Sefanes
cn
    `;
    const parsed = parseCvText(textImage15);
    console.log(JSON.stringify(parsed, null, 2));
    expect(parsed.firstNames).not.toBe('SENIOR');
    expect(parsed.lastNames).not.toBe('JAVA DEVELOPER');
  });
});
