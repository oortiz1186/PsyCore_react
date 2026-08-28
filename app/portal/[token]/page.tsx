'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { CalendarDays, CheckCircle2, ClipboardCheck, FileSignature, Send, UserRound, XCircle } from 'lucide-react';

type PortalData = {
  patient: { id: number; first_name?: string | null; last_name?: string | null; preferred_name?: string | null; email?: string | null; phone?: string | null };
  appointments: { id: number; starts_at?: string | null; status?: string | null; consultation_mode?: string | null }[];
  homework: { id: number; title: string; instructions?: string | null; due_at?: string | null; status: string; patient_response?: string | null; completed_at?: string | null }[];
  consents: { id: number; consent_type: string; document_version: string; document_text: string; signer_name?: string | null; signer_relationship?: string | null; signed_at?: string | null; revoked_at?: string | null; created_at: string }[];
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
  const [busy, setBusy] = useState<number | null>(null);
  const [responses, setResponses] = useState<Record<number,string>>({});
  const [signerNames, setSignerNames] = useState<Record<number,string>>({});
  const [relationships, setRelationships] = useState<Record<number,string>>({});
  const [accepted, setAccepted] = useState<Record<number,boolean>>({});

  async function load() {
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/portal/${encodeURIComponent(token)}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo abrir el portal.');
      const next = payload as PortalData;
      setData(next);
      setResponses(Object.fromEntries(next.homework.map(item => [item.id, item.patient_response || ''])));
      setSignerNames(Object.fromEntries(next.consents.map(item => [item.id, item.signer_name || ''])));
      setRelationships(Object.fromEntries(next.consents.map(item => [item.id, item.signer_relationship || ''])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir el portal.');
    } finally { setLoading(false); }
  }

  useEffect(() => { if (token) void load(); }, [token]);

  async function act(body: Record<string,unknown>, key: number) {
    setBusy(key); setError('');
    try {
      const response = await fetch(`/api/portal/${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo guardar.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar.'); }
    finally { setBusy(null); }
  }

  const pendingHomework = useMemo(() => data?.homework.filter(item => item.status !== 'completed' && item.status !== 'cancelled') || [], [data]);

  if (loading) return <main style={{ maxWidth: 980, margin: '60px auto', padding: 24 }}><div className="card empty-state">Abriendo portal del paciente...</div></main>;
  if (error && !data) return <main style={{ maxWidth: 760, margin: '60px auto', padding: 24 }}><div className="card empty-state"><h1>Portal no disponible</h1><p className="error">{error}</p><p className="muted">Solicita una nueva invitación a tu profesional.</p></div></main>;
  if (!data) return null;

  return <main style={{ maxWidth: 1100, margin: '34px auto 70px', padding: '0 20px' }}>
    <section className="patient-record-hero"><div className="patient-record-avatar"><UserRound size={28}/></div><div className="patient-record-copy"><span className="eyebrow">Portal del paciente</span><h1>Hola, {patientName(data.patient)}</h1><p className="muted">Consulta tus citas y participa en tu seguimiento terapéutico.</p></div></section>
    {error ? <div className="clinical-alert" style={{marginBottom:18}}><strong>No fue posible completar la operación</strong><span>{error}</span></div> : null}

    <section className="dashboard-stats"><article className="metric-card"><span className="metric-icon"><CalendarDays size={21}/></span><span><small>Próximas citas</small><strong>{data.appointments.length}</strong></span></article><article className="metric-card"><span className="metric-icon"><ClipboardCheck size={21}/></span><span><small>Tareas pendientes</small><strong>{pendingHomework.length}</strong></span></article><article className="metric-card"><span className="metric-icon"><FileSignature size={21}/></span><span><small>Consentimientos</small><strong>{data.consents.length}</strong></span></article></section>

    <div className="record-grid" style={{ marginTop: 22 }}><section className="card record-main-card"><div className="section-heading"><div><span className="eyebrow">Agenda</span><h2>Próximas citas</h2><p className="muted">Confirma tu asistencia o cancela una cita que todavía no ocurre.</p></div></div>{data.appointments.length ? <div className="appointment-list">{data.appointments.map(item => <div className="appointment-item" key={item.id} style={{alignItems:'center'}}><span className="appointment-dot"/><div style={{flex:1}}><strong>{item.starts_at ? new Intl.DateTimeFormat('es-MX',{dateStyle:'long',timeStyle:'short'}).format(new Date(item.starts_at)) : 'Fecha pendiente'}</strong><small>{item.consultation_mode || 'Consulta psicológica'}</small><div className="hero-actions" style={{marginTop:10}}>{item.status !== 'Confirmada' && item.status !== 'Cancelada' ? <button className="btn btn-primary btn-small" disabled={busy===item.id} onClick={()=>void act({action:'appointment',appointmentId:item.id,decision:'confirm'},item.id)}><CheckCircle2 size={15}/> Confirmar</button> : null}{item.status !== 'Cancelada' ? <button className="btn btn-secondary btn-small" disabled={busy===item.id} onClick={()=>{ if (window.confirm('¿Deseas cancelar esta cita?')) void act({action:'appointment',appointmentId:item.id,decision:'cancel'},item.id); }}><XCircle size={15}/> Cancelar</button> : null}</div></div><span className="soft-chip">{item.status || 'Programada'}</span></div>)}</div> : <div className="empty-state compact-empty">No tienes citas próximas registradas.</div>}</section><aside className="card record-side-card"><span className="eyebrow">Acceso</span><h2>Invitación activa</h2><p className="muted">Este enlace es personal. No lo compartas.</p><small>Válido hasta</small><strong style={{display:'block',marginTop:6}}>{new Intl.DateTimeFormat('es-MX',{dateStyle:'long',timeStyle:'short'}).format(new Date(data.invite.expiresAt))}</strong></aside></div>

    <section className="card record-section" style={{ marginTop: 22 }}><div className="section-heading"><div><span className="eyebrow">Seguimiento</span><h2>Tareas terapéuticas</h2><p className="muted">Puedes guardar una respuesta y marcar la actividad como completada.</p></div></div>{data.homework.length ? <div className="therapy-goals-grid">{data.homework.map(item => <article className="therapy-goal-card" key={item.id}><div className="therapy-goal-card-header"><div><span className={`goal-status status-${item.status}`}>{item.status}</span><h3>{item.title}</h3></div></div>{item.instructions ? <p className="muted">{item.instructions}</p> : null}<label style={{display:'grid',gap:7,marginTop:12}}>Tu respuesta<textarea rows={4} disabled={item.status==='cancelled'} value={responses[item.id] || ''} onChange={e=>setResponses(current=>({...current,[item.id]:e.target.value}))} placeholder="Escribe aquí tus observaciones o resultado de la actividad..."/></label><div className="hero-actions" style={{marginTop:12}}><button className="btn btn-secondary" disabled={busy===item.id || item.status==='cancelled'} onClick={()=>void act({action:'homework',homeworkId:item.id,response:responses[item.id] || '',complete:false},item.id)}><Send size={16}/> Guardar respuesta</button><button className="btn btn-primary" disabled={busy===item.id || item.status==='completed' || item.status==='cancelled'} onClick={()=>void act({action:'homework',homeworkId:item.id,response:responses[item.id] || '',complete:true},item.id)}><CheckCircle2 size={16}/> {item.status==='completed'?'Completada':'Marcar completada'}</button></div></article>)}</div> : <div className="empty-state compact-empty">No tienes tareas terapéuticas registradas.</div>}</section>

    <section className="card record-section" style={{ marginTop: 22 }}><div className="section-heading"><div><span className="eyebrow">Documentación</span><h2>Consentimientos</h2><p className="muted">Lee el documento completo antes de aceptarlo.</p></div></div>{data.consents.length ? <div style={{display:'grid',gap:18}}>{data.consents.map(item => <article className="card" key={item.id} style={{boxShadow:'none'}}><div className="section-heading"><div><h3>{item.consent_type}</h3><small className="muted">Versión {item.document_version}</small></div><span className="soft-chip">{item.revoked_at ? 'Revocado' : item.signed_at ? 'Aceptado' : 'Pendiente'}</span></div><div style={{whiteSpace:'pre-wrap',maxHeight:260,overflow:'auto',padding:14,border:'1px solid var(--border)',borderRadius:12,marginBottom:14}}>{item.document_text}</div>{!item.signed_at && !item.revoked_at ? <><div className="form-grid"><label>Nombre del firmante<input value={signerNames[item.id] || ''} onChange={e=>setSignerNames(current=>({...current,[item.id]:e.target.value}))}/></label><label>Relación con el paciente<input value={relationships[item.id] || ''} onChange={e=>setRelationships(current=>({...current,[item.id]:e.target.value}))} placeholder="Paciente, madre, padre, tutor..."/></label></div><label style={{display:'flex',alignItems:'flex-start',gap:9,margin:'14px 0'}}><input type="checkbox" checked={Boolean(accepted[item.id])} onChange={e=>setAccepted(current=>({...current,[item.id]:e.target.checked}))}/><span>He leído el documento y manifiesto mi aceptación electrónica.</span></label><button className="btn btn-primary" disabled={busy===item.id || !accepted[item.id] || !(signerNames[item.id] || '').trim()} onClick={()=>void act({action:'consent',consentId:item.id,signerName:signerNames[item.id],signerRelationship:relationships[item.id],accepted:true},item.id)}><FileSignature size={16}/> Aceptar consentimiento</button></> : <p className="muted">{item.signed_at ? `Aceptado el ${new Intl.DateTimeFormat('es-MX',{dateStyle:'long',timeStyle:'short'}).format(new Date(item.signed_at))}${item.signer_name ? ` por ${item.signer_name}` : ''}.` : 'Este consentimiento fue revocado.'}</p>}</article>)}</div> : <div className="empty-state compact-empty">No hay consentimientos visibles.</div>}</section>
  </main>;
}
