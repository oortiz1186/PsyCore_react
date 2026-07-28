import type { ClinicalRule } from '../rule-types';

export const goalsRule: ClinicalRule = ({ activeGoals, averageGoalProgress }) => {
  if (activeGoals === 0) {
    return {
      scoreAdjustment: -8,
      riskFactors: ['No hay objetivos terapéuticos activos.'],
      recommendations: ['Registrar al menos un objetivo terapéutico activo.'],
    };
  }

  if (averageGoalProgress !== null && averageGoalProgress < 25) {
    return {
      scoreAdjustment: -8,
      riskFactors: ['El progreso promedio de los objetivos activos es menor a 25%.'],
      recommendations: ['Revisar los objetivos con menor avance y ajustar intervenciones o plazos.'],
    };
  }

  if (averageGoalProgress !== null && averageGoalProgress >= 60) {
    return {
      scoreAdjustment: 8,
      strengths: [`Progreso promedio favorable en objetivos (${averageGoalProgress}%).`],
      positiveFactors: ['Los objetivos activos muestran un progreso promedio igual o mayor a 60%.'],
    };
  }

  return {
    positiveFactors: [`Hay ${activeGoals} objetivo${activeGoals === 1 ? '' : 's'} terapéutico${activeGoals === 1 ? '' : 's'} activo${activeGoals === 1 ? '' : 's'}.`],
  };
};
