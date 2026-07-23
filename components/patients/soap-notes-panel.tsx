'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FilePenLine, Plus, Save, X } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type AppointmentOption = { id: string; starts_at?: string | null; status?: string | null };
type SoapNote = {
  id: string;
  patient_id: string;
  appointment_id?: string | null;
  session_date: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  status: 'Borrador' | 'Finalizada';
  created_by: string;
  created_at: string;
  updated_at: string;
};

type Props = { patientId: string; psychologistId?: string | null; appointments: AppointmentOption[] };

type FormState = {
  appointmentId: string;
  sessionDate: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

const emptyForm = (): FormState => ({
  appointmentId: '',
  sessionDate: new Date().toISOString().slice(0, 10),
  subjective: '',
  objective: '',
  assessment: '',
  plan: '',
});

export function SoapNotesPanel({ patientId, psychologistId, appointments }: Props) {
  const [notes, setNotes] = useState<SoapNote[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editing, setEditing] = useState<SoapNote | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');

  async function loadNotes() {
    setLoading(true);
    setError('');
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || '');
    const { data, error: queryError } = await supabase
      .from('soap_notes')
      .select('id,patient_id,appointment_id,session_date,subjective,objective,assessment,plan,status,created_by,created_at,updated_at')
      .eq('patient_id', patientId)
      .order('session_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (queryError) setError(queryError.message);
    else setNotes((data || []) as SoapNote[]);
    setLoading(false);
  }

  useEffect(() => { void loadNotes(); }, [patientId]);

  const canCreate = useMemo(() => Boolean(currentUserId && (!psychologistId || psychologistId === currentUserId)), [currentUserId, psychologistId]);

  function startNew() {
    setEditing(null);
    setForm(emptyForm());
    setMessage('');
    setError('');
    setOpen(true);
  }

  function startEdit(note: SoapNote) {
    if (note.status === 'Finalizada') return;
    setEditing(note);
    setForm({
      appointmentId: note.appointment_id || '',
      sessionDate: note.session_date,
      subjective: note.subjective,
      objective: note.objective,
      assessment: note.assessment,
      plan: note.plan,
    });
    setMessage('');
    setError('');
    setOpen(true);
  }

  async function save(event: FormEvent, finalStatus: 'Borrador' | 'Finalizada') {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const supabase = getSupabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('La sesión expiró. Inicia sesión nuevamente.');
      if (!form.subjective.trim() || !form.objective.trim() || !form.assessment.trim() || !form.plan.trim()) {
        throw new Error('Completa los cuatro apartados SOAP.');
      }
      const payload = {
        patient_id: patientId,
        appointment_id: form.appointmentId || null,
        session_date: form.sessionDate,
        subjective: form.subjective.trim(),
        objective: form.objective.trim(),
        assessment: form.assessment.trim(),
        plan: form.plan.trim(),
        status: finalStatus,
        updated_at: new Date().toISOString(),
      };
      const result = editing
        ? await supabase.from('soap_notes').update(payload).eq('id', editing.id)
        : await supabase.from('soap_notes').insert({ ...payload, created_by: user.id });
      if (result.error) throw result.error;
      setOpen(false);
      setEditing(null);
      setForm(emptyForm());
      setMessage(finalStatus === 'Finalizada' ? 'Nota finalizada correctamente.' : 'Borrador guardado correctamente.');
      await loadNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la nota.');
    } finally {
      setSaving(false);
    }
  }

  return <section className="card record-section soap-panel">
    <div className="section-heading">
      <div><span className="eyebrow">Seguimiento clínico</span><h2>Notas SOAP</h2><p className="muted">Registro estructurado por sesión.</p></div>
      {canCreate ? <button className="btn btn-primary" onClick={startNew}><Plus size={17}/> Nueva nota</button> : null}
    </div>

    {message ? <div className="success">{message}</div> : null}
    {error ? <div className="error">{error}</div> : null}

    {open ? <form className="soap-form" onSubmit={(event) => void save(event, 'Borrador')}>
      <div className="soap-form-head">
        <div><span className="eyebrow">{editing ? 'Editar borrador' : 'Nueva nota'}</span><h3>Registro SOAP</h3></div>
        <button type="button" className="modal-close" onClick={() => setOpen(false)} disabled={saving}><X size={20}/></button>
      </div>
      <div className="two">
        <label className="field">Fecha de sesión<input type="date" value={form.sessionDate} onChange={e=>setForm({...form,sessionDate:e.target.value})} required /></label>
        <label className="field">Cita relacionada<select value={form.appointmentId} onChange={e=>setForm({...form,appointmentId:e.target.value})}><option value="">Sin relación</option>{appointments.map(item=><option key={item.id} value={item.id}>{item.starts_at ? new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.starts_at)) : 'Cita sin fecha'} · {item.status || 'Programada'}</option>)}</select></label>
      </div>
      <div className="soap-grid">
        <label className="field"><span><strong>S</strong> Subjetivo</span><textarea rows={6} value={form.subjective} onChange={e=>setForm({...form,subjective:e.target.value})} placeholder="Lo que refiere el paciente: síntomas, emociones, preocupaciones y cambios percibidos." required /></label>
        <label className="field"><span><strong>O</strong> Objetivo</span><textarea rows={6} value={form.objective} onChange={e=>setForm({...form,objective:e.target.value})} placeholder="Observaciones clínicas, conducta, estado mental y datos verificables." required /></label>
        <label className="field"><span><strong>A</strong> Análisis</span><textarea rows={6} value={form.assessment} onChange={e=>setForm({...form,assessment:e.target.value})} placeholder="Interpretación clínica, evolución, hipótesis y valoración profesional." required /></label>
        <label className="field"><span><strong>P</strong> Plan</span><textarea rows={6} value={form.plan} onChange={e=>setForm({...form,plan:e.target.value})} placeholder="Objetivos, intervenciones, tareas, acuerdos y siguiente seguimiento." required /></label>
      </div>
      <footer className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={saving}>Cancelar</button>
        <button type="submit" className="btn btn-secondary" disabled={saving}><Save size={16}/> Guardar borrador</button>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={(event)=>void save(event as unknown as FormEvent, 'Finalizada')}><CheckCircle2 size={16}/> Finalizar nota</button>
      </footer>
    </form> : null}

    {loading ? <div className="empty-state">Cargando notas...</div> : notes.length ? <div className="soap-note-list">{notes.map(note => <article className="soap-note-card" key={note.id}>
      <header><div><span className="eyebrow">Sesión del {new Intl.DateTimeFormat('es-MX',{dateStyle:'long'}).format(new Date(`${note.session_date}T00:00:00`))}</span><h3>Nota SOAP</h3></div><span className={note.status === 'Finalizada' ? 'chip' : 'soft-chip'}>{note.status}</span></header>
      <div className="soap-summary-grid">
        <div><strong>S</strong><p>{note.subjective}</p></div><div><strong>O</strong><p>{note.objective}</p></div><div><strong>A</strong><p>{note.assessment}</p></div><div><strong>P</strong><p>{note.plan}</p></div>
      </div>
      <footer><small className="muted">Actualizada {new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short'}).format(new Date(note.updated_at))}</small>{note.status === 'Borrador' && note.created_by === currentUserId ? <button className="btn btn-secondary btn-small" onClick={()=>startEdit(note)}><FilePenLine size={15}/> Editar</button> : null}</footer>
    </article>)}</div> : <div className="empty-state"><h3>Aún no hay notas SOAP</h3><p className="muted">Crea la primera nota clínica de este paciente.</p>{canCreate ? <button className="btn btn-primary" onClick={startNew}>Crear primera nota</button> : null}</div>}
  </section>;
}
