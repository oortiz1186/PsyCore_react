'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type Appointment={id:string;starts_at?:string|null;status?:string|null;patients?:{first_name?:string|null;last_name?:string|null;full_name?:string|null}|null};

export default function Dashboard(){
  const [stats,setStats]=useState({patients:0,today:0,upcoming:0,notes:0});
  const [nextAppointments,setNextAppointments]=useState<Appointment[]>([]);
  const [name,setName]=useState('');

  useEffect(()=>{void (async()=>{
    const s=getSupabaseBrowser();
    const {data:{user}}=await s.auth.getUser();
    const todayStart=new Date();todayStart.setHours(0,0,0,0);
    const todayEnd=new Date();todayEnd.setHours(23,59,59,999);
    const [profile,p,t,u,n,next]=await Promise.all([
      user?s.from('profiles').select('full_name').eq('id',user.id).maybeSingle():Promise.resolve({data:null}),
      s.from('patients').select('*',{count:'exact',head:true}),
      s.from('appointments').select('*',{count:'exact',head:true}).gte('starts_at',todayStart.toISOString()).lte('starts_at',todayEnd.toISOString()),
      s.from('appointments').select('*',{count:'exact',head:true}).gte('starts_at',new Date().toISOString()),
      s.from('clinical_notes').select('*',{count:'exact',head:true}),
      s.from('appointments').select('id,starts_at,status,patients(first_name,last_name,full_name)').gte('starts_at',new Date().toISOString()).order('starts_at').limit(5)
    ]);
    setName(profile.data?.full_name?.split(' ')[0]||'');
    setStats({patients:p.count||0,today:t.count||0,upcoming:u.count||0,notes:n.count||0});
    setNextAppointments((next.data||[]) as Appointment[]);
  })();},[]);

  function patientName(a:Appointment){return a.patients?.full_name||`${a.patients?.first_name||''} ${a.patients?.last_name||''}`.trim()||'Paciente';}
  function formatDate(value?:string|null){if(!value)return 'Sin fecha';return new Intl.DateTimeFormat('es-MX',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value));}

  return <>
    <section className="dashboard-hero">
      <div><span className="eyebrow">Panel clínico</span><h1>{name?`Hola, ${name}`:'Bienvenida a PsyCore'}</h1><p>Consulta tu actividad, próximas sesiones y accesos rápidos desde un solo lugar.</p></div>
      <div className="hero-actions"><Link className="btn btn-primary" href="/appointments">Nueva cita</Link><Link className="btn btn-secondary" href="/patients">Registrar paciente</Link></div>
    </section>

    <section className="dashboard-stats">
      {[['Pacientes activos',stats.patients,'♡'],['Citas de hoy',stats.today,'◷'],['Próximas citas',stats.upcoming,'↗'],['Notas clínicas',stats.notes,'▤']].map(([label,value,icon])=><article className="metric-card" key={label}><span className="metric-icon">{icon}</span><div><small>{label}</small><strong>{value}</strong></div></article>)}
    </section>

    <section className="dashboard-columns">
      <article className="card section-card">
        <div className="section-heading"><div><span className="eyebrow">Agenda</span><h2>Próximas sesiones</h2></div><Link href="/appointments" className="text-link">Ver agenda</Link></div>
        <div className="appointment-list">{nextAppointments.length?nextAppointments.map(a=><div className="appointment-item" key={a.id}><span className="appointment-dot"/><div><strong>{patientName(a)}</strong><small>{formatDate(a.starts_at)}</small></div><span className="soft-chip">{a.status||'Programada'}</span></div>):<div className="empty-state">No hay citas próximas. Tu agenda está libre.</div>}</div>
      </article>

      <article className="card section-card calm-card">
        <span className="eyebrow">Organización</span><h2>Prepara tu espacio clínico</h2><p className="muted">Configura consultorios, atención en línea y horarios habituales de cada psicóloga.</p><Link href="/settings/practice" className="btn btn-secondary">Configurar consultorios</Link>
      </article>
    </section>
  </>;
}
