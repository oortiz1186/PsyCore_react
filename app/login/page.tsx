'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

export default function LoginPage(){
  const router=useRouter(); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [loading,setLoading]=useState(false);
  async function submit(e:FormEvent){e.preventDefault();setLoading(true);setError('');const supabase=getSupabaseBrowser();const {data,error}=await supabase.auth.signInWithPassword({email:email.trim().toLowerCase(),password});if(error){setError(error.message);setLoading(false);return;}const {data:profile}=await supabase.from('profiles').select('active,must_change_password').eq('id',data.user.id).maybeSingle();if(profile?.active===false){await supabase.auth.signOut();setError('Tu acceso está desactivado.');setLoading(false);return;}router.replace(profile?.must_change_password?'/change-password':'/dashboard');}
  return <main className="auth"><section className="auth-card"><div className="brand"><div className="brand-mark">Ψ</div><div><h1>PsyCore</h1><p className="muted">Gestión psicológica</p></div></div><form className="form" onSubmit={submit}><label className="field">Correo<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label className="field">Contraseña<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{error&&<div className="error">{error}</div>}<button className="btn btn-primary" disabled={loading}>{loading?'Entrando...':'Entrar'}</button></form></section></main>;
}
