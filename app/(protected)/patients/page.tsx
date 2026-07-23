'use client';

import Link from 'next/link';
import { Grid2X2, List, Search } from 'lucide-react';
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

type Psychologist = { id: string; full_name?: string | null; email?: string | null };
type CurrentProfile = { id: string; psychologist_id?: string | null; roles?: { name?: string } | { name?: string }[] | null };
type ViewMode = 'cards' | 'table';

function roleName(profile: CurrentProfile | null) { return Array.isArray(profile?.roles) ? profile?.roles[0]?.name : profile?.roles?.name; }
function fullName(patient: Patient) { return `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Sin nombre'; }
function displayName(patient: Patient) { return patient.preferred_name || fullName(patient); }
function initials(patient: Patient) { return displayName(patient).split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase(); }
function age(date?: string | null) { if (!date) return null; const birth = new Date(`${date}T00:00:00`); const now = new Date(); let value = now.getFullYear() - birth.getFullYear(); const month = now.getMonth() - birth.getMonth(); if (month < 0 || (month === 0 && now.getDate() < birth.getDate())) value--; return value; }

export default function PatientsPage() {
  const [rows, setRows] = useState<Patient[]>([]);
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);
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

    const [patientsResult, profileResult] = await Promise.all([
      supabase.from('patients').select('id,first_name,last_name,preferred_name,email,phone,birth_date,psychologist_id,status,clinical_alert,created_at').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id,psychologist_id,roles(name)').eq('id', user.id).maybeSingle(),
    ]);

    if (patientsResult.error) setMsg(patientsResult.error.message);
    else setRows((patientsResult.data || []) as Patient[]);

    const current = profileResult.data as CurrentProfile | null;
    setProfile(current);
    const role = roleName(current);

    if (role === 'Administrador' || role === 'Recepcionista') {
      const { data } = await supabase.from('profiles').select('id,full_name,email,roles!inner(name)').eq('roles.name', 'Psicóloga').eq('active', true).order('full_name');
      setPsychologists((data || []) as Psychologist[]);
    } else if (role === 'Psicóloga' && current) {
      const { data } = await supabase.from('profiles').select('id,full_name,email').eq('id', current.id).maybeSingle();
      setPsychologists(data ? [data as Psychologist] : []);
    } else if (current?.psychologist_id) {
      const { data } = await supabase.from('profiles').select('id,full_name,email').eq('id', current.psychologist_id).maybeSingle();
      setPsychologists(data ? [data as Psychologist] : []);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const role = roleName(profile);
  const needsPsychologist = role === 'Administrador' || role === 'Recepcionista';
  const psychologistOptions: PsychologistOption[] = psychologists.map(item => ({ id: item.id, label: item.full_name || item.email || 'Psicóloga' }));
  const psychologistMap = useMemo(() => new Map(psychologists.map(item => [item.id, item.full_name || item.email || 'Psicóloga'])), [psychologists]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter(patient => {
      const matchesStatus = status === 'Todos' || (patient.status || 'Activo') === status;
      const matchesPsychologist = psychologistFilter === 'Todos' || patient.psychologist_id === psychologistFilter;
      const haystack = [fullName(patient), patient.preferred_name, patient.email, patient.phone, psychologistMap.get(patient.psychologist_id || '')].filter(Boolean).join(' ').toLowerCase();
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
        return <article className="patient-card" key={patient.id}>
          <div className="patient-card-top"><div className="patient-avatar">{initials(patient)}</div><div className="patient-main"><h3>{displayName(patient)}</h3>{patient.preferred_name ? <small>{fullName(patient)}</small> : <small>{psychologistMap.get(patient.psychologist_id || '') || 'Psicóloga sin identificar'}</small>}</div><span className={`patient-status status-${(patient.status || 'Activo').toLowerCase().replaceAll(' ', '-')}`}>{patient.status || 'Activo'}</span></div>
          <div className="patient-meta"><span>{patientAge !== null ? `${patientAge} años` : 'Edad no registrada'}</span><span>{patient.phone || 'Sin teléfono'}</span><span>{patient.email || 'Sin correo'}</span></div>
          {patient.clinical_alert ? <div className="clinical-alert"><strong>Alerta</strong><span>{patient.clinical_alert}</span></div> : <div className="patient-empty-note">Sin alertas clínicas registradas</div>}
          <footer className="patient-card-actions"><button className="btn btn-secondary btn-small" onClick={() => setEditing(patient)}>Editar</button><Link className="btn btn-primary btn-small" href={`/patients/${patient.id}`}>Abrir expediente</Link></footer>
        </article>;
      })}</div> : <PatientTable rows={filtered.map(patient => ({ id: patient.id, name: displayName(patient), age: age(patient.birth_date), phone: patient.phone, email: patient.email, status: patient.status || 'Activo', psychologist: psychologistMap.get(patient.psychologist_id || ''), clinicalAlert: patient.clinical_alert }))} onEdit={id => setEditing(rows.find(patient => patient.id === id) || null)} />}
    </> : <div className="card empty-state"><div className="empty-icon">♡</div><h3>No hay pacientes para mostrar</h3><p className="muted">Registra el primero o cambia los filtros de búsqueda.</p><button className="btn btn-primary" onClick={() => setNewOpen(true)}>Registrar paciente</button></div>}

    <PatientFormModal open={newOpen || Boolean(editing)} saving={saving} psychologists={psychologistOptions} needsPsychologist={needsPsychologist} initialValues={editing ? valuesFromPatient(editing) : null} onClose={() => { setNewOpen(false); setEditing(null); }} onSubmit={save}/>
  </>;
}
