'use client';
import { FormEvent,useEffect,useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

const initialForm={host:'',port:'587',secure:false,username:'',password:'',fromEmail:'',fromName:'PsyCore',appUrl:'http://localhost:3000'};

export default function SmtpSettings(){
  const [form,setForm]=useState(initialForm);
  const [testEmail,setTestEmail]=useState('');
  const [msg,setMsg]=useState('');
  const [ok,setOk]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [passwordConfigured,setPasswordConfigured]=useState(false);

  async function authHeaders(){
    const {data:{session}}=await getSupabaseBrowser().auth.getSession();
    return {'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token||''}`};
  }

  useEffect(()=>{void load()},[]);

  async function load(){
    setLoading(true);
    const res=await fetch('/api/smtp/settings',{headers:await authHeaders()});
    const data=await res.json();
    if(!res.ok){setMsg(data.error||'No se pudo cargar la configuración.');setLoading(false);return;}
    if(data.settings){
      setForm({host:data.settings.host,port:String(data.settings.port),secure:data.settings.secure,username:data.settings.username,password:'',fromEmail:data.settings.fromEmail,fromName:data.settings.fromName,appUrl:data.settings.appUrl});
      setPasswordConfigured(Boolean(data.settings.passwordConfigured));
    }
    setLoading(false);
  }

  async function save(e:FormEvent){
    e.preventDefault();setMsg('');setOk(false);setSaving(true);
    const res=await fetch('/api/smtp/settings',{method:'PUT',headers:await authHeaders(),body:JSON.stringify({...form,port:Number(form.port)})});
    const data=await res.json();setSaving(false);
    if(!res.ok){setMsg(data.error||'No se pudo guardar.');return;}
    setOk(true);setMsg('Configuración SMTP guardada correctamente.');setPasswordConfigured(true);setForm({...form,password:''});
  }

  async function test(e:FormEvent){
    e.preventDefault();setMsg('');setOk(false);
    const res=await fetch('/api/smtp/test',{method:'POST',headers:await authHeaders(),body:JSON.stringify({to:testEmail})});
    const data=await res.json();
    if(!res.ok){setMsg(data.error||'No se pudo enviar la prueba.');return;}
    setOk(true);setMsg('Correo de prueba enviado correctamente.');
  }

  if(loading)return <div className="card">Cargando configuración SMTP...</div>;

  return <>
    <div className="page-head"><div><h1>Configuración SMTP</h1><p className="muted">Los datos se guardan en Supabase. La contraseña queda cifrada antes de almacenarse.</p></div></div>
    <form className="card form" onSubmit={save}>
      <div className="two">
        <label className="field">Servidor SMTP<input value={form.host} onChange={e=>setForm({...form,host:e.target.value})} placeholder="smtp.gmail.com" required/></label>
        <label className="field">Puerto<input type="number" value={form.port} onChange={e=>setForm({...form,port:e.target.value})} required/></label>
      </div>
      <label className="field">Usuario SMTP<input value={form.username} onChange={e=>setForm({...form,username:e.target.value})} required/></label>
      <label className="field">Contraseña SMTP<input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder={passwordConfigured?'Déjala vacía para conservar la actual':''} required={!passwordConfigured}/></label>
      <div className="two">
        <label className="field">Correo remitente<input type="email" value={form.fromEmail} onChange={e=>setForm({...form,fromEmail:e.target.value})} required/></label>
        <label className="field">Nombre remitente<input value={form.fromName} onChange={e=>setForm({...form,fromName:e.target.value})} required/></label>
      </div>
      <label className="field">URL de PsyCore<input value={form.appUrl} onChange={e=>setForm({...form,appUrl:e.target.value})} required/></label>
      <label><input type="checkbox" checked={form.secure} onChange={e=>setForm({...form,secure:e.target.checked})}/> Usar conexión segura directa SSL/TLS</label>
      <button className="btn btn-primary" disabled={saving}>{saving?'Guardando...':'Guardar configuración'}</button>
    </form>

    <form className="card form" onSubmit={test}>
      <h2>Probar configuración</h2>
      <label className="field">Correo para prueba<input type="email" value={testEmail} onChange={e=>setTestEmail(e.target.value)} required/></label>
      <button className="btn btn-secondary">Enviar prueba</button>
    </form>
    {msg&&<div className={ok?'success':'error'}>{msg}</div>}
  </>;
}
