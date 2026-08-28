import type { ClinicalRule } from '../rule-types';

export const attendanceRule: ClinicalRule = ({ adherence }) => {
  if (adherence === null) return {};

  if (adherence < 60) {
    return {
      riskPoints: 1,
      scoreAdjustment: -15,
      alerts: [`La asistencia estimada es de ${adherence}%.`],
      riskFactors: ['La asistencia estimada es menor a 60%.'],
      recommendations: ['Revisar barreras de asistencia y acuerdos de continuidad.'],
    };
  }

  if (adherence >= 85) {
    return {
      scoreAdjustment: 10,
      strengths: [`Buena asistencia estimada (${adherence}%).`],
      positiveFactors: ['La adherencia estimada es igual o mayor a 85%.'],
    };
  }

  return {};
};
