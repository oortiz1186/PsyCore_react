'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BellRing, CalendarClock, CheckCircle2, Clock3, RefreshCw } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type Reminder = { id:number; appointment_id:number; channel:string; scheduled_at:string; sent_at?:string|null; status:string; provider_message_id?:string|null; error_message?:string|null; appointments?: { starts_at?:string|null; status?:string|null; patients?: { first_name?:string|null; last_name?:string|null } | null } | null };
type Appointment = { id:number; starts_at:string; status?:string|null; patient_id:number; patients?: { first_name?:string|null; last_name?:string|null } | null };

function nameOf(patient?: Appointment['patients']) { return patient ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Paciente' : 'Paciente'; }
function dateTime(value?:string|null) { return value ? new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)) : '—'; }

export default function RemindersPage() {
  const [rows,setRows]=useState<Reminder[]>([]); const [appointments,setAppointments]=useState<Appointment[]>([]); const [message,setMessage]=useState(''); const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false);
  const [form,setForm]=useState({appointmentId:'',channel:'email',minutesBefore:'1440'});

  async function load(){ setLoading(true); setMessage(''); const s=getSupabaseBrowser(); const now=new Date().toISOString(); const [r,a]=await Promise.all([
    s.from('appointment_reminders').select('id,appointment_id,channel,scheduled_at,sent_at,status,provider_message_id,error_message,appointments(starts_at,status,patients(first_name,last_name))').order('scheduled_at',{ascending:false}).limit(100),
    s.from('appointments').select('id,starts_at,status,patient_id,patients(first_name,last_name)').gte('starts_at',now).not('status','in','("Cancelada","Cancelado")').order('starts_at',{ascending:true}).limit(100)
  ]); if(r.error)setMessage(r.error.message); else setRows((r.data||[]) as unknown as Reminder[]); if(!a.error)setAppointments((a.data||[]) as unknown as Appointment[]); setLoading(false); }
  useEffect(()=>{void load();},[]);

  const metrics=useMemo(()=>({pending:rows.filter(x=>x.status==='pending').length,sent:rows.filter(x=>x.status==='sent').length,failed:rows.filter(x=>x.status==='failed').length}),[rows]);

  async function createReminder(event:FormEvent){event.preventDefault();setSaving(true);setMessage('');try{const appointment=appointments.find(x=>String(x.id)===form.appointmentId);if(!appointment)throw new Error('Selecciona una cita.');const scheduled=new Date(new Date(appointment.starts_at).getTime()-Number(form.minutesBefore)*60000);if(scheduled.getTime()<=Date.now())throw new Error('El horario del recordatorio ya pasó.');const s=getSupabaseBrowser();const result=await s.from('appointment_reminders').insert({appointment_id:appointment.id,channel:form.channel,scheduled_at:scheduled.toISOString(),status:'pending'});if(result.error)throw result.error;setMessage('Recordatorio programado.');setForm(current=>({...current,appointmentId:''}));await load();}catch(error){setMessage(error instanceof Error?error.message:'No se pudo programar.');}finally{setSaving(false);}}

  async function cancel(id:number){const s=getSupabaseBrowser();const result=await s.from('appointment_reminders').update({status:'cancelled'}).eq('id',id).eq('status','pending');if(result.error)setMessage(result.error.message);else await load();}

  return <div className="page-shell"><div className="page-head"><div><span className="eyebrow">Agenda inteligente</span><h1>Recordatorios de citas</h1><p className="muted">Programa avisos por canal y controla su estado de entrega.</p></div><button className="btn btn-secondary" onClick={()=>void load()}><RefreshCw size={16}/> Actualizar</button></div>
    <section className="dashboard-stats"><article className="metric-card"><span className="metric-icon"><Clock3 size={20}/></span><span><small>Pendientes</small><strong>{metrics.pending}</strong></span></article><article className="metric-card"><span className="metric-icon"><CheckCircle2 size={20}/></span><span><small>Enviados</small><strong>{metrics.sent}</strong></span></article><article className="metric-card"><span className="metric-icon"><BellRing size={20}/></span><span><small>Fallidos</small><strong>{metrics.failed}</strong></span></article></section>
    {message?<div className="clinical-alert" style={{margin:'18px 0'}}><span>{message}</span></div>:null}
    <div className="record-grid" style={{marginTop:22}}><section className="card record-main-card"><div className="section-heading"><div><span className="eyebrow">Cola</span><h2>Recordatorios programados</h2></div></div>{loading?<div className="empty-state compact-empty">Cargando...</div>:rows.length?<div className="appointment-list">{rows.map(item=><div className="appointment-item" key={item.id}><CalendarClock size={18}/><div><strong>{nameOf(item.appointments?.patients)}</strong><small>Cita {dateTime(item.appointments?.starts_at)} · aviso {dateTime(item.scheduled_at)} · {item.channel}</small>{item.error_message?<small className="error">{item.error_message}</small>:null}</div><span className="soft-chip">{item.status}</span>{item.status==='pending'?<button className="btn btn-secondary btn-small" onClick={()=>void cancel(item.id)}>Cancelar</button>:null}</div>)}</div>:<div className="empty-state compact-empty">No hay recordatorios programados.</div>}</section>
      <aside className="card record-side-card"><span className="eyebrow">Nuevo aviso</span><h2>Programar</h2><form className="form" onSubmit={createReminder}><label className="field">Cita<select required value={form.appointmentId} onChange={e=>setForm({...form,appointmentId:e.target.value})}><option value="">Selecciona</option>{appointments.map(a=><option key={a.id} value={a.id}>{nameOf(a.patients)} · {dateTime(a.starts_at)}</option>)}</select></label><label className="field">Canal<select value={form.channel} onChange={e=>setForm({...form,channel:e.target.value})}><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="portal">Portal</option></select></label><label className="field">Anticipación<select value={form.minutesBefore} onChange={e=>setForm({...form,minutesBefore:e.target.value})}><option value="60">1 hora antes</option><option value="180">3 horas antes</option><option value="720">12 horas antes</option><option value="1440">24 horas antes</option><option value="2880">48 horas antes</option></select></label><button className="btn btn-primary" disabled={saving}>{saving?'Programando...':'Programar recordatorio'}</button></form></aside></div>
  </div>;
}
