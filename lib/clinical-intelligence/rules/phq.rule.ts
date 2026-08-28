import type { ClinicalRule } from '../rule-types';

export const phqRule: ClinicalRule = ({ phq9 }) => {
  if (phq9.latestScore === null) {
    return {
      scoreAdjustment: -5,
      recommendations: ['Aplicar PHQ-9 para contar con una línea base de síntomas depresivos.'],
      riskFactors: ['No existe una medición reciente de PHQ-9.'],
    };
  }

  const result = {
    riskPoints: 0,
    scoreAdjustment: 0,
    alerts: [] as string[],
    strengths: [] as string[],
    recommendations: [] as string[],
    riskFactors: [] as string[],
    positiveFactors: [] as string[],
  };

  if (phq9.latestScore >= 20) {
    result.riskPoints += 3;
    result.scoreAdjustment -= 25;
    result.alerts.push(`PHQ-9 elevado (${phq9.latestScore} puntos).`);
    result.riskFactors.push('PHQ-9 en rango grave.');
    result.recommendations.push('Revisar prioritariamente el resultado de PHQ-9 y documentar la valoración clínica.');
  } else if (phq9.latestScore >= 15) {
    result.riskPoints += 2;
    result.scoreAdjustment -= 18;
    result.alerts.push(`PHQ-9 en rango moderadamente grave (${phq9.latestScore} puntos).`);
    result.riskFactors.push('PHQ-9 en rango moderadamente grave.');
  } else if (phq9.latestScore >= 10) {
    result.riskPoints += 1;
    result.scoreAdjustment -= 10;
    result.riskFactors.push('PHQ-9 en rango moderado.');
  } else {
    result.scoreAdjustment += 5;
    result.positiveFactors.push('PHQ-9 en rango bajo o leve.');
  }

  if (phq9.trend === 'up' && (phq9.delta || 0) >= 5) {
    result.riskPoints += 2;
    result.scoreAdjustment -= 15;
    result.alerts.push(`PHQ-9 aumentó ${phq9.delta} puntos respecto a la aplicación anterior.`);
    result.riskFactors.push('Aumento clínicamente relevante en PHQ-9.');
    result.recommendations.push('Explorar cambios recientes asociados al aumento de síntomas depresivos.');
  } else if (phq9.trend === 'down') {
    result.scoreAdjustment += 8;
    result.strengths.push(`PHQ-9 disminuyó ${Math.abs(phq9.delta || 0)} puntos.`);
    result.positiveFactors.push('La tendencia de PHQ-9 es favorable.');
  }

  return result;
};
