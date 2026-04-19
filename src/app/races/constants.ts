import { AppStep } from '@/types';

export const STEP_ORDER: AppStep[] = [
  'participants',
  'qualification_setup',
  'qualification_timing',
  'heats_setup',
  'heats_results',
  'final_setup',
  'final_results',
  'overview',
];

export const STEP_LABELS: Record<AppStep, string> = {
  participants: '1. Osalejad',
  qualification_setup: '2. Kvali grupid',
  qualification_timing: '3. Kvali tulemused',
  heats_setup: '4. Eelsõidud',
  heats_results: '5. Tulemused',
  final_setup: '6. Finaalid',
  final_results: '7. Tulemused',
  overview: 'Punktitabel',
};

export const RACE_CALENDAR = [
  '1. Rapla kardirada', 
  '2. Raassilla/Porsche', 
  '3. Kuningamäe kardirada', 
  '4. Käina kardirada', 
  '5. Unibet Kardikeskus', 
  '6. Aravete kardirada'
];

export const PUNKTI_SUSTEEM = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

export const LOCAL_STORAGE_PREFIX = 'hobbyKarting_';
export const LS_ALL_DRIVERS = `${LOCAL_STORAGE_PREFIX}all_drivers`;
export const LS_TEAMS = `${LOCAL_STORAGE_PREFIX}teams`;
