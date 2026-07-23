'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Plus, Trash2, X } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type Appointment = { id: string; starts_at?: string | null; status?: string | null };
type Instrument = 'PHQ-9' | 'GAD-7' | 'Evaluación libre';
type Evaluation = {
  id: string;
  appointment_id?: number | null;
  instrument: Instrument;
  custom_instrument_name?: string | null;
  evaluation_date: string;
  answers?: Record<string, number> | null;
  total_score?: number | null;
  severity?: string | null;
  interpretation?: string | null;
  observations?: string | null;
  created_by: string;
  created_at: string;
};

type Props = {
  patientId: string;
  psychologistId?: string | null;
  appointments: Appointment[];
};

const phq9 = [
  'Poco interés o placer en hacer cosas',
  'Sentirse decaído, deprimido o sin esperanza',
  'Dificultad para dormir, permanecer dormido o dormir demasiado',
  'Sentirse cansado o con poca energía',
  'Poco apetito o comer en exceso',
  'Sentirse mal consigo mismo o pensar que ha fallado',
  'Dificultad para concentrarse',
  'Moverse o hablar muy lento, o estar demasiado inquieto',
  'Pensamientos de que estaría mejor muerto o de hacerse daño',
];

const gad7 = [
  'Sentirse nervioso, ansioso o al límite',
  'No poder detener o controlar la preocupación',
  'Preocuparse demasiado por diferentes cosas',
  'Dificultad para relajarse',
  'Estar tan inquieto que es difícil permanecer sentado',
  'Molestarse o irritarse fácilmente',
  'Sentir miedo como si algo terrible pudiera pasar',
];

const frequencyOptions = [
  { value: 0, label: 'Nunca' },
  { value: 1, label: 'Varios días' },
  { value: 2, label: 'Más de la mitad de los días' },
  { value: 3, label: 'Casi todos los días' },
];

function severityFor(instrument: Instrument, score: number) {
  if (instrument === 'PHQ-9') {
    if (score <= 4) return 'Mínima';
    if (score <= 9) return 'Leve';
    if (score <= 14) return 'Moderada';
    if (score <= 19) return 'Moderadamente grave';
    return 'Grave';
  }
  if (instrument === 'GAD-7') {
    if (score <= 4) return 'Mínima';
    if (score <= 9) return 'Leve';
    if (score <= 14) return 'Moderada';
    return 'Grave';
  }
  return '';
}

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`));
}

export function PatientEvaluationsPanel({ patientId, psychologistId, appointments }: Props) {
  const [rows, setRows] = useState<Evaluation[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [instrument, setInstrument] = useState<Instrument>('PHQ-9');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [appointmentId, setAppointmentId] = useState('');
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [customName, setCustomName] = useState('');
  const [manualScore, setManualScore] = useState('');
  const [manualSeverity, setManualSeverity] = useState('');
  const [interpretation, setInterpretation] = useState('');
  const [observations, setObservations] = useState('');

  async function load() {
    const supabase = getSupabaseBrowser();
    setLoading(true);
    setError('');
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || '');
    const result = await supabase
      .from('patient_evaluations')
      .select('id,appointment_id,instrument,custom_instrument_name,evaluation_date,answers,total_score,severity,interpretation,observations,created_by,created_at')
      .eq('patient_id', Number(patientId))
      .order('evaluation_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (result.error) setError(result.error.message);
    else setRows((result.data || []) as Evaluation[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [patientId]);

  const questions = instrument === 'PHQ-9' ? phq9 : instrument === 'GAD-7' ? gad7 : [];
  const total = useMemo(() => questions.reduce((sum, _, index) => sum + (answers[String(index)] ?? 0), 0), [answers, questions]);
  const severity = instrument === 'Evaluación libre' ? manualSeverity : severityFor(instrument, total);
  const canCreate = Boolean(currentUserId && psychologistId === currentUserId);

  function reset() {
    setInstrument('PHQ-9');
    setDate(new Date().toISOString().slice(0, 10));
    setAppointmentId('');
    setAnswers({});
    setCustomName('');
    setManualScore('');
    setManualSeverity('');
    setInterpretation('');
    setObservations('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!canCreate) return setError('Solo la psicóloga asignada puede registrar evaluaciones.');
    if (instrument !== 'Evaluación libre' && questions.some((_, index) => answers[String(index)] === undefined)) {
      return setError('Responde todos los reactivos antes de guardar.');
    }
    if (instrument === 'Evaluación libre' && !customName.trim()) return setError('Captura el nombre del instrumento.');

    setSaving(true);
    try {
      const supabase = getSupabaseBrowser();
      const score = instrument === 'Evaluación libre' ? (manualScore === '' ? null : Number(manualScore)) : total;
      const result = await supabase.from('patient_evaluations').insert({
        patient_id: Number(patientId),
        appointment_id: appointmentId ? Number(appointmentId) : null,
        instrument,
        custom_instrument_name: instrument === 'Evaluación libre' ? customName.trim() : null,
        evaluation_date: date,
        answers: instrument === 'Evaluación libre' ? {} : answers,
        total_score: score,
        severity: severity || null,
        interpretation: interpretation.trim() || null,
        observations: observations.trim() || null,
        created_by: currentUserId,
      });
      if (result.error) throw result.error;
      reset();
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la evaluación.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: Evaluation) {
    if (row.created_by !== currentUserId) return;
    if (!window.confirm('¿Eliminar esta evaluación? Esta acción no se puede deshacer.')) return;
    const supabase = getSupabaseBrowser();
    const result = await supabase.from('patient_evaluations').delete().eq('id', row.id);
    if (result.error) setError(result.error.message); else await load();
  }

  return <section className="evaluation-panel">
    <div className="card evaluation-header">
      <div><span className="eyebrow">Seguimiento clínico</span><h2>Evaluaciones psicológicas</h2><p className="muted">Aplica instrumentos, registra resultados y consulta la evolución del paciente.</p></div>
      {canCreate ? <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={17}/> Nueva evaluación</button> : null}
    </div>

    {error ? <div className="error">{error}</div> : null}
    {loading ? <div className="card empty-state">Cargando evaluaciones...</div> : null}

    {!loading && rows.length === 0 ? <div className="card empty-state"><ClipboardCheck size={34}/><h3>Sin evaluaciones registradas</h3><p className="muted">Aplica PHQ-9, GAD-7 o registra un instrumento libre.</p></div> : null}

    {!loading && rows.length > 0 ? <div className="evaluation-list">{rows.map(row => {
      const title = row.instrument === 'Evaluación libre' ? row.custom_instrument_name || 'Evaluación libre' : row.instrument;
      return <article className="card evaluation-card" key={row.id}>
        <div className="evaluation-card-head"><div><span className="eyebrow">{formatDate(row.evaluation_date)}</span><h3>{title}</h3></div><div className="evaluation-score"><strong>{row.total_score ?? '—'}</strong><small>Puntaje</small></div></div>
        <div className="evaluation-meta"><span className="soft-chip">{row.severity || 'Sin clasificación'}</span>{row.appointment_id ? <span>Cita #{row.appointment_id}</span> : <span>Sin cita asociada</span>}</div>
        {row.interpretation ? <div className="evaluation-copy"><small>Interpretación</small><p>{row.interpretation}</p></div> : null}
        {row.observations ? <div className="evaluation-copy"><small>Observaciones</small><p>{row.observations}</p></div> : null}
        {row.created_by === currentUserId ? <footer><button className="btn btn-danger btn-small" onClick={() => void remove(row)}><Trash2 size={15}/> Eliminar</button></footer> : null}
      </article>;
    })}</div> : null}

    {open ? <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal-panel evaluation-modal">
      <div className="modal-header"><div><h2>Nueva evaluación</h2><p className="muted">Los resultados quedarán guardados en el expediente.</p></div><button className="modal-close" onClick={() => { setOpen(false); reset(); }}><X/></button></div>
      <div className="modal-body"><form className="form" onSubmit={submit}>
        <div className="two"><label className="field">Instrumento<select value={instrument} onChange={e => { setInstrument(e.target.value as Instrument); setAnswers({}); }}><option>PHQ-9</option><option>GAD-7</option><option>Evaluación libre</option></select></label><label className="field">Fecha<input type="date" value={date} onChange={e => setDate(e.target.value)} required/></label></div>
        <label className="field">Cita relacionada<select value={appointmentId} onChange={e => setAppointmentId(e.target.value)}><option value="">Sin cita relacionada</option>{appointments.map(item => <option value={item.id} key={item.id}>{item.starts_at ? new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.starts_at)) : `Cita ${item.id}`}</option>)}</select></label>

        {instrument !== 'Evaluación libre' ? <div className="evaluation-questionnaire"><div className="evaluation-result-preview"><span>Puntaje actual</span><strong>{total}</strong><span className="soft-chip">{severity}</span></div>{questions.map((question, index) => <fieldset key={question}><legend>{index + 1}. {question}</legend><div className="answer-grid">{frequencyOptions.map(option => <label key={option.value}><input type="radio" name={`q-${index}`} checked={answers[String(index)] === option.value} onChange={() => setAnswers(current => ({...current, [String(index)]: option.value}))}/><span>{option.label}</span></label>)}</div></fieldset>)}</div> : <>
          <label className="field">Nombre del instrumento<input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Ej. BDI-II, BAI, escala interna" required/></label>
          <div className="two"><label className="field">Puntaje<input type="number" min="0" value={manualScore} onChange={e => setManualScore(e.target.value)}/></label><label className="field">Clasificación o severidad<input value={manualSeverity} onChange={e => setManualSeverity(e.target.value)} placeholder="Ej. Leve, moderada, alta"/></label></div>
        </>}

        <label className="field">Interpretación<textarea rows={3} value={interpretation} onChange={e => setInterpretation(e.target.value)} placeholder="Interpretación clínica del resultado"/></label>
        <label className="field">Observaciones<textarea rows={3} value={observations} onChange={e => setObservations(e.target.value)} placeholder="Contexto, conducta observada o notas complementarias"/></label>
        {error ? <div className="error">{error}</div> : null}
        <footer className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => { setOpen(false); reset(); }} disabled={saving}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar evaluación'}</button></footer>
      </form></div>
    </div></div> : null}
  </section>;
}
