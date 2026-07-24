'use client';

import { FormEvent, useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type Patient = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  psychologist_id?: string | null;
};

type Note = {
  id: string;
  patient_id: string;
  note_date?: string | null;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  patients?: Patient | Patient[] | null;
};

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function patientName(patient?: Patient | Patient[] | null) {
  const value = one(patient);
  if (!value) return 'Paciente sin nombre';
  return `${value.first_name || ''} ${value.last_name || ''}`.trim() || 'Paciente sin nombre';
}

export default function ClinicalRecords() {
  const [rows, setRows] = useState<Note[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ patient_id: '', subjective: '', objective: '', assessment: '', plan: '' });
  const [msg, setMsg] = useState('');

  async function load() {
    setMsg('');
    const s = getSupabaseBrowser();
    const [notesResult, patientsResult] = await Promise.all([
      s.from('clinical_notes')
        .select('id,patient_id,note_date,subjective,objective,assessment,plan,created_at,patients(id,first_name,last_name,psychologist_id)')
        .order('created_at', { ascending: false }),
      s.from('patients')
        .select('id,first_name,last_name,psychologist_id')
        .order('created_at', { ascending: false }),
    ]);

    if (notesResult.error) setMsg(notesResult.error.message);
    else setRows((notesResult.data || []) as Note[]);

    if (patientsResult.error) setMsg(patientsResult.error.message);
    else setPatients((patientsResult.data || []) as Patient[]);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setMsg('');

    const s = getSupabaseBrowser();
    const { data: { user } } = await s.auth.getUser();
    const patient = patients.find(item => item.id === form.patient_id);

    if (!patient?.psychologist_id) {
      setMsg('El paciente no tiene una psicóloga responsable asignada.');
      return;
    }

    const { error } = await s.from('clinical_notes').insert({
      ...form,
      psychologist_id: patient.psychologist_id,
      created_by: user?.id,
      note_date: new Date().toISOString(),
    });

    if (error) {
      setMsg(error.message);
      return;
    }

    setShow(false);
    setForm({ patient_id: '', subjective: '', objective: '', assessment: '', plan: '' });
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
        <select value={form.patient_id} onChange={event => setForm({ ...form, patient_id: event.target.value })} required>
          <option value="">Selecciona</option>
          {patients.map(patient => <option key={patient.id} value={patient.id}>{patientName(patient)}</option>)}
        </select>
      </label>

      {(['subjective', 'objective', 'assessment', 'plan'] as const).map(key => <label className="field" key={key}>
        {({ subjective: 'Subjetivo', objective: 'Objetivo', assessment: 'Evaluación', plan: 'Plan' })[key]}
        <textarea value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })} />
      </label>)}

      <button className="btn btn-primary">Guardar nota clínica</button>
    </form>}

    {msg && <div className="error">{msg}</div>}

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
