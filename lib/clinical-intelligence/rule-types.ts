import type {
  ClinicalIntelligenceInput,
  EvaluationSnapshot,
} from './types';

export type ClinicalRuleContext = {
  input: ClinicalIntelligenceInput;
  phq9: EvaluationSnapshot;
  gad7: EvaluationSnapshot;
  adherence: number | null;
  inactivityDays: number | null;
  activeGoals: number;
  averageGoalProgress: number | null;
};

export type ClinicalRuleResult = {
  riskPoints?: number;
  scoreAdjustment?: number;
  alerts?: string[];
  strengths?: string[];
  recommendations?: string[];
  riskFactors?: string[];
  positiveFactors?: string[];
};

export type ClinicalRule = (context: ClinicalRuleContext) => ClinicalRuleResult;

export function mergeRuleResults(results: ClinicalRuleResult[]) {
  return results.reduce(
    (accumulator, result) => ({
      riskPoints: accumulator.riskPoints + (result.riskPoints || 0),
      scoreAdjustment: accumulator.scoreAdjustment + (result.scoreAdjustment || 0),
      alerts: [...accumulator.alerts, ...(result.alerts || [])],
      strengths: [...accumulator.strengths, ...(result.strengths || [])],
      recommendations: [...accumulator.recommendations, ...(result.recommendations || [])],
      riskFactors: [...accumulator.riskFactors, ...(result.riskFactors || [])],
      positiveFactors: [...accumulator.positiveFactors, ...(result.positiveFactors || [])],
    }),
    {
      riskPoints: 0,
      scoreAdjustment: 0,
      alerts: [] as string[],
      strengths: [] as string[],
      recommendations: [] as string[],
      riskFactors: [] as string[],
      positiveFactors: [] as string[],
    },
  );
}
