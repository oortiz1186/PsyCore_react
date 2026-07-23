'use client';
import { FormEvent,useEffect,useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type Role={id:number;name:string};
type User={id:string;full_name?:string;email?:string;role_id?:number;active?:boolean;roles?:Role|Role[]|null};

const ALLOWED_ROLES=['Administrador','Asistente','Psicóloga','Recepcionista'];

export default function UsersPage(){
  const [users,setUsers]=useState<User[]>([]);
  const [roles,setRoles]=useState<Role[]>([]);
  const [show,setShow]=useState(false);
  const [form,setForm]=useState({fullName:'',email:'',roleId:''});
  const [msg,setMsg]=useState('');
  const [ok,setOk]=useState('');

  async function load(){
    const s=getSupabaseBrowser();
    const [u,r]=await Promise.all([
      s.from('profiles').select('id,full_name,email,role_id,active,roles(id,name)').order('created_at',{ascending:false}),
      s.from('roles').select('id,name').in('name',ALLOWED_ROLES).order('name')
    ]);
    if(u.error)setMsg(u.error.message);else setUsers((u.data||[]) as User[]);
    if(r.error)setMsg(r.error.message);else setRoles((r.data||[]) as Role[]);
  }

  useEffect(()=>{void load()},[]);

  async function save(e:FormEvent){
    e.preventDefault();setMsg('');setOk('');
    const s=getSupabaseBrowser();
    const {data:{session}}=await s.auth.getSession();
    const res=await fetch('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token||''}`},body:JSON.stringify({email:form.email,fullName:form.fullName,roleId:Number(form.roleId)})});
    const data=await res.json();
    if(!res.ok){setMsg(data.error||'No se pudo crear el usuario.');return;}
    setOk(data.passwordSent?'Usuario creado y correo enviado.':'Usuario creado. Configura SMTP para enviar el acceso.');
    setShow(false);setForm({fullName:'',email:'',roleId:''});await load();
  }

  async function toggle(user:User){
    const next=user.active===false;
    const {error}=await getSupabaseBrowser().from('profiles').update({active:next}).eq('id',user.id);
    if(error)setMsg(error.message);else await load();
  }

  return <>
    <div className="page-head"><div><h1>Administración de usuarios</h1><p className="muted">Crea accesos directos y asigna roles.</p></div><button className="btn btn-primary" onClick={()=>setShow(!show)}>{show?'Cancelar':'Nuevo usuario'}</button></div>
    {show&&<form className="card form" onSubmit={save}><div className="two"><label className="field">Nombre completo<input value={form.fullName} onChange={e=>setForm({...form,fullName:e.target.value})} required/></label><label className="field">Correo<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/></label></div><label className="field">Rol<select value={form.roleId} onChange={e=>setForm({...form,roleId:e.target.value})} required><option value="">Selecciona</option>{roles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><button className="btn btn-primary">Crear y enviar acceso</button></form>}
    {msg&&<div className="error">{msg}</div>}{ok&&<div className="success">{ok}</div>}
    <div className="card table-wrap"><table className="table"><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{users.map(u=>{const role=Array.isArray(u.roles)?u.roles[0]?.name:u.roles?.name;return <tr key={u.id}><td>{u.full_name||'Sin nombre'}</td><td>{u.email||'—'}</td><td>{role||'Sin rol'}</td><td><span className="chip">{u.active===false?'Inactivo':'Activo'}</span></td><td><button className={`btn ${u.active===false?'btn-secondary':'btn-danger'}`} onClick={()=>toggle(u)}>{u.active===false?'Activar':'Desactivar'}</button></td></tr>})}</tbody></table></div>
  </>;
}
