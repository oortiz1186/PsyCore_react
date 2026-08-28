'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { CalendarDays, ClipboardCheck, FileSignature, UserRound } from 'lucide-react';

type PortalData = {
  patient: { id: number; first_name?: string | null; last_name?: string | null; preferred_name?: string | null; email?: string | null; phone?: string | null };
  appointments: { id: number; starts_at?: string | null; status?: string | null; consultation_mode?: string | null }[];
  homework: { id: number; title: string; instructions?: string | null; due_at?: string | null; status: string; patient_response?: string | null; completed_at?: string | null }[];
  consents: { id: number; consent_type: string; document_version: string; signer_name?: string | null; signed_at?: string | null; revoked_at?: string | null; created_at: string }[];
  invite: { email: string; expiresAt: string };
};

function patientName(patient: PortalData['patient']) {
  return patient.preferred_name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Paciente';
}

export default function PatientPortalPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true); setError('');
      try {
        const response = await fetch(`/api/portal/${encodeURIComponent(token)}`, { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'No se pudo abrir el portal.');
        setData(payload as PortalData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo abrir el portal.');
      } finally { setLoading(false); }
    }
    if (token) void load();
  }, [token]);

  const pendingHomework = useMemo(() => data?.homework.filter(item => item.status !== 'completed' && item.status !== 'cancelled') || [], [data]);

  if (loading) return <main style={{ maxWidth: 980, margin: '60px auto', padding: 24 }}><div className="card empty-state">Abriendo portal del paciente...</div></main>;
  if (error || !data) return <main style={{ maxWidth: 760, margin: '60px auto', padding: 24 }}><div className="card empty-state"><h1>Portal no disponible</h1><p className="error">{error}</p><p className="muted">Solicita una nueva invitación a tu profesional.</p></div></main>;

  return <main style={{ maxWidth: 1100, margin: '34px auto 70px', padding: '0 20px' }}>
    <section className="patient-record-hero"><div className="patient-record-avatar"><UserRound size={28}/></div><div className="patient-record-copy"><span className="eyebrow">Portal del paciente</span><h1>Hola, {patientName(data.patient)}</h1><p className="muted">Consulta tus próximas citas, tareas terapéuticas y consentimientos.</p></div></section>

    <section className="dashboard-stats">
      <article className="metric-card"><span className="metric-icon"><CalendarDays size={21}/></span><span><small>Próximas citas</small><strong>{data.appointments.length}</strong></span></article>
      <article className="metric-card"><span className="metric-icon"><ClipboardCheck size={21}/></span><span><small>Tareas pendientes</small><strong>{pendingHomework.length}</strong></span></article>
      <article className="metric-card"><span className="metric-icon"><FileSignature size={21}/></span><span><small>Consentimientos</small><strong>{data.consents.length}</strong></span></article>
    </section>

    <div className="record-grid" style={{ marginTop: 22 }}>
      <section className="card record-main-card"><div className="section-heading"><div><span className="eyebrow">Agenda</span><h2>Próximas citas</h2></div></div>{data.appointments.length ? <div className="appointment-list">{data.appointments.map(item => <div className="appointment-item" key={item.id}><span className="appointment-dot"/><div><strong>{item.starts_at ? new Intl.DateTimeFormat('es-MX',{dateStyle:'long',timeStyle:'short'}).format(new Date(item.starts_at)) : 'Fecha pendiente'}</strong><small>{item.consultation_mode || 'Consulta psicológica'}</small></div><span className="soft-chip">{item.status || 'Programada'}</span></div>)}</div> : <div className="empty-state compact-empty">No tienes citas próximas registradas.</div>}</section>
      <aside className="card record-side-card"><span className="eyebrow">Acceso</span><h2>Invitación activa</h2><p className="muted">Este enlace es personal. No lo compartas.</p><small>Válido hasta</small><strong style={{display:'block',marginTop:6}}>{new Intl.DateTimeFormat('es-MX',{dateStyle:'long',timeStyle:'short'}).format(new Date(data.invite.expiresAt))}</strong></aside>
    </div>

    <section className="card record-section" style={{ marginTop: 22 }}><div className="section-heading"><div><span className="eyebrow">Seguimiento</span><h2>Tareas terapéuticas</h2></div></div>{data.homework.length ? <div className="therapy-goals-grid">{data.homework.map(item => <article className="therapy-goal-card" key={item.id}><div className="therapy-goal-card-header"><div><span className={`goal-status status-${item.status}`}>{item.status}</span><h3>{item.title}</h3></div></div>{item.instructions ? <p className="muted">{item.instructions}</p> : null}<div className="therapy-goal-dates"><span><small>Fecha límite</small><strong>{item.due_at ? new Intl.DateTimeFormat('es-MX',{dateStyle:'medium'}).format(new Date(item.due_at)) : 'Sin fecha'}</strong></span><span><small>Estado</small><strong>{item.completed_at ? 'Completada' : item.status}</strong></span></div></article>)}</div> : <div className="empty-state compact-empty">No tienes tareas terapéuticas registradas.</div>}</section>

    <section className="card record-section" style={{ marginTop: 22 }}><div className="section-heading"><div><span className="eyebrow">Documentación</span><h2>Consentimientos</h2></div></div>{data.consents.length ? <div className="appointment-list">{data.consents.map(item => <div className="appointment-item" key={item.id}><FileSignature size={18}/><div><strong>{item.consent_type}</strong><small>Versión {item.document_version}{item.signer_name ? ` · ${item.signer_name}` : ''}</small></div><span className="soft-chip">{item.revoked_at ? 'Revocado' : item.signed_at ? 'Firmado' : 'Pendiente'}</span></div>)}</div> : <div className="empty-state compact-empty">No hay consentimientos visibles.</div>}</section>
  </main>;
}
