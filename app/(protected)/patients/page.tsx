'use client';

import { useEffect, useMemo, useState } from 'react';
import { PatientFormModal, PatientFormValues, PsychologistOption } from '@/components/patients/patient-form-modal';
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

function roleName(profile: CurrentProfile | null) { return Array.isArray(profile?.roles) ? profile?.roles[0]?.name : profile?.roles?.name; }
function fullName(patient: Patient) { return `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Sin nombre'; }
function initials(patient: Patient) { return fullName(patient).split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase(); }
function age(date?: string | null) { if (!date) return null; const birth=new Date(`${date}T00:00:00`); const now=new Date(); let value=now.getFullYear()-birth.getFullYear(); const m=now.getMonth()-birth.getMonth(); if(m<0||(m===0&&now.getDate()<birth.getDate())) value--; return value; }

export default function PatientsPage() {
  const [rows,setRows]=useState<Patient[]>([]);
  const [psychologists,setPsychologists]=useState<Psychologist[]>([]);
  const [profile,setProfile]=useState<CurrentProfile|null>(null);
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState('Todos');
  const [editing,setEditing]=useState<Patient|null>(null);
  const [newOpen,setNewOpen]=useState(false);
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState('');
  const [ok,setOk]=useState('');

  async function load(){
    setMsg('');
    const s=getSupabaseBrowser();
    const {data:{user}}=await s.auth.getUser();
    if(!user)return;
    const [patientsResult,profileResult]=await Promise.all([
      s.from('patients').select('id,first_name,last_name,preferred_name,email,phone,birth_date,psychologist_id,status,clinical_alert,created_at').order('created_at',{ascending:false}),
      s.from('profiles').select('id,psychologist_id,roles(name)').eq('id',user.id).maybeSingle(),
    ]);
    if(patientsResult.error)setMsg(patientsResult.error.message); else setRows((patientsResult.data||[]) as Patient[]);
    const current=profileResult.data as CurrentProfile|null; setProfile(current);
    const role=roleName(current);
    if(role==='Administrador'||role==='Recepcionista'){
      const {data}=await s.from('profiles').select('id,full_name,email,roles!inner(name)').eq('roles.name','Psicóloga').eq('active',true).order('full_name');
      setPsychologists((data||[]) as Psychologist[]);
    }
  }

  useEffect(()=>{void load();},[]);

  const role=roleName(profile);
  const needsPsychologist=role==='Administrador'||role==='Recepcionista';
  const psychologistOptions:PsychologistOption[]=psychologists.map(p=>({id:p.id,label:p.full_name||p.email||'Psicóloga'}));

  const filtered=useMemo(()=>{
    const term=query.trim().toLowerCase();
    return rows.filter(p=>{
      const matchesStatus=status==='Todos'||(p.status||'Activo')===status;
      const haystack=[fullName(p),p.preferred_name,p.email,p.phone].filter(Boolean).join(' ').toLowerCase();
      return matchesStatus&&(!term||haystack.includes(term));
    });
  },[rows,query,status]);

  function valuesFromPatient(patient:Patient):PatientFormValues{return{
    firstName:patient.first_name||'',lastName:patient.last_name||'',preferredName:patient.preferred_name||'',email:patient.email||'',phone:patient.phone||'',birthDate:patient.birth_date||'',psychologistId:patient.psychologist_id||'',status:patient.status||'Activo',clinicalAlert:patient.clinical_alert||'',
  };}

  async function save(values:PatientFormValues){
    setSaving(true);setMsg('');setOk('');
    try{
      const s=getSupabaseBrowser(); const {data:{user}}=await s.auth.getUser();
      const psychologistId=role==='Psicóloga'?profile?.id:role==='Asistente'?profile?.psychologist_id:values.psychologistId;
      if(!psychologistId)throw new Error('Selecciona la psicóloga responsable.');
      const payload={first_name:values.firstName,last_name:values.lastName,preferred_name:values.preferredName||null,email:values.email||null,phone:values.phone||null,birth_date:values.birthDate||null,psychologist_id:psychologistId,status:values.status,clinical_alert:values.clinicalAlert||null,updated_at:new Date().toISOString()};
      const result=editing?await s.from('patients').update(payload).eq('id',editing.id):await s.from('patients').insert({...payload,created_by:user?.id});
      if(result.error)throw result.error;
      setOk(editing?'Paciente actualizado correctamente.':'Paciente registrado correctamente.'); setEditing(null);setNewOpen(false); await load();
    }finally{setSaving(false);}
  }

  return <>
    <div className="page-head patients-head"><div><span className="eyebrow">Gestión clínica</span><h1>Pacientes</h1><p className="muted">Consulta rápida, contacto y alertas dentro de tu alcance autorizado.</p></div><button className="btn btn-primary" onClick={()=>{setEditing(null);setNewOpen(true);}}>+ Nuevo paciente</button></div>

    <section className="patient-summary-grid">
      <article className="card compact-stat"><span>Total visibles</span><strong>{rows.length}</strong></article>
      <article className="card compact-stat"><span>Activos</span><strong>{rows.filter(p=>(p.status||'Activo')==='Activo').length}</strong></article>
      <article className="card compact-stat"><span>Con alerta</span><strong>{rows.filter(p=>Boolean(p.clinical_alert)).length}</strong></article>
    </section>

    <div className="patient-toolbar card"><div className="search-box"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por nombre, correo o teléfono" /></div><select value={status} onChange={e=>setStatus(e.target.value)}><option>Todos</option><option>Activo</option><option>En pausa</option><option>Alta clínica</option></select></div>

    {msg?<div className="error">{msg}</div>:null}{ok?<div className="success">{ok}</div>:null}

    {filtered.length?<div className="patient-card-grid">{filtered.map(patient=>{
      const patientAge=age(patient.birth_date);
      return <article className="patient-card" key={patient.id}>
        <div className="patient-card-top"><div className="patient-avatar">{initials(patient)}</div><div className="patient-main"><h3>{patient.preferred_name||fullName(patient)}</h3>{patient.preferred_name?<small>{fullName(patient)}</small>:null}</div><span className={`patient-status status-${(patient.status||'Activo').toLowerCase().replace(' ','-')}`}>{patient.status||'Activo'}</span></div>
        <div className="patient-meta"><span>{patientAge!==null?`${patientAge} años`:'Edad no registrada'}</span><span>{patient.phone||'Sin teléfono'}</span><span>{patient.email||'Sin correo'}</span></div>
        {patient.clinical_alert?<div className="clinical-alert"><strong>Alerta</strong><span>{patient.clinical_alert}</span></div>:<div className="patient-empty-note">Sin alertas clínicas registradas</div>}
        <footer className="patient-card-actions"><button className="btn btn-secondary btn-small" onClick={()=>setEditing(patient)}>Editar</button><a className="btn btn-secondary btn-small" href={`/clinical-records?patient=${patient.id}`}>Ver expediente</a><a className="btn btn-primary btn-small" href={`/appointments?patient=${patient.id}`}>Agendar cita</a></footer>
      </article>;
    })}</div>:<div className="card empty-state"><div className="empty-icon">♡</div><h3>No hay pacientes para mostrar</h3><p className="muted">Registra el primero o cambia los filtros de búsqueda.</p><button className="btn btn-primary" onClick={()=>setNewOpen(true)}>Registrar paciente</button></div>}

    <PatientFormModal open={newOpen||Boolean(editing)} saving={saving} psychologists={psychologistOptions} needsPsychologist={needsPsychologist} initialValues={editing?valuesFromPatient(editing):null} onClose={()=>{setNewOpen(false);setEditing(null);}} onSubmit={save}/>
  </>;
}
