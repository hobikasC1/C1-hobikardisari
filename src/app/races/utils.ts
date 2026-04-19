import { v4 as uuidv4 } from 'uuid';
import { Participant, QualificationGroup, Heat, FinalRace } from '@/types';
import { LOCAL_STORAGE_PREFIX, PUNKTI_SUSTEEM } from './constants';

export const cleanName = (name: string | null | undefined): string => {
    if (!name) return '';
    return name.replace(/[\s\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]+/g, ' ').trim();
};

export const LAP_TIME_REGEX = /^(?:(\d{1,2})[:.])?(\d{1,2})[:.](\d{1,3})$/;

export const parseLapTimeToMillis = (timeStr: string | null | undefined): number => {
    if (!timeStr) return Infinity;
    const match = timeStr.match(LAP_TIME_REGEX);
    if (!match) return Infinity;
    const minutes = parseInt(match[1] || '0', 10);
    const seconds = parseInt(match[2], 10);
    const milliseconds = parseInt(match[3].padEnd(3, '0').substring(0,3), 10);
    if (isNaN(minutes) || isNaN(seconds) || isNaN(milliseconds) || seconds >= 60 || milliseconds >= 1000) return Infinity;
    return minutes * 60000 + seconds * 1000 + milliseconds;
};

export const millisToTimeStr = (millis: number): string | null => {
    if (millis === Infinity || isNaN(millis)) return null;
    const totalMillis = Math.floor(millis);
    const minutes = Math.floor(totalMillis / 60000);
    const seconds = Math.floor((totalMillis % 60000) / 1000) % 60;
    const milliseconds = totalMillis % 1000;
    const paddedSeconds = String(seconds).padStart(2, '0');
    const paddedMilliseconds = String(milliseconds).padStart(3, '0');
    if (minutes > 0) return `${minutes}:${paddedSeconds}.${paddedMilliseconds}`;
    return `${seconds}.${paddedMilliseconds}`;
};

export const shuffleArray = <T>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

export const assignKartsToMinimizeRepeats = (
  participantsToAssign: Participant[],
  availableKarts: number[],
  previousStagesParticipants: Participant[][]
): Participant[] => {
  const usedKartsByParticipant = new Map<string, Set<number>>();
  previousStagesParticipants.flat().forEach(p => {
    if (p.id) {
        const s = usedKartsByParticipant.get(p.id) || new Set();
        if (p.kartNumber != null) s.add(p.kartNumber);
        if (p.kartNumber2 != null) s.add(p.kartNumber2);
        usedKartsByParticipant.set(p.id, s);
    }
  });

  let kartsPool = shuffleArray([...availableKarts]);
  const assignments: Participant[] = [];

  for (const p of participantsToAssign) {
    if (kartsPool.length === 0) {
      assignments.push({ ...p, kartNumber: null });
      continue;
    }
    const pUsed = usedKartsByParticipant.get(p.id) || new Set();
    let kartIndex = kartsPool.findIndex(k => !pUsed.has(k));
    if (kartIndex === -1) kartIndex = 0;
    const assignedKart = kartsPool.splice(kartIndex, 1)[0];
    assignments.push({ ...p, kartNumber: assignedKart });
  }
  return assignments;
};

export const getDynamicLsKeys = (event: string) => {
  if (!event) return { 
    LS_PARTICIPANTS: '', 
    LS_QUALIFICATION_GROUPS: '', 
    LS_SESSION_KART_CAPACITY: '', 
    LS_AVAILABLE_KART_NUMBERS: '', 
    LS_HEATS: '', 
    LS_HEAT_RESULTS_INPUT: '', 
    LS_FINALS: '', 
    LS_FINAL_RESULTS_INPUT: '', 
    LS_CURRENT_STEP: '' 
  };
  const eventPrefix = `${LOCAL_STORAGE_PREFIX}${event.replace(/[^a-zA-Z0-9]/g, '_')}_`;
  return {
    LS_PARTICIPANTS: `${eventPrefix}participants`,
    LS_QUALIFICATION_GROUPS: `${eventPrefix}qualification_groups`,
    LS_SESSION_KART_CAPACITY: `${eventPrefix}session_kart_capacity`,
    LS_AVAILABLE_KART_NUMBERS: `${eventPrefix}available_kart_numbers`,
    LS_HEATS: `${eventPrefix}heats`,
    LS_HEAT_RESULTS_INPUT: `${eventPrefix}heat_results_input`,
    LS_FINALS: `${eventPrefix}finals`,
    LS_FINAL_RESULTS_INPUT: `${eventPrefix}final_results_input`,
    LS_CURRENT_STEP: `${eventPrefix}current_step`,
  };
};

export const generateHeatsWithStaggeredGrid = (
    sortedQualificationGroups: QualificationGroup[],
    availableKarts: number[]
): Heat[] => {
    const numQualiGroups = sortedQualificationGroups.length;
    if (numQualiGroups === 0) return [];
    const numHeats = numQualiGroups;
    const newHeats: Heat[] = [];
    const sortedGroups = [...sortedQualificationGroups]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(g => ({
            ...g,
            participants: [...g.participants].sort((a, b) => parseLapTimeToMillis(a.qualificationLapTime) - parseLapTimeToMillis(b.qualificationLapTime))
        }));
    const maxGridSize = Math.max(...sortedGroups.map(g => g.participants.length));
    if (maxGridSize === 0) return [];
    for (let heatIndex = 0; heatIndex < numHeats; heatIndex++) {
        const heatParticipantsStaging: Participant[] = [];
        for (let positionIndex = 0; positionIndex < maxGridSize; positionIndex++) {
            const qualiGroupIndex = (heatIndex + positionIndex) % numQualiGroups;
            const sourceGroup = sortedGroups[qualiGroupIndex];
            if (positionIndex < sourceGroup.participants.length) {
                const participant = sourceGroup.participants[positionIndex];
                heatParticipantsStaging.push({ ...participant, finalStartingPosition: positionIndex + 1 });
            }
        }
        heatParticipantsStaging.sort((a,b) => (a.finalStartingPosition || Infinity) - (b.finalStartingPosition || Infinity));
        const allQualiParticipants = sortedQualificationGroups.flatMap(g => g.participants);
        const participantsWithKarts = assignKartsToMinimizeRepeats(heatParticipantsStaging, availableKarts, [allQualiParticipants]);
        newHeats.push({ id: uuidv4(), name: `Eelsõit ${heatIndex + 1}`, participants: participantsWithKarts, results: [] });
    }
    return newHeats;
};

export const generateFinalsFromRankedHeats = (
    heatsWithResults: Heat[],
    availableKarts: number[],
    qualificationGroupStructure: number[],
    previousStagesParticipants: Participant[][]
): FinalRace[] => {
    const participantsByPosition: Record<number, Participant[]> = {};
    const allResults = heatsWithResults.flatMap(heat => heat.results || []);
    allResults.forEach(p => {
        const pos = p.heatFinishingPosition;
        if (pos) {
            if (!participantsByPosition[pos]) participantsByPosition[pos] = [];
            participantsByPosition[pos].push(p);
        }
    });
    const rankedParticipants: Participant[] = [];
    const positions = Object.keys(participantsByPosition).map(Number).sort((a, b) => a - b);
    for (const pos of positions) {
        const group = participantsByPosition[pos];
        group.sort((a, b) => {
            const bestTimeA = Math.min(parseLapTimeToMillis(a.qualificationLapTime), parseLapTimeToMillis(a.fastestLap));
            const bestTimeB = Math.min(parseLapTimeToMillis(b.qualificationLapTime), parseLapTimeToMillis(b.fastestLap));
            return bestTimeA - bestTimeB;
        });
        rankedParticipants.push(...group);
    }
    const newFinals: FinalRace[] = [];
    let participantIndex = 0;
    const finalNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    for (let i = 0; i < qualificationGroupStructure.length; i++) {
        const size = qualificationGroupStructure[i];
        if (participantIndex >= rankedParticipants.length) break;
        const finalParticipantsRaw = rankedParticipants.slice(participantIndex, participantIndex + size);
        participantIndex += size;
        if (finalParticipantsRaw.length === 0) continue;
        const finalParticipants = assignKartsToMinimizeRepeats(finalParticipantsRaw, availableKarts, previousStagesParticipants).map((p, index) => ({ ...p, finalStartingPosition: index + 1 }));
        newFinals.push({ id: uuidv4(), name: `Finaal ${finalNames[i]}`, participants: finalParticipants, results: [] });
    }
    return newFinals;
};

export const calculateEventPoints = (finalRace: FinalRace): Record<string, number> => {
    const pointsResult: Record<string, number> = {};
    if (finalRace.results && finalRace.name.toUpperCase().includes('FINAAL A')) {
        finalRace.results.forEach(participant => {
            if (participant.finalFinishingPosition !== null && participant.finalFinishingPosition > 0) {
                const position = participant.finalFinishingPosition - 1;
                pointsResult[participant.id] = PUNKTI_SUSTEEM[position] ?? 0;
            } else {
                pointsResult[participant.id] = 0;
            }
        });
    }
    return pointsResult;
};
