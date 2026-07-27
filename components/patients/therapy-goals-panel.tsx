'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleDot, Pencil, Plus, Target, Trash2, X } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type GoalStatus = 'pending' | 'active' | 'completed' | 'cancelled';
type GoalPriority = 'low' | 'medium' | 'high';

type TherapyGoal = {
  id: string;
  patient_id: string;
  psychologist_id?: string | null;
  title: string;
  description?: string | null;
  status: GoalStatus;
  priority: GoalPriority;
  progress: number;
  start_date: string;
  target_date?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
};

type GoalForm = {
  title: string;
  description: string;
  status: GoalStatus;
  priority: GoalPriority;
  progress: number;
  start_date: string;
  target_date: string;
};

const emptyForm = (): GoalForm => ({
  title: '',
  description: '',
  status: 'active',
  priority: 'medium',
  progress: 0,
  start_date: new Date().toISOString().slice(0, 10),
  target_date: '',
});

const statusLabel: Record<GoalStatus, string> = {
  pending: 'Pendiente',
  active: 'En progreso',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

const priorityLabel: Record<GoalPriority, string> = {
  low: 'Prioridad baja',
  medium: 'Prioridad media',
  high: 'Prioridad alta',
};

export function TherapyGoalsPanel({ patientId, psychologistId }: { patientId: string; psychologistId?: string | null }) {
  const [goals, setGoals] = useState<TherapyGoal[]>([]);
  const [filter, setFilter] = useState<'all' | GoalStatus>('all');
  const [form, setForm] = useState<GoalForm>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadGoals() {
    setLoading(true);
    setError('');
    const supabase = getSupabaseBrowser();
    const { data, error: queryError } = await supabase
      .from('therapy_goals')
      .select('*')
      .eq('patient_id', patientId)
      .order('updated_at', { ascending: false });

    if (queryError) setError(queryError.message);
    setGoals((data || []) as TherapyGoal[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadGoals();
  }, [patientId]);

  const visibleGoals = useMemo(
    () => filter === 'all' ? goals : goals.filter(goal => goal.status === filter),
    [filter, goals],
  );

  const summary = useMemo(() => {
    const active = goals.filter(goal => goal.status === 'active').length;
    const completed = goals.filter(goal => goal.status === 'completed').length;
    const average = goals.length ? Math.round(goals.reduce((total, goal) => total + goal.progress, 0) / goals.length) : 0;
    return { active, completed, average };
  }, [goals]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(goal: TherapyGoal) {
    setEditingId(goal.id);
    setForm({
      title: goal.title,
      description: goal.description || '',
      status: goal.status,
      priority: goal.priority,
      progress: goal.progress,
      start_date: goal.start_date,
      target_date: goal.target_date || '',
    });
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setError('');
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      patient_id: patientId,
      psychologist_id: psychologistId || null,
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
      priority: form.priority,
      progress: form.status === 'completed' ? 100 : Number(form.progress),
      start_date: form.start_date,
      target_date: form.target_date || null,
      created_by: user?.id || null,
    };

    const result = editingId
      ? await supabase.from('therapy_goals').update(payload).eq('id', editingId)
      : await supabase.from('therapy_goals').insert(payload);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setOpen(false);
    setSaving(false);
    await loadGoals();
  }

  async function removeGoal(id: string) {
    if (!window.confirm('¿Eliminar este objetivo terapéutico? Esta acción no se puede deshacer.')) return;
    const supabase = getSupabaseBrowser();
    const { error: deleteError } = await supabase.from('therapy_goals').delete().eq('id', id);
    if (deleteError) setError(deleteError.message);
    else await loadGoals();
  }

  async function updateProgress(goal: TherapyGoal, progress: number) {
    const nextProgress = Math.max(0, Math.min(100, progress));
    const status: GoalStatus = nextProgress === 100 ? 'completed' : goal.status === 'completed' ? 'active' : goal.status;
    const supabase = getSupabaseBrowser();
    const { error: updateError } = await supabase
      .from('therapy_goals')
      .update({ progress: nextProgress, status })
      .eq('id', goal.id);
    if (updateError) setError(updateError.message);
    else await loadGoals();
  }

  return <section className="card record-section therapy-goals-panel">
    <div className="section-heading">
      <div><span className="eyebrow">Plan terapéutico</span><h2>Objetivos terapéuticos</h2><p className="muted">Define metas clínicas y registra el progreso del tratamiento.</p></div>
      <button className="btn btn-primary" type="button" onClick={openCreate}><Plus size={17}/> Nuevo objetivo</button>
    </div>

    <div className="therapy-goals-summary">
      <article><Target size={20}/><span><small>Activos</small><strong>{summary.active}</strong></span></article>
      <article><CheckCircle2 size={20}/><span><small>Completados</small><strong>{summary.completed}</strong></span></article>
      <article><CircleDot size={20}/><span><small>Progreso promedio</small><strong>{summary.average}%</strong></span></article>
    </div>

    <div className="therapy-goals-filters">
      {(['all', 'active', 'pending', 'completed', 'cancelled'] as const).map(value =>
        <button type="button" key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value === 'all' ? 'Todos' : statusLabel[value]}</button>
      )}
    </div>

    {error ? <div className="clinical-alert"><strong>No fue posible completar la operación</strong><span>{error}</span></div> : null}
    {loading ? <div className="empty-state">Cargando objetivos...</div> : null}
    {!loading && !visibleGoals.length ? <div className="empty-state"><Target size={30}/><h3>Sin objetivos registrados</h3><p>Crea el primer objetivo para comenzar a medir el avance terapéutico.</p></div> : null}

    {!loading && visibleGoals.length ? <div className="therapy-goals-grid">
      {visibleGoals.map(goal => <article className="therapy-goal-card" key={goal.id}>
        <div className="therapy-goal-card-header">
          <div><span className={`goal-status status-${goal.status}`}>{statusLabel[goal.status]}</span><h3>{goal.title}</h3></div>
          <div className="therapy-goal-actions"><button type="button" title="Editar" onClick={() => openEdit(goal)}><Pencil size={16}/></button><button type="button" title="Eliminar" onClick={() => void removeGoal(goal.id)}><Trash2 size={16}/></button></div>
        </div>
        {goal.description ? <p className="muted">{goal.description}</p> : null}
        <div className="therapy-goal-progress-label"><span>{priorityLabel[goal.priority]}</span><strong>{goal.progress}%</strong></div>
        <div className="therapy-goal-progress"><span style={{ width: `${goal.progress}%` }}/></div>
        <input className="therapy-goal-range" type="range" min="0" max="100" step="5" value={goal.progress} onChange={event => void updateProgress(goal, Number(event.target.value))} aria-label={`Progreso de ${goal.title}`}/>
        <div className="therapy-goal-dates"><span><small>Inicio</small><strong>{new Intl.DateTimeFormat('es-MX',{dateStyle:'medium'}).format(new Date(`${goal.start_date}T12:00:00`))}</strong></span><span><small>Meta</small><strong>{goal.target_date ? new Intl.DateTimeFormat('es-MX',{dateStyle:'medium'}).format(new Date(`${goal.target_date}T12:00:00`)) : 'Sin fecha'}</strong></span></div>
      </article>)}
    </div> : null}

    {open ? <div className="therapy-goal-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <form className="therapy-goal-modal card" onSubmit={submit}>
        <div className="section-heading"><div><span className="eyebrow">{editingId ? 'Editar' : 'Nuevo'}</span><h2>Objetivo terapéutico</h2></div><button className="icon-button" type="button" onClick={() => setOpen(false)}><X size={20}/></button></div>
        <label>Título<input required value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="Ej. Reducir ansiedad social"/></label>
        <label>Descripción<textarea rows={4} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder="Indicadores, contexto y criterio clínico..."/></label>
        <div className="therapy-goal-form-grid">
          <label>Estado<select value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value as GoalStatus }))}><option value="pending">Pendiente</option><option value="active">En progreso</option><option value="completed">Completado</option><option value="cancelled">Cancelado</option></select></label>
          <label>Prioridad<select value={form.priority} onChange={event => setForm(current => ({ ...current, priority: event.target.value as GoalPriority }))}><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option></select></label>
          <label>Fecha de inicio<input type="date" required value={form.start_date} onChange={event => setForm(current => ({ ...current, start_date: event.target.value }))}/></label>
          <label>Fecha objetivo<input type="date" value={form.target_date} onChange={event => setForm(current => ({ ...current, target_date: event.target.value }))}/></label>
        </div>
        <label>Progreso: <strong>{form.status === 'completed' ? 100 : form.progress}%</strong><input type="range" min="0" max="100" step="5" disabled={form.status === 'completed'} value={form.status === 'completed' ? 100 : form.progress} onChange={event => setForm(current => ({ ...current, progress: Number(event.target.value) }))}/></label>
        <div className="hero-actions"><button className="btn btn-secondary" type="button" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary" disabled={saving} type="submit">{saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear objetivo'}</button></div>
      </form>
    </div> : null}
  </section>;
}
