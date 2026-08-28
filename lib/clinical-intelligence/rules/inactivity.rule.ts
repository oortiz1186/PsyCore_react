import type { ClinicalRule } from '../rule-types';

export const inactivityRule: ClinicalRule = ({ inactivityDays }) => {
  if (inactivityDays === null) {
    return {
      scoreAdjustment: -5,
      recommendations: ['Registrar una sesión concluida para evaluar continuidad del seguimiento.'],
      riskFactors: ['No existe una sesión concluida para calcular inactividad.'],
    };
  }

  if (inactivityDays >= 45) {
    return {
      riskPoints: 2,
      scoreAdjustment: -18,
      alerts: [`Han pasado ${inactivityDays} días desde la última sesión.`],
      riskFactors: ['Inactividad clínica mayor o igual a 45 días.'],
      recommendations: ['Contactar al paciente o actualizar su estado de seguimiento.'],
    };
  }

  if (inactivityDays >= 30) {
    return {
      riskPoints: 1,
      scoreAdjustment: -10,
      alerts: [`Han pasado ${inactivityDays} días desde la última sesión.`],
      riskFactors: ['Inactividad clínica mayor o igual a 30 días.'],
      recommendations: ['Revisar continuidad y próxima cita del tratamiento.'],
    };
  }

  if (inactivityDays <= 14) {
    return {
      scoreAdjustment: 5,
      strengths: ['Seguimiento clínico reciente.'],
      positiveFactors: ['La última sesión ocurrió durante los últimos 14 días.'],
    };
  }

  return {};
};
