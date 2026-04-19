export interface Participant {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  dob?: string; // Date of Birth as DD.MM.YYYY string
  age?: number; // Age can be derived or imported
  weight?: number; // Weight in kg
  class?: "Junior" | "Standard" | "Heavy" | "Team" | string; // e.g., Junior, Standard, Heavy
  teamName?: string; // Team name from CSV
  teamMembers?: string[]; // Team members from CSV
  kartNumber?: number | null; // Assigned during qualification group 1 creation or for a specific race
  kartNumber2?: number | null; // Assigned for qualification 2
  qualificationLapTime1?: string | null; // Time from first quali session
  qualificationLapTime2?: string | null; // Time from second quali session
  qualificationLapTime?: string | null; // BEST lap time from both sessions, used for sorting
  heatFinishingPosition?: number | null; // Finishing position in their heat
  heatPoints?: number | null; // Points earned in their heat (for future use)
  finalStartingPosition?: number | null; // Calculated starting position for the final
  finalFinishingPosition?: number | null; // Finishing position in their final race
  eventPoints?: number | null; // Points earned in the event after finals
  totalTime?: string | null; // Total race time
  fastestLap?: string | null; // Fastest lap in a race
}

export interface Team {
  id: string;
  name:string;
  driver1Id: string;
  driver2Id: string;
  substituteDriverId?: string | null;
  substituteUsedOnEvent?: string | null;
}

export interface QualificationGroup {
  id: string;
  name: string;
  participants: Participant[];
  description?: string;
}

export interface Heat {
  id:string;
  name: string;
  participants: Participant[]; // Original participants list for this heat with their assigned karts for THIS heat
  results?: Participant[]; // Participants ordered by finishing position, including their heatFinishingPosition
  description?: string;
}

export interface FinalRace extends Heat {} // Final race structure can be similar to a Heat

export type AppStep =
  | 'participants'
  | 'qualification_setup'
  | 'qualification_timing'
  | 'heats_setup'
  | 'heats_results'
  | 'final_setup'
  | 'final_results'
  | 'overview';

export interface SeasonStanding {
    participantId: string;
    participantName: string;
    participantClass?: "Junior" | "Standard" | "Heavy" | "Team" | string;
    totalPoints: number;
    pointsByEvent: Record<string, number>;
}

export interface TeamStanding {
  teamId: string;
  teamName: string;
  totalPoints: number;
  pointsByEvent: Record<string, number>;
}


export type LoadingStates = {
  [key: string]: boolean | undefined;
};

// Type for storing heat/final result inputs temporarily
export type ResultInput = {
  [raceId: string]: {
    [participantId: string]: {
        position?: string;
        totalTime?: string;
        fastestLap?: string;
    };
  };
};
