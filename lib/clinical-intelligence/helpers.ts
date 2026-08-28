import type {
  ClinicalAppointment,
  ClinicalEvaluation,
  EvaluationSnapshot,
  TrendDirection,
} from './types';

const completedAppointmentStatuses = new Set(['completed', 'completada', 'realizada', 'attended', 'atendida']);
const cancelledAppointmentStatuses = new Set(['cancelled', 'canceled', 'cancelada', 'no_show', 'no show', 'inasistencia']);
export const completedGoalStatuses = new Set(['completed', 'completado', 'completada', 'cerrado', 'cumplido']);

export function normalize(value?: string | null) {
  return (value || '').trim().toLocaleLowerCase('es');
}

export function validDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function daysBetween(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

export function appointmentIsCompleted(appointment: ClinicalAppointment, now: Date) {
  const status = normalize(appointment.status);
  if (completedAppointmentStatuses.has(status)) return true;
  if (cancelledAppointmentStatuses.has(status)) return false;
  const startsAt = validDate(appointment.startsAt);
  return Boolean(startsAt && startsAt < now);
}

export function appointmentIsCancelled(appointment: ClinicalAppointment) {
  return cancelledAppointmentStatuses.has(normalize(appointment.status));
}

export function evaluationSnapshot(
  evaluations: ClinicalEvaluation[],
  instrument: string,
): EvaluationSnapshot {
  const ordered = evaluations
    .filter(item => normalize(item.instrument) === normalize(instrument))
    .filter(item => validDate(item.evaluationDate))
    .sort((a, b) => new Date(a.evaluationDate).getTime() - new Date(b.evaluationDate).getTime());

  const latest = ordered.at(-1);
  const previous = ordered.at(-2);
  const latestScore = typeof latest?.totalScore === 'number' ? latest.totalScore : null;
  const previousScore = typeof previous?.totalScore === 'number' ? previous.totalScore : null;
  const delta = latestScore !== null && previousScore !== null ? latestScore - previousScore : null;
  let trend: TrendDirection = 'unknown';
  if (delta !== null) trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable';

  return {
    latestScore,
    previousScore,
    latestSeverity: latest?.severity || null,
    latestDate: latest?.evaluationDate || null,
    trend,
    delta,
  };
}
