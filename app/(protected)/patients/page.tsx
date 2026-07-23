'use client';

import { FormEvent, useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type Patient = {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  birth_date?: string;
  psychologist_id?: string;
};

type Psychologist = { id: string; full_name?: string | null; email?: string | null };

type CurrentProfile = {
  id: string;
  psychologist_id?: string | null;
  roles?: { name?: string } | { name?: string }[] | null;
};

function getRole(profile: CurrentProfile | null) {
  return Array.isArray(profile?.roles) ? profile?.roles[0]?.name : profile?.roles?.name;
}

export default function Patients() {
  const [rows, setRows] = useState<Patient[]>([]);
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    birth_date: '',
    psychologist_id: '',
  });
  const [msg, setMsg] = useState('');

  async function load() {
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data, error }, profileResult] = await Promise.all([
      supabase.from('patients').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id,psychologist_id,roles(name)').eq('id', user.id).maybeSingle(),
    ]);

    if (error) setMsg(error.message);
    else setRows((data || []) as Patient[]);

    const currentProfile = profileResult.data as CurrentProfile | null;
    setProfile(currentProfile);
    const role = getRole(currentProfile);

    if (role === 'Administrador' || role === 'Recepcionista') {
      const { data: psychologistRows } = await supabase
        .from('profiles')
        .select('id,full_name,email,roles!inner(name)')
        .eq('roles.name', 'Psicóloga')
        .eq('active', true)
        .order('full_name');
      setPsychologists((psychologistRows || []) as Psychologist[]);
    }
  }

  useEffect(() => { void load(); }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setMsg('');
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    const role = getRole(profile);
    const psychologistId = role === 'Psicóloga'
      ? profile?.id
      : role === 'Asistente'
        ? profile?.psychologist_id
        : form.psychologist_id;

    if (!psychologistId) {
      setMsg('Selecciona la psicóloga responsable del paciente.');
      return;
    }

    const payload = {
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email || null,
      phone: form.phone || null,
      birth_date: form.birth_date || null,
      psychologist_id: psychologistId,
      created_by: user?.id,
    };

    const { error } = await supabase.from('patients').insert(payload);
    if (error) {
      setMsg(error.message);
      return;
    }

    setForm({ first_name: '', last_name: '', email: '', phone: '', birth_date: '', psychologist_id: '' });
    setShow(false);
    await load();
  }

  const role = getRole(profile);
  const needsPsychologist = role === 'Administrador' || role === 'Recepcionista';

  return (
    <>
      <div className="page-head">
        <div><h1>Pacientes</h1><p className="muted">Expedientes y datos generales dentro de tu alcance autorizado.</p></div>
        <button className="btn btn-primary" onClick={() => setShow(!show)}>{show ? 'Cancelar' : 'Nuevo paciente'}</button>
      </div>

      {show ? (
        <form className="card form" onSubmit={save}>
          <div className="two">
            <label className="field">Nombre<input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required /></label>
            <label className="field">Apellidos<input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required /></label>
          </div>
          <div className="two">
            <label className="field">Correo<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="field">Teléfono<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          </div>
          <label className="field">Fecha de nacimiento<input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} /></label>
          {needsPsychologist ? (
            <label className="field">
              Psicóloga responsable
              <select value={form.psychologist_id} onChange={(e) => setForm({ ...form, psychologist_id: e.target.value })} required>
                <option value="">Selecciona una psicóloga</option>
                {psychologists.map((item) => <option key={item.id} value={item.id}>{item.full_name || item.email}</option>)}
              </select>
            </label>
          ) : null}
          <button className="btn btn-primary">Guardar paciente</button>
        </form>
      ) : null}

      {msg ? <div className="error">{msg}</div> : null}
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Nacimiento</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}><td>{row.full_name || `${row.first_name || ''} ${row.last_name || ''}`}</td><td>{row.email || '—'}</td><td>{row.phone || '—'}</td><td>{row.birth_date || '—'}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}
