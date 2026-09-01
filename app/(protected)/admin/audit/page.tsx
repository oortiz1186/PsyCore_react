'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type RoleRelation={name?:string|null}|{name?:string|null}[]|null;
type AuditRow={id:number;actor_id?:string|null;action:string;entity_type:string;entity_id?:string|null;patient_id?:number|null;metadata?:Record<string,unknown>|null;ip_address?:string|null;user_agent?:string|null;created_at:string;profiles?:{full_name?:string|null;email?:string|null}|{full_name?:string|null;email?:string|null}[]|null;patients?:{first_name?:string|null;last_name?:string|null}|{first_name?:string|null;last_name?:string|null}[]|null};
const one=<T,>(v:T|T[]|null|undefined)=>Array.isArray(v)?v[0]:v;
const actorName=(r:AuditRow)=>{const p=one(r.profiles);return p?.full_name||p?.email||'Sistema / portal';};
const patientName=(r:AuditRow)=>{const p=one(r.patients);return p?`${p.first_name||''} ${p.last_name||''}`.trim()||`Paciente #${r.patient_id}`:r.patient_id?`Paciente #${r.patient_id}`:'—';};

export default function AuditPage(){
 const [rows,setRows]=useState<AuditRow[]>([]);const [loading,setLoading]=useState(true);const [msg,setMsg]=useState('');const [allowed,setAllowed]=useState<boolean|null>(null);const [query,setQuery]=useState('');
 async function load(){setLoading(true);setMsg('');const s=getSupabaseBrowser();const {data:{user}}=await s.auth.getUser();if(!user){setAllowed(false);setLoading(false);return;}const {data:profile}=await s.from('profiles').select('roles(name)').eq('id',user.id).maybeSingle();const relation=(profile as unknown as {roles?:RoleRelation}|null)?.roles;const role=Array.isArray(relation)?relation[0]?.name:relation?.name;if(role!=='Administrador'){setAllowed(false);setLoading(false);return;}setAllowed(true);const result=await s.from('audit_events').select('id,actor_id,action,entity_type,entity_id,patient_id,metadata,ip_address,user_agent,created_at,profiles:actor_id(full_name,email),patients:patient_id(first_name,last_name)').order('created_at',{ascending:false}).limit(500);if(result.error)setMsg(result.error.message);else setRows((result.data||[]) as unknown as AuditRow[]);setLoading(false);}
 useEffect(()=>{void load();},[]);
 const filtered=useMemo(()=>{const q=query.trim().toLowerCase();if(!q)return rows;return rows.filter(r=>[r.action,r.entity_type,r.entity_id,actorName(r),patientName(r),r.ip_address].filter(Boolean).join(' ').toLowerCase().includes(q));},[rows,query]);
 if(allowed===false)return <div className="page-shell"><section className="card"><h1>Acceso restringido</h1><p className="muted">La bitácora de auditoría solo está disponible para administradores.</p></section></div>;
 return <div className="page-shell"><div className="page-head"><div><span className="eyebrow">Seguridad y gobierno</span><h1>Bitácora de auditoría</h1><p className="muted">Eventos sensibles del sistema ordenados del más reciente al más antiguo.</p></div><button className="btn btn-secondary" onClick={()=>void load()}><RefreshCw size={16}/> Actualizar</button></div>
 <section className="card"><div className="section-heading"><div><span className="eyebrow">Trazabilidad</span><h2>Últimos eventos</h2></div><label className="field" style={{minWidth:280}}><span>Buscar</span><div style={{position:'relative'}}><Search size={16} style={{position:'absolute',left:10,top:11}}/><input style={{paddingLeft:34}} value={query} onChange={e=>setQuery(e.target.value)} placeholder="acción, usuario, paciente..."/></div></label></div>
 {msg?<div className="error">{msg}</div>:null}{loading?<div className="empty-state compact-empty">Cargando auditoría...</div>:filtered.length?<div className="appointment-list">{filtered.map(r=><div className="appointment-item" key={r.id}><ShieldCheck size={18}/><div><strong>{r.action}</strong><small>{new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short'}).format(new Date(r.created_at))} · {actorName(r)} · {patientName(r)}</small><small>{r.entity_type}{r.entity_id?` #${r.entity_id}`:''}{r.ip_address?` · IP ${r.ip_address}`:''}</small></div></div>)}</div>:<div className="empty-state compact-empty">No hay eventos que coincidan.</div>}</section></div>;
}
