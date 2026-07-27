'use client';

import { FormEvent, useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type Patient = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  psychologist_id?: string | null;
};

type Psychologist = {
  id: string;
  full_name?: string | null;
  email?: string | null;
};

type Note = {
  id: string;
  patient_id: string;
  psychologist_id?: string | null;
  note_date?: string | null;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  patients?: Patient | Patient[] | null;
};

const emptyForm = {
  patient_id: '',
  psychologist_id: '',
  subjective: '',
  objective: '',
  assessment: '',
  plan: '',
};

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function patientName(patient?: Patient | Patient[] | null) {
  const value = one(patient);
  if (!value) return 'Paciente sin nombre';
  return `${value.first_name || ''} ${value.last_name || ''}`.trim() || 'Paciente sin nombre';
}

function psychologistName(psychologist: Psychologist) {
  return psychologist.full_name || psychologist.email || 'Psicóloga';
}

export default function ClinicalRecords() {
  const [rows, setRows] = useState<Note[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');

  async function load() {
    setMsg('');
    const s = getSupabaseBrowser();
    const [notesResult, patientsResult, psychologistsResult] = await Promise.all([
      s.from('clinical_notes')
        .select('id,patient_id,psychologist_id,note_date,subjective,objective,assessment,plan,created_at,patients(id,first_name,last_name,psychologist_id)')
        .order('created_at', { ascending: false }),
      s.from('patients')
        .select('id,first_name,last_name,psychologist_id')
        .order('created_at', { ascending: false }),
      s.from('profiles')
        .select('id,full_name,email,roles!inner(name)')
        .eq('active', true)
        .eq('roles.name', 'Psicóloga')
        .order('full_name'),
    ]);

    if (notesResult.error) setMsg(notesResult.error.message);
    else setRows((notesResult.data || []) as Note[]);

    if (patientsResult.error) setMsg(patientsResult.error.message);
    else setPatients((patientsResult.data || []) as Patient[]);

    if (psychologistsResult.error) setMsg(psychologistsResult.error.message);
    else setPsychologists((psychologistsResult.data || []) as Psychologist[]);
  }

  useEffect(() => {
    void load();
  }, []);

  function selectPatient(patientId: string) {
    const patient = patients.find(item => item.id === patientId);
    setForm(current => ({
      ...current,
      patient_id: patientId,
      psychologist_id: patient?.psychologist_id || current.psychologist_id || '',
    }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setMsg('');
    setOk('');

    if (!form.psychologist_id) {
      setMsg('Selecciona la psicóloga responsable de la nota clínica.');
      return;
    }

    const s = getSupabaseBrowser();
    const { data: { user } } = await s.auth.getUser();
    const { error } = await s.from('clinical_notes').insert({
      patient_id: form.patient_id,
      psychologist_id: form.psychologist_id,
      subjective: form.subjective,
      objective: form.objective,
      assessment: form.assessment,
      plan: form.plan,
      created_by: user?.id,
      note_date: new Date().toISOString(),
    });

    if (error) {
      setMsg(error.message);
      return;
    }

    setShow(false);
    setForm(emptyForm);
    setOk('Nota clínica guardada correctamente.');
    await load();
  }

  return <>
    <div className="page-head">
      <div>
        <h1>Expedientes</h1>
        <p className="muted">Notas clínicas protegidas por psicóloga responsable.</p>
      </div>
      <button className="btn btn-primary" onClick={() => setShow(!show)}>{show ? 'Cancelar' : 'Nueva nota'}</button>
    </div>

    {show && <form className="card form" onSubmit={save}>
      <label className="field">Paciente
        <select value={form.patient_id} onChange={event => selectPatient(event.target.value)} required>
          <option value="">Selecciona</option>
          {patients.map(patient => <option key={patient.id} value={patient.id}>{patientName(patient)}</option>)}
        </select>
      </label>

      <label className="field">Psicóloga responsable
        <select value={form.psychologist_id} onChange={event => setForm({ ...form, psychologist_id: event.target.value })} required>
          <option value="">Selecciona</option>
          {psychologists.map(psychologist => <option key={psychologist.id} value={psychologist.id}>{psychologistName(psychologist)}</option>)}
        </select>
      </label>

      {(['subjective', 'objective', 'assessment', 'plan'] as const).map(key => <label className="field" key={key}>
        {({ subjective: 'Subjetivo', objective: 'Objetivo', assessment: 'Evaluación', plan: 'Plan' })[key]}
        <textarea value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })} />
      </label>)}

      <button className="btn btn-primary">Guardar nota clínica</button>
    </form>}

    {msg && <div className="error">{msg}</div>}
    {ok && <div className="success">{ok}</div>}

    <div className="card table-wrap">
      <table className="table">
        <thead><tr><th>Paciente</th><th>Fecha</th><th>Evaluación</th><th>Plan</th></tr></thead>
        <tbody>
          {rows.length ? rows.map(row => <tr key={row.id}>
            <td>{patientName(row.patients)}</td>
            <td>{row.note_date ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(row.note_date)) : '—'}</td>
            <td>{row.assessment || '—'}</td>
            <td>{row.plan || '—'}</td>
          </tr>) : <tr><td colSpan={4}><div className="empty-state">Aún no hay notas clínicas registradas.</div></td></tr>}
        </tbody>
      </table>
    </div>
  </>;
}
