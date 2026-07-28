import type { ClinicalRule } from '../rule-types';

export const clinicalAlertRule: ClinicalRule = ({ input }) => {
  const alert = input.patient.clinicalAlert?.trim();
  if (!alert) return {};

  return {
    riskPoints: 3,
    scoreAdjustment: -25,
    alerts: [`Alerta clínica activa: ${alert}`],
    riskFactors: ['Existe una alerta clínica activa.'],
    recommendations: ['Revisar y documentar la alerta clínica antes de continuar con la consulta.'],
  };
};
