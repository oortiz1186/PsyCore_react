'use client';

import { AlertTriangle, Brain, CheckCircle2, Lightbulb, ShieldCheck } from 'lucide-react';
import type { ClinicalIntelligenceResult } from '@/lib/clinical-intelligence';

type Props = { intelligence: ClinicalIntelligenceResult };

const statusLabel = {
  improving: 'Evolución favorable',
  stable: 'Seguimiento estable',
  attention: 'Requiere seguimiento',
} as const;

const riskLabel = {
  low: 'Riesgo automático bajo',
  medium: 'Riesgo automático medio',
  high: 'Atención prioritaria',
} as const;

export function ClinicalIntelligenceCard({ intelligence }: Props) {
  return (
    <section className="card" aria-label="Resumen clínico automático" style={{ marginBottom: 20 }}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">PsyCore Intelligence</span>
          <h2>Resumen clínico automático</h2>
        </div>
        <span className="soft-chip">{riskLabel[intelligence.riskLevel]}</span>
      </div>

      <div className="detail-grid">
        <div><small>Estado</small><strong>{statusLabel[intelligence.clinicalStatus]}</strong></div>
        <div><small>Asistencia estimada</small><strong>{intelligence.adherence === null ? 'Sin datos' : `${intelligence.adherence}%`}</strong></div>
        <div><small>Días sin sesión</small><strong>{intelligence.inactivityDays === null ? 'Sin datos' : intelligence.inactivityDays}</strong></div>
        <div><small>Objetivos activos</small><strong>{intelligence.metrics.activeGoals}</strong></div>
      </div>

      <div className="contact-panel" style={{ marginTop: 18 }}>
        <div><Brain size={18}/><span><small>Interpretación</small><strong>{intelligence.summary}</strong></span></div>
      </div>

      {intelligence.alerts.length ? <div style={{ marginTop: 18 }}>
        <div className="section-heading"><div><span className="eyebrow">Alertas</span><h3>Aspectos por revisar</h3></div><AlertTriangle size={20}/></div>
        <ul>{intelligence.alerts.map(alert => <li key={alert}>{alert}</li>)}</ul>
      </div> : <div className="contact-panel" style={{ marginTop: 18 }}><div><ShieldCheck size={18}/><span><small>Alertas</small><strong>No se detectaron alertas automáticas.</strong></span></div></div>}

      {intelligence.strengths.length ? <div style={{ marginTop: 18 }}>
        <div className="section-heading"><div><span className="eyebrow">Fortalezas</span><h3>Indicadores favorables</h3></div><CheckCircle2 size={20}/></div>
        <ul>{intelligence.strengths.map(strength => <li key={strength}>{strength}</li>)}</ul>
      </div> : null}

      {intelligence.recommendations.length ? <div style={{ marginTop: 18 }}>
        <div className="section-heading"><div><span className="eyebrow">Sugerencias</span><h3>Próximas acciones</h3></div><Lightbulb size={20}/></div>
        <ul>{intelligence.recommendations.map(recommendation => <li key={recommendation}>{recommendation}</li>)}</ul>
      </div> : null}

      <p className="muted" style={{ marginTop: 18 }}>Este análisis se genera mediante reglas y sirve como apoyo para preparar la consulta. No sustituye la valoración profesional.</p>
    </section>
  );
}
