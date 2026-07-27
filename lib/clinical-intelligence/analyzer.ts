import type {
  ClinicalAppointment,
  ClinicalEvaluation,
  ClinicalIntelligenceInput,
  ClinicalIntelligenceResult,
  EvaluationSnapshot,
  TrendDirection,
} from './types';

const completedAppointmentStatuses = new Set(['completed', 'completada', 'realizada', 'attended', 'atendida']);
const cancelledAppointmentStatuses = new Set(['cancelled', 'canceled', 'cancelada', 'no_show', 'no show', 'inasistencia']);
const completedGoalStatuses = new Set(['completed', 'completado', 'completada', 'cerrado', 'cumplido']);

function normalize(value?: string | null) {
  return (value || '').trim().toLocaleLowerCase('es');
}

function validDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

function appointmentIsCompleted(appointment: ClinicalAppointment, now: Date) {
  const status = normalize(appointment.status);
  if (completedAppointmentStatuses.has(status)) return true;
  if (cancelledAppointmentStatuses.has(status)) return false;
  const startsAt = validDate(appointment.startsAt);
  return Boolean(startsAt && startsAt < now);
}

function appointmentIsCancelled(appointment: ClinicalAppointment) {
  return cancelledAppointmentStatuses.has(normalize(appointment.status));
}

function evaluationSnapshot(evaluations: ClinicalEvaluation[], instrument: string): EvaluationSnapshot {
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

export function analyzePatient(input: ClinicalIntelligenceInput): ClinicalIntelligenceResult {
  const now = input.now || new Date();
  const completedAppointments = input.appointments.filter(item => appointmentIsCompleted(item, now));
  const cancelledAppointments = input.appointments.filter(appointmentIsCancelled);
  const attendanceBase = completedAppointments.length + cancelledAppointments.length;
  const adherence = attendanceBase ? Math.round((completedAppointments.length / attendanceBase) * 100) : null;

  const lastSessionDate = completedAppointments
    .map(item => validDate(item.startsAt))
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => b.getTime() - a.getTime())[0] || null;
  const inactivityDays = lastSessionDate ? daysBetween(lastSessionDate, now) : null;

  const phq9 = evaluationSnapshot(input.evaluations, 'PHQ-9');
  const gad7 = evaluationSnapshot(input.evaluations, 'GAD-7');
  const completedGoals = input.goals.filter(item => completedGoalStatuses.has(normalize(item.status)));
  const activeGoals = input.goals.filter(item => !completedGoalStatuses.has(normalize(item.status)));
  const progressValues = activeGoals.map(item => item.progress).filter((value): value is number => typeof value === 'number');
  const averageGoalProgress = progressValues.length
    ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length)
    : null;

  const alerts: string[] = [];
  const strengths: string[] = [];
  const recommendations: string[] = [];
  let riskScore = 0;

  if (input.patient.clinicalAlert?.trim()) {
    alerts.push(`Alerta clínica activa: ${input.patient.clinicalAlert.trim()}`);
    riskScore += 3;
  }

  if (phq9.latestScore === null) {
    recommendations.push('Aplicar PHQ-9 para contar con una línea base de síntomas depresivos.');
  } else {
    if (phq9.latestScore >= 20) {
      alerts.push(`PHQ-9 elevado (${phq9.latestScore} puntos).`);
      recommendations.push('Revisar prioritariamente el resultado de PHQ-9 y documentar la valoración clínica.');
      riskScore += 3;
    } else if (phq9.latestScore >= 15) {
      alerts.push(`PHQ-9 en rango moderadamente grave (${phq9.latestScore} puntos).`);
      riskScore += 2;
    }
    if (phq9.trend === 'up' && (phq9.delta || 0) >= 5) {
      alerts.push(`PHQ-9 aumentó ${phq9.delta} puntos respecto a la aplicación anterior.`);
      recommendations.push('Explorar cambios recientes asociados al aumento de síntomas depresivos.');
      riskScore += 2;
    } else if (phq9.trend === 'down') {
      strengths.push(`PHQ-9 disminuyó ${Math.abs(phq9.delta || 0)} puntos.`);
    }
  }

  if (gad7.latestScore === null) {
    recommendations.push('Aplicar GAD-7 para contar con una línea base de síntomas de ansiedad.');
  } else {
    if (gad7.latestScore >= 15) {
      alerts.push(`GAD-7 elevado (${gad7.latestScore} puntos).`);
      recommendations.push('Revisar el nivel actual de ansiedad y su impacto funcional.');
      riskScore += 2;
    }
    if (gad7.trend === 'up' && (gad7.delta || 0) >= 4) {
      alerts.push(`GAD-7 aumentó ${gad7.delta} puntos respecto a la aplicación anterior.`);
      recommendations.push('Explorar detonantes recientes y adherencia a estrategias de regulación.');
      riskScore += 1;
    } else if (gad7.trend === 'down') {
      strengths.push(`GAD-7 disminuyó ${Math.abs(gad7.delta || 0)} puntos.`);
    }
  }

  if (inactivityDays !== null && inactivityDays >= 45) {
    alerts.push(`Han pasado ${inactivityDays} días desde la última sesión.`);
    recommendations.push('Contactar al paciente o actualizar su estado de seguimiento.');
    riskScore += 2;
  } else if (inactivityDays !== null && inactivityDays >= 30) {
    alerts.push(`Han pasado ${inactivityDays} días desde la última sesión.`);
    recommendations.push('Revisar continuidad y próxima cita del tratamiento.');
    riskScore += 1;
  }

  if (adherence !== null && adherence < 60) {
    alerts.push(`La asistencia estimada es de ${adherence}%.`);
    recommendations.push('Revisar barreras de asistencia y acuerdos de continuidad.');
    riskScore += 1;
  } else if (adherence !== null && adherence >= 85) {
    strengths.push(`Buena asistencia estimada (${adherence}%).`);
  }

  if (activeGoals.length === 0) {
    recommendations.push('Registrar al menos un objetivo terapéutico activo.');
  } else if (averageGoalProgress !== null && averageGoalProgress < 25) {
    recommendations.push('Revisar los objetivos con menor avance y ajustar intervenciones o plazos.');
  }

  const improvingSignals = [phq9.trend, gad7.trend].filter(item => item === 'down').length;
  const worseningSignals = [phq9.trend, gad7.trend].filter(item => item === 'up').length;
  const riskLevel = riskScore >= 4 ? 'high' : riskScore >= 2 ? 'medium' : 'low';
  const clinicalStatus = riskLevel === 'high' || worseningSignals > improvingSignals
    ? 'attention'
    : improvingSignals > worseningSignals
      ? 'improving'
      : 'stable';

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
    riskLevel,
    clinicalStatus,
    adherence,
    inactivityDays,
    alerts: [...new Set(alerts)],
    strengths: [...new Set(strengths)],
    recommendations: [...new Set(recommendations)],
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
