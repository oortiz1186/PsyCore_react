'use client';

import { FormEvent, useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type Patient = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  psychologist_id?: string | null;
};

type Appointment = {
  id: string;
  patient_id: string;
  starts_at?: string | null;
  appointment_date?: string | null;
  status?: string | null;
  notes?: string | null;
  patients?: Patient | Patient[] | null;
};

function patientName(patient?: Patient | Patient[] | null) {
  const current = Array.isArray(patient) ? patient[0] : patient;
  if (!current) return 'Paciente sin nombre';
  return `${current.first_name || ''} ${current.last_name || ''}`.trim() || 'Paciente sin nombre';
}

export default function Appointments() {
  const [rows, setRows] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    patient_id: '',
    starts_at: '',
    status: 'Programada',
    notes: '',
  });
  const [msg, setMsg] = useState('');

  async function load() {
    const supabase = getSupabaseBrowser();
    setMsg('');

    const [appointmentsResult, patientsResult] = await Promise.all([
      supabase
        .from('appointments')
        .select(
          'id,patient_id,starts_at,appointment_date,status,notes,patients(id,first_name,last_name,psychologist_id)'
        )
        .order('created_at', { ascending: false }),
      supabase
        .from('patients')
        .select('id,first_name,last_name,psychologist_id')
        .order('created_at', { ascending: false }),
    ]);

    if (appointmentsResult.error) {
      setMsg(appointmentsResult.error.message);
    } else {
      setRows((appointmentsResult.data || []) as Appointment[]);
    }

    if (patientsResult.error) {
      setMsg(patientsResult.error.message);
    } else {
      setPatients((patientsResult.data || []) as Patient[]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setMsg('');

    const supabase = getSupabaseBrowser();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const patient = patients.find((item) => item.id === form.patient_id);
    if (!patient?.psychologist_id) {
      setMsg('El paciente no tiene una psicóloga responsable asignada.');
      return;
    }

    const { error } = await supabase.from('appointments').insert({
      patient_id: form.patient_id,
      psychologist_id: patient.psychologist_id,
      starts_at: form.starts_at,
      status: form.status,
      notes: form.notes.trim() || null,
      created_by: user?.id,
    });

    if (error) {
      setMsg(error.message);
      return;
    }

    setShow(false);
    setForm({ patient_id: '', starts_at: '', status: 'Programada', notes: '' });
    await load();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Agenda</h1>
          <p className="muted">Citas visibles según la psicóloga responsable.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => setShow(!show)}>
          {show ? 'Cancelar' : 'Nueva cita'}
        </button>
      </div>

      {show ? (
        <form className="card form" onSubmit={save}>
          <label className="field">
            Paciente
            <select
              value={form.patient_id}
              onChange={(event) => setForm({ ...form, patient_id: event.target.value })}
              required
            >
              <option value="">Selecciona</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patientName(patient)}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Fecha y hora
            <input
              type="datetime-local"
              value={form.starts_at}
              onChange={(event) => setForm({ ...form, starts_at: event.target.value })}
              required
            />
          </label>

          <label className="field">
            Estado
            <select
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
            >
              <option>Programada</option>
              <option>Confirmada</option>
              <option>Completada</option>
              <option>Cancelada</option>
            </select>
          </label>

          <label className="field">
            Notas
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </label>

          <button className="btn btn-primary">Guardar cita</button>
        </form>
      ) : null}

      {msg ? <div className="error">{msg}</div> : null}

      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Notas</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((appointment) => (
              <tr key={appointment.id}>
                <td>{patientName(appointment.patients)}</td>
                <td>{appointment.starts_at || appointment.appointment_date || '—'}</td>
                <td>
                  <span className="chip">{appointment.status || 'Programada'}</span>
                </td>
                <td>{appointment.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
