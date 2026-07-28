import type { ClinicalRule } from '../rule-types';

export const gadRule: ClinicalRule = ({ gad7 }) => {
  if (gad7.latestScore === null) {
    return {
      scoreAdjustment: -5,
      recommendations: ['Aplicar GAD-7 para contar con una línea base de síntomas de ansiedad.'],
      riskFactors: ['No existe una medición reciente de GAD-7.'],
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

  if (gad7.latestScore >= 15) {
    result.riskPoints += 2;
    result.scoreAdjustment -= 20;
    result.alerts.push(`GAD-7 elevado (${gad7.latestScore} puntos).`);
    result.riskFactors.push('GAD-7 en rango grave.');
    result.recommendations.push('Revisar el nivel actual de ansiedad y su impacto funcional.');
  } else if (gad7.latestScore >= 10) {
    result.riskPoints += 1;
    result.scoreAdjustment -= 10;
    result.riskFactors.push('GAD-7 en rango moderado.');
  } else {
    result.scoreAdjustment += 5;
    result.positiveFactors.push('GAD-7 en rango bajo o leve.');
  }

  if (gad7.trend === 'up' && (gad7.delta || 0) >= 4) {
    result.riskPoints += 1;
    result.scoreAdjustment -= 12;
    result.alerts.push(`GAD-7 aumentó ${gad7.delta} puntos respecto a la aplicación anterior.`);
    result.riskFactors.push('Aumento relevante en GAD-7.');
    result.recommendations.push('Explorar detonantes recientes y adherencia a estrategias de regulación.');
  } else if (gad7.trend === 'down') {
    result.scoreAdjustment += 8;
    result.strengths.push(`GAD-7 disminuyó ${Math.abs(gad7.delta || 0)} puntos.`);
    result.positiveFactors.push('La tendencia de GAD-7 es favorable.');
  }

  return result;
};
