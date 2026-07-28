export type ClinicalRiskLevel = 'low' | 'medium' | 'high';
export type ClinicalStatus = 'improving' | 'stable' | 'attention';
export type TrendDirection = 'up' | 'down' | 'stable' | 'unknown';

export type ClinicalPatient = {
  id: string | number;
  clinicalAlert?: string | null;
  createdAt?: string | null;
};

export type ClinicalAppointment = {
  id: string | number;
  startsAt?: string | null;
  status?: string | null;
};

export type ClinicalEvaluation = {
  id: string | number;
  instrument: string;
  evaluationDate: string;
  totalScore?: number | null;
  severity?: string | null;
};

export type ClinicalGoal = {
  id: string | number;
  title: string;
  status?: string | null;
  progress?: number | null;
  updatedAt?: string | null;
};

export type ClinicalSoapNote = {
  id: string | number;
  sessionDate?: string | null;
  analysis?: string | null;
  plan?: string | null;
};

export type ClinicalIntelligenceInput = {
  patient: ClinicalPatient;
  appointments: ClinicalAppointment[];
  evaluations: ClinicalEvaluation[];
  goals: ClinicalGoal[];
  soapNotes?: ClinicalSoapNote[];
  now?: Date;
};

export type EvaluationSnapshot = {
  latestScore: number | null;
  previousScore: number | null;
  latestSeverity: string | null;
  latestDate: string | null;
  trend: TrendDirection;
  delta: number | null;
};

export type ClinicalIntelligenceResult = {
  clinicalScore: number;
  riskLevel: ClinicalRiskLevel;
  clinicalStatus: ClinicalStatus;
  adherence: number | null;
  inactivityDays: number | null;
  alerts: string[];
  strengths: string[];
  recommendations: string[];
  riskFactors: string[];
  positiveFactors: string[];
  summary: string;
  metrics: {
    sessions: number;
    completedGoals: number;
    activeGoals: number;
    averageGoalProgress: number | null;
  };
  evaluations: {
    phq9: EvaluationSnapshot;
    gad7: EvaluationSnapshot;
  };
};
