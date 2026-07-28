import {
  appointmentIsCancelled,
  appointmentIsCompleted,
  completedGoalStatuses,
  daysBetween,
  evaluationSnapshot,
  normalize,
  validDate,
} from './helpers';
import { mergeRuleResults } from './rule-types';
import { attendanceRule } from './rules/attendance.rule';
import { clinicalAlertRule } from './rules/clinical-alert.rule';
import { gadRule } from './rules/gad.rule';
import { goalsRule } from './rules/goals.rule';
import { inactivityRule } from './rules/inactivity.rule';
import { phqRule } from './rules/phq.rule';
import type { ClinicalIntelligenceInput, ClinicalIntelligenceResult } from './types';

const rules = [
  clinicalAlertRule,
  phqRule,
  gadRule,
  inactivityRule,
  attendanceRule,
  goalsRule,
];

function unique(values: string[]) {
  return [...new Set(values)];
}

export function analyzePatient(input: ClinicalIntelligenceInput): ClinicalIntelligenceResult {
  const now = input.now || new Date();
  const completedAppointments = input.appointments.filter(item => appointmentIsCompleted(item, now));
  const cancelledAppointments = input.appointments.filter(appointmentIsCancelled);
  const attendanceBase = completedAppointments.length + cancelledAppointments.length;
  const adherence = attendanceBase
    ? Math.round((completedAppointments.length / attendanceBase) * 100)
    : null;

  const lastSessionDate = completedAppointments
    .map(item => validDate(item.startsAt))
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => b.getTime() - a.getTime())[0] || null;
  const inactivityDays = lastSessionDate ? daysBetween(lastSessionDate, now) : null;

  const phq9 = evaluationSnapshot(input.evaluations, 'PHQ-9');
  const gad7 = evaluationSnapshot(input.evaluations, 'GAD-7');
  const completedGoals = input.goals.filter(item => completedGoalStatuses.has(normalize(item.status)));
  const activeGoals = input.goals.filter(item => !completedGoalStatuses.has(normalize(item.status)));
  const progressValues = activeGoals
    .map(item => item.progress)
    .filter((value): value is number => typeof value === 'number');
  const averageGoalProgress = progressValues.length
    ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length)
    : null;

  const context = {
    input,
    phq9,
    gad7,
    adherence,
    inactivityDays,
    activeGoals: activeGoals.length,
    averageGoalProgress,
  };
  const ruleResult = mergeRuleResults(rules.map(rule => rule(context)));

  const improvingSignals = [phq9.trend, gad7.trend].filter(item => item === 'down').length;
  const worseningSignals = [phq9.trend, gad7.trend].filter(item => item === 'up').length;
  const riskLevel = ruleResult.riskPoints >= 4 ? 'high' : ruleResult.riskPoints >= 2 ? 'medium' : 'low';
  const clinicalStatus = riskLevel === 'high' || worseningSignals > improvingSignals
    ? 'attention'
    : improvingSignals > worseningSignals
      ? 'improving'
      : 'stable';

  const clinicalScore = Math.max(0, Math.min(100, 70 + ruleResult.scoreAdjustment));
  const statusText = clinicalStatus === 'improving'
    ? 'La evolución automática muestra señales favorables.'
    : clinicalStatus === 'attention'
      ? 'El expediente contiene indicadores que requieren revisión profesional.'
      : 'La información disponible muestra un seguimiento estable, sin cambios concluyentes.';
  const attendanceText = adherence === null
    ? 'Aún no hay suficientes citas cerradas para calcular asistencia.'
    : `La asistencia estimada es de ${adherence}%.`;
  const goalText = activeGoals.length
    ? `Hay ${activeGoals.length} objetivo${activeGoals.length === 1 ? '' : 's'} activo${activeGoals.length === 1 ? '' : 's'}.`
    : 'No hay objetivos terapéuticos activos.';

  return {
    clinicalScore,
    riskLevel,
    clinicalStatus,
    adherence,
    inactivityDays,
    alerts: unique(ruleResult.alerts),
    strengths: unique(ruleResult.strengths),
    recommendations: unique(ruleResult.recommendations),
    riskFactors: unique(ruleResult.riskFactors),
    positiveFactors: unique(ruleResult.positiveFactors),
    summary: `${statusText} ${attendanceText} ${goalText}`,
    metrics: {
      sessions: completedAppointments.length,
      completedGoals: completedGoals.length,
      activeGoals: activeGoals.length,
      averageGoalProgress,
    },
    evaluations: { phq9, gad7 },
  };
}
