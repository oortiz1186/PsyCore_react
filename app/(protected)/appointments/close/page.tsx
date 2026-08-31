'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3 } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type Patient={first_name?:string|null;last_name?:string|null};
type Appointment={id:number;starts_at?:string|null;status?:string|null;consultation_mode?:string|null;patients?:Patient|Patient[]|null};
const one=<T,>(value:T|T[]|null|undefined)=>Array.isArray(value)?value[0]:value;
const name=(value:Appointment['patients'])=>{const p=one(value);return p?`${p.first_name||''} ${p.last_name||''}`.trim()||'Paciente':'Paciente';};

export default function CloseAppointmentsPage(){
 const [rows,setRows]=useState<Appointment[]>([]);const [message,setMessage]=useState('');const [loading,setLoading]=useState(true);
 async function load(){setLoading(true);setMessage('');const s=getSupabaseBrowser();const {data:{user}}=await s.auth.getUser();if(!user){setMessage('Sesión no válida.');setLoading(false);return;}const {data,error}=await s.from('appointments').select('id,starts_at,status,consultation_mode,patients(first_name,last_name)').eq('psychologist_id',user.id).in('status',['Programada','Confirmada']).lte('starts_at',new Date().toISOString()).order('starts_at',{ascending:false}).limit(100);if(error)setMessage(error.message);else setRows((data||[]) as unknown as Appointment[]);setLoading(false);}
 useEffect(()=>{void load();},[]);
 const pending=useMemo(()=>rows.filter(x=>x.starts_at&&new Date(x.starts_at).getTime()<=Date.now()),[rows]);
 return <div className="page-shell"><div className="record-breadcrumb"><Link href="/appointments">Agenda</Link><span>/</span><strong>Cierre de consultas</strong></div><div className="page-head"><div><span className="eyebrow">Flujo clínico y financiero</span><h1>Consultas por cerrar</h1><p className="muted">Completa la atención y genera el cargo correspondiente sin duplicarlo.</p></div></div>{message?<div className="clinical-alert" style={{marginBottom:18}}><span>{message}</span></div>:null}<section className="card"><div className="section-heading"><div><span className="eyebrow">Pendientes</span><h2>{pending.length} consultas</h2></div></div>{loading?<div className="empty-state compact-empty">Cargando...</div>:pending.length?<div className="appointment-list">{pending.map(item=><div className="appointment-item" key={item.id}><Clock3 size={18}/><div><strong>{name(item.patients)}</strong><small>{item.starts_at?new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.starts_at)):'Sin fecha'} · {item.consultation_mode||'Consulta'} · {item.status}</small></div><Link className="btn btn-primary btn-small" href={`/appointments/${item.id}/complete`}><CheckCircle2 size={15}/> Cerrar consulta</Link></div>)}</div>:<div className="empty-state compact-empty">No hay consultas pendientes de cierre.</div>}</section></div>;
}
