'use client';

import Link from 'next/link';
import { CalendarDays, FileText, Grid2X2, List, Search, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PatientFormModal, PatientFormValues, PsychologistOption } from '@/components/patients/patient-form-modal';
import { PatientTable } from '@/components/patients/patient-table';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type Patient = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  preferred_name?: string | null;
  email?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  psychologist_id?: string | null;
  status?: string | null;
  clinical_alert?: string | null;
  created_at?: string | null;
};

type Psychologist = { id: string; full_name?: string | null; email?: string | null; calendar_color?: string | null };
type AppointmentSummary = { id: string; patient_id: string; starts_at?: string | null; status?: string | null };
type CurrentProfile = { id: string; psychologist_id?: string | null; roles?: { name?: string } | { name?: string }[] | null };
type ViewMode = 'cards' | 'table';

type PatientAgendaSummary = {
  completedSessions: number;
  nextAppointment: AppointmentSummary | null;
};

const DEFAULT_PSYCHOLOGIST_COLOR = '#7567c7';

function roleName(profile: CurrentProfile | null) { return Array.isArray(profile?.roles) ? profile?.roles[0]?.name : profile?.roles?.name; }
function fullName(patient: Patient) { return `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Sin nombre'; }
function displayName(patient: Patient) { return patient.preferred_name || fullName(patient); }
function initials(patient: Patient) { return displayName(patient).split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase(); }
function age(date?: string | null) { if (!date) return null; const birth = new Date(`${date}T00:00:00`); const now = new Date(); let value = now.getFullYear() - birth.getFullYear(); const month = now.getMonth() - birth.getMonth(); if (month < 0 || (month === 0 && now.getDate() < birth.getDate())) value--; return value; }
function normalizedStatus(value?: string | null) { return (value || '').trim().toLowerCase(); }
function isCancelled(value?: string | null) { return ['cancelada', 'cancelado'].includes(normalizedStatus(value)); }
function isCompleted(value?: string | null) { return ['completada', 'completado'].includes(normalizedStatus(value)); }
function psychologistLabel(item?: Psychologist | null) { return item?.full_name || item?.email || 'Psicóloga sin identificar'; }
function formatNextAppointment(value?: string | null) {
  if (!value) return 'Sin cita programada';
  const date = new Date(value);
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const sameDate = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const time = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' }).format(date);
  if (sameDate(date, now)) return `Hoy · ${time}`;
  if (sameDate(date, tomorrow)) return `Mañana · ${time}`;
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

export default function PatientsPage() {
  const [rows, setRows] = useState<Patient[]>([]);
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Todos');
  const [psychologistFilter, setPsychologistFilter] = useState('Todos');
  const [view, setView] = useState<ViewMode>('cards');
  const [editing, setEditing] = useState<Patient | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');

  async function load() {
    setMsg('');
    setLoading(true);
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [patientsResult, profileResult, appointmentsResult] = await Promise.all([
      supabase.from('patients').select('id,first_name,last_name,preferred_name,email,phone,birth_date,psychologist_id,status,clinical_alert,created_at').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id,psychologist_id,roles(name)').eq('id', user.id).maybeSingle(),
      supabase.from('appointments').select('id,patient_id,starts_at,status').order('starts_at', { ascending: true }),
    ]);

    if (patientsResult.error) setMsg(patientsResult.error.message);
    else setRows((patientsResult.data || []) as Patient[]);
    if (appointmentsResult.error) setMsg(current => current || appointmentsResult.error.message);
    else setAppointments((appointmentsResult.data || []) as AppointmentSummary[]);

    const current = profileResult.data as CurrentProfile | null;
    setProfile(current);
    const role = roleName(current);

    if (role === 'Administrador' || role === 'Recepcionista') {
      const { data } = await supabase.from('profiles').select('id,full_name,email,calendar_color,roles!inner(name)').eq('roles.name', 'Psicóloga').eq('active', true).order('full_name');
      setPsychologists((data || []) as Psychologist[]);
    } else if (role === 'Psicóloga' && current) {
      const { data } = await supabase.from('profiles').select('id,full_name,email,calendar_color').eq('id', current.id).maybeSingle();
      setPsychologists(data ? [data as Psychologist] : []);
    } else if (current?.psychologist_id) {
      const { data } = await supabase.from('profiles').select('id,full_name,email,calendar_color').eq('id', current.psychologist_id).maybeSingle();
      setPsychologists(data ? [data as Psychologist] : []);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const role = roleName(profile);
  const needsPsychologist = role === 'Administrador' || role === 'Recepcionista';
  const psychologistOptions: PsychologistOption[] = psychologists.map(item => ({ id: item.id, label: psychologistLabel(item) }));
  const psychologistMap = useMemo(() => new Map(psychologists.map(item => [item.id, item])), [psychologists]);
  const agendaSummaryMap = useMemo(() => {
    const now = Date.now();
    const map = new Map<string, PatientAgendaSummary>();
    for (const appointment of appointments) {
      const patientId = String(appointment.patient_id);
      const current = map.get(patientId) || { completedSessions: 0, nextAppointment: null };
      if (isCompleted(appointment.status)) current.completedSessions += 1;
      if (appointment.starts_at && !isCancelled(appointment.status) && new Date(appointment.starts_at).getTime() >= now) {
        if (!current.nextAppointment || new Date(appointment.starts_at).getTime() < new Date(current.nextAppointment.starts_at || '').getTime()) current.nextAppointment = appointment;
      }
      map.set(patientId, current);
    }
    return map;
  }, [appointments]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter(patient => {
      const matchesStatus = status === 'Todos' || (patient.status || 'Activo') === status;
      const matchesPsychologist = psychologistFilter === 'Todos' || patient.psychologist_id === psychologistFilter;
      const assignedPsychologist = psychologistMap.get(patient.psychologist_id || '');
      const haystack = [fullName(patient), patient.preferred_name, patient.email, patient.phone, psychologistLabel(assignedPsychologist)].filter(Boolean).join(' ').toLowerCase();
      return matchesStatus && matchesPsychologist && (!term || haystack.includes(term));
    });
  }, [rows, query, status, psychologistFilter, psychologistMap]);

  function valuesFromPatient(patient: Patient): PatientFormValues {
    return {
      firstName: patient.first_name || '', lastName: patient.last_name || '', preferredName: patient.preferred_name || '', email: patient.email || '', phone: patient.phone || '', birthDate: patient.birth_date || '', psychologistId: patient.psychologist_id || '', status: patient.status || 'Activo', clinicalAlert: patient.clinical_alert || '',
    };
  }

  async function save(values: PatientFormValues) {
    setSaving(true); setMsg(''); setOk('');
    try {
      const supabase = getSupabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      const psychologistId = role === 'Psicóloga' ? profile?.id : role === 'Asistente' ? profile?.psychologist_id : values.psychologistId;
      if (!psychologistId) throw new Error('Selecciona la psicóloga responsable.');
      const payload = { first_name: values.firstName, last_name: values.lastName, preferred_name: values.preferredName || null, email: values.email || null, phone: values.phone || null, birth_date: values.birthDate || null, psychologist_id: psychologistId, status: values.status, clinical_alert: values.clinicalAlert || null, updated_at: new Date().toISOString() };
      const result = editing ? await supabase.from('patients').update(payload).eq('id', editing.id) : await supabase.from('patients').insert({ ...payload, created_by: user?.id });
      if (result.error) throw result.error;
      setOk(editing ? 'Paciente actualizado correctamente.' : 'Paciente registrado correctamente.');
      setEditing(null); setNewOpen(false); await load();
    } finally { setSaving(false); }
  }

  return <>
    <div className="page-head patients-head">
      <div><span className="eyebrow">CRM clínico</span><h1>Pacientes</h1><p className="muted">Administra pacientes, asignaciones, alertas y acceso al expediente clínico.</p></div>
      <button className="btn btn-primary" onClick={() => { setEditing(null); setNewOpen(true); }}>+ Nuevo paciente</button>
    </div>

    <section className="patient-summary-grid">
      <article className="card compact-stat"><span>Total visibles</span><strong>{rows.length}</strong></article>
      <article className="card compact-stat"><span>Activos</span><strong>{rows.filter(patient => (patient.status || 'Activo') === 'Activo').length}</strong></article>
      <article className="card compact-stat"><span>Con alerta</span><strong>{rows.filter(patient => Boolean(patient.clinical_alert)).length}</strong></article>
    </section>

    <div className="patient-toolbar card">
      <div className="search-box"><Search size={19}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por nombre, correo, teléfono o psicóloga" /></div>
      <select value={status} onChange={event => setStatus(event.target.value)} aria-label="Filtrar por estado"><option>Todos</option><option>Activo</option><option>En pausa</option><option>Alta clínica</option></select>
      {needsPsychologist ? <select value={psychologistFilter} onChange={event => setPsychologistFilter(event.target.value)} aria-label="Filtrar por psicóloga"><option value="Todos">Todas las psicólogas</option>{psychologistOptions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select> : null}
      <div className="view-switch" aria-label="Cambiar vista">
        <button className={view === 'cards' ? 'active' : ''} onClick={() => setView('cards')} title="Vista de tarjetas"><Grid2X2 size={18}/></button>
        <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')} title="Vista de tabla"><List size={19}/></button>
      </div>
    </div>

    {msg ? <div className="error">{msg}</div> : null}{ok ? <div className="success">{ok}</div> : null}

    {loading ? <div className="card empty-state">Cargando pacientes...</div> : filtered.length ? <>
      {view === 'cards' ? <div className="patient-card-grid">{filtered.map(patient => {
        const patientAge = age(patient.birth_date);
        const assignedPsychologist = psychologistMap.get(patient.psychologist_id || '');
        const psychologistColor = assignedPsychologist?.calendar_color || DEFAULT_PSYCHOLOGIST_COLOR;
        const agenda = agendaSummaryMap.get(String(patient.id)) || { completedSessions: 0, nextAppointment: null };
        return <article className="patient-card" key={patient.id} style={{ '--psychologist-color': psychologistColor } as React.CSSProperties}>
          <div className="patient-card-color" aria-hidden="true"/>
          <div className="patient-card-top"><div className="patient-avatar">{initials(patient)}</div><div className="patient-main"><h3>{displayName(patient)}</h3><small>{patient.preferred_name ? fullName(patient) : 'Paciente'}</small></div><span className={`patient-status status-${(patient.status || 'Activo').toLowerCase().replaceAll(' ', '-')}`}>{patient.status || 'Activo'}</span></div>
          <div className="patient-psychologist"><span className="psychologist-avatar" style={{ backgroundColor: psychologistColor }}>{psychologistLabel(assignedPsychologist).charAt(0).toUpperCase()}</span><div><small><UserRound size={13}/> Psicóloga asignada</small><strong>{psychologistLabel(assignedPsychologist)}</strong></div></div>
          <div className="patient-agenda-summary"><div><CalendarDays size={17}/><span><small>Próxima cita</small><strong>{formatNextAppointment(agenda.nextAppointment?.starts_at)}</strong></span></div><div><FileText size={17}/><span><small>Sesiones completadas</small><strong>{agenda.completedSessions}</strong></span></div></div>
          <div className="patient-meta"><span>{patientAge !== null ? `${patientAge} años` : 'Edad no registrada'}</span><span>{patient.phone || 'Sin teléfono'}</span><span>{patient.email || 'Sin correo'}</span></div>
          {patient.clinical_alert ? <div className="clinical-alert"><strong>Alerta</strong><span>{patient.clinical_alert}</span></div> : <div className="patient-empty-note">Sin alertas clínicas registradas</div>}
          <footer className="patient-card-actions"><button className="btn btn-secondary btn-small" onClick={() => setEditing(patient)}>Editar</button><Link className="btn btn-primary btn-small" href={`/patients/${patient.id}`}>Abrir expediente</Link></footer>
        </article>;
      })}</div> : <PatientTable rows={filtered.map(patient => ({ id: patient.id, name: displayName(patient), age: age(patient.birth_date), phone: patient.phone, email: patient.email, status: patient.status || 'Activo', psychologist: psychologistLabel(psychologistMap.get(patient.psychologist_id || '')), clinicalAlert: patient.clinical_alert }))} onEdit={id => setEditing(rows.find(patient => patient.id === id) || null)} />}
    </> : <div className="card empty-state"><div className="empty-icon">♡</div><h3>No hay pacientes para mostrar</h3><p className="muted">Registra el primero o cambia los filtros de búsqueda.</p><button className="btn btn-primary" onClick={() => setNewOpen(true)}>Registrar paciente</button></div>}

    <PatientFormModal open={newOpen || Boolean(editing)} saving={saving} psychologists={psychologistOptions} needsPsychologist={needsPsychologist} initialValues={editing ? valuesFromPatient(editing) : null} onClose={() => { setNewOpen(false); setEditing(null); }} onSubmit={save}/>
  </>;
}
