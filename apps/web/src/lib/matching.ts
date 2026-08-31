import { CandidateFormData } from '../types/candidate';
import { VacancyFormData } from '../types/vacancy';

export interface RankedCandidate {
  candidate: CandidateFormData;
  score: number;
  matchedSkills: string[];
  matchedEducation: string[];
  matchedExperience: string[];
}

function normalize(v: string): string {
  return v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function includesNormalized(haystack: string, needle: string): boolean {
  return normalize(haystack).includes(normalize(needle));
}

function matchCandidateToVacancy(
  candidate: CandidateFormData,
  vacancy: VacancyFormData,
): RankedCandidate {
  const matchedSkills: string[] = [];
  const matchedEducation: string[] = [];
  const matchedExperience: string[] = [];
  let earnedWeight = 0;
  let totalWeight = 0;

  for (const req of vacancy.requirements) {
    const term = req.skillOrReq.trim();
    if (!term) continue;
    const weight = Math.max(1, req.weight);
    totalWeight += weight;
    let hit = false;

    switch (req.reqType) {
      case 'habilidad': {
        const skills = candidate.skills.map((s) => s.skillName).join(' ');
        if (includesNormalized(skills, term)) { hit = true; matchedSkills.push(term); break; }
        const langs = (candidate.languages ?? []).map((l) => l.language).join(' ');
        if (includesNormalized(langs, term)) { hit = true; matchedSkills.push(term); break; }
        const text = [candidate.headline ?? '', candidate.summary ?? ''].join(' ');
        if (includesNormalized(text, term)) { hit = true; matchedSkills.push(term); }
        break;
      }
      case 'experiencia': {
        const positions = candidate.experience.map((e) => e.position).join(' ');
        if (includesNormalized(positions, term)) { hit = true; matchedExperience.push(term); break; }
        const resps = candidate.experience.map((e) => e.responsibilities ?? '').join(' ');
        if (includesNormalized(resps, term)) { hit = true; matchedExperience.push(term); break; }
        if (includesNormalized(candidate.summary ?? '', term)) { hit = true; matchedExperience.push(term); }
        break;
      }
      case 'educacion': {
        const edu = candidate.education.map((e) => `${e.level} ${e.degree} ${e.institution}`).join(' ');
        if (includesNormalized(edu, term)) { hit = true; matchedEducation.push(term); }
        break;
      }
      default: {
        const full = [
          candidate.headline ?? '', candidate.summary ?? '',
          candidate.education.map((e) => `${e.level} ${e.degree} ${e.institution}`).join(' '),
          candidate.experience.map((e) => `${e.position} ${e.responsibilities ?? ''}`).join(' '),
          candidate.skills.map((s) => s.skillName).join(' '),
        ].join(' ');
        if (includesNormalized(full, term)) { hit = true; matchedSkills.push(term); }
        break;
      }
    }
    if (hit) earnedWeight += weight;
  }

  const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 1000) / 10 : 0;
  return { candidate, score, matchedSkills, matchedEducation, matchedExperience };
}

export function rankCandidates(
  candidates: CandidateFormData[],
  vacancy: VacancyFormData,
): RankedCandidate[] {
  return candidates
    .map((c) => matchCandidateToVacancy(c, vacancy))
    .sort((a, b) => b.score - a.score);
}