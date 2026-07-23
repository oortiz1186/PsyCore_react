'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type Psychologist = { id: string; full_name?: string | null; email?: string | null };
type WorkingHour = { id: string; psychologist_id: string; day_of_week: number; start_time: string; end_time: string; active?: boolean | null };
type TimeBlock = { id: string; psychologist_id: string; title: string; block_type: string; starts_at: string; ends_at: string; notes?: string | null };

type Props = { psychologists: Psychologist[]; onChanged?: () => void };

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const defaultSchedule = { psychologist_id: '', day_of_week: '1', start_time: '09:00', end_time: '18:00' };
const defaultBlock = { psychologist_id: '', title: '', block_type: 'Bloqueo', starts_at: '', ends_at: '', notes: '' };

function profileName(item: Psychologist) {
  return item.full_name || item.email || 'Psicóloga';
}

function localInput(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

export function AvailabilityPanel({ psychologists, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'hours' | 'blocks'>('hours');
  const [hours, setHours] = useState<WorkingHour[]>([]);
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [schedule, setSchedule] = useState(defaultSchedule);
  const [block, setBlock] = useState(defaultBlock);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const psychologistMap = useMemo(() => new Map(psychologists.map(item => [item.id, profileName(item)])), [psychologists]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open]);

  async function load() {
    const supabase = getSupabaseBrowser();
    const [hoursResult, blocksResult] = await Promise.all([
      supabase.from('calendar_working_hours').select('id,psychologist_id,day_of_week,start_time,end_time,active').order('day_of_week').order('start_time'),
      supabase.from('calendar_time_blocks').select('id,psychologist_id,title,block_type,starts_at,ends_at,notes').order('starts_at', { ascending: false }).limit(100),
    ]);
    if (hoursResult.error) setMessage(hoursResult.error.message); else setHours((hoursResult.data || []) as WorkingHour[]);
    if (blocksResult.error) setMessage(blocksResult.error.message); else setBlocks((blocksResult.data || []) as TimeBlock[]);
  }

  async function saveSchedule(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    setSaving(true);
    const supabase = getSupabaseBrowser();
    const result = await supabase.from('calendar_working_hours').insert({
      psychologist_id: schedule.psychologist_id,
      day_of_week: Number(schedule.day_of_week),
      start_time: schedule.start_time,
      end_time: schedule.end_time,
    });
    if (result.error) setMessage(result.error.message);
    else {
      setSchedule({ ...defaultSchedule, psychologist_id: schedule.psychologist_id });
      await load();
      onChanged?.();
    }
    setSaving(false);
  }

  async function saveBlock(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    setSaving(true);
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    const result = await supabase.from('calendar_time_blocks').insert({
      psychologist_id: block.psychologist_id,
      title: block.title.trim(),
      block_type: block.block_type,
      starts_at: new Date(block.starts_at).toISOString(),
      ends_at: new Date(block.ends_at).toISOString(),
      notes: block.notes.trim() || null,
      created_by: user?.id,
    });
    if (result.error) setMessage(result.error.message);
    else {
      setBlock({ ...defaultBlock, psychologist_id: block.psychologist_id });
      await load();
      onChanged?.();
    }
    setSaving(false);
  }

  async function remove(table: 'calendar_working_hours' | 'calendar_time_blocks', id: string) {
    if (!confirm('¿Eliminar este registro?')) return;
    const supabase = getSupabaseBrowser();
    const result = await supabase.from(table).delete().eq('id', id);
    if (result.error) setMessage(result.error.message);
    else {
      await load();
      onChanged?.();
    }
  }

  return <>
    <button className="btn btn-secondary" type="button" onClick={() => setOpen(true)}><CalendarClock size={17}/> Disponibilidad</button>
    <Modal open={open} title="Disponibilidad de agenda" description="Configura jornadas, vacaciones y bloqueos." onClose={() => setOpen(false)} closeDisabled={saving}>
      <div className="availability-tabs">
        <button type="button" className={tab === 'hours' ? 'active' : ''} onClick={() => setTab('hours')}>Horarios laborales</button>
        <button type="button" className={tab === 'blocks' ? 'active' : ''} onClick={() => setTab('blocks')}>Vacaciones y bloqueos</button>
      </div>
      {message ? <div className="error">{message}</div> : null}

      {tab === 'hours' ? <div className="availability-layout">
        <form className="availability-form" onSubmit={saveSchedule}>
          <h3>Nueva jornada</h3>
          <label className="field">Psicóloga<select value={schedule.psychologist_id} onChange={event => setSchedule({ ...schedule, psychologist_id: event.target.value })} required><option value="">Selecciona</option>{psychologists.map(item => <option key={item.id} value={item.id}>{profileName(item)}</option>)}</select></label>
          <label className="field">Día<select value={schedule.day_of_week} onChange={event => setSchedule({ ...schedule, day_of_week: event.target.value })}>{DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
          <div className="availability-time-grid"><label className="field">Desde<input type="time" value={schedule.start_time} onChange={event => setSchedule({ ...schedule, start_time: event.target.value })} required/></label><label className="field">Hasta<input type="time" value={schedule.end_time} onChange={event => setSchedule({ ...schedule, end_time: event.target.value })} required/></label></div>
          <button className="btn btn-primary" disabled={saving}><Plus size={16}/> Agregar horario</button>
          <p className="muted availability-help">Puedes registrar dos jornadas en el mismo día, por ejemplo 09:00–14:00 y 16:00–20:00.</p>
        </form>
        <div className="availability-list"><h3>Jornadas registradas</h3>{hours.length ? hours.map(item => <article className="availability-item" key={item.id}><div><strong>{psychologistMap.get(item.psychologist_id) || 'Psicóloga'}</strong><span>{DAYS[item.day_of_week]} · {item.start_time.slice(0,5)}–{item.end_time.slice(0,5)}</span></div><button className="icon-button danger" type="button" onClick={() => remove('calendar_working_hours', item.id)} aria-label="Eliminar horario"><Trash2 size={16}/></button></article>) : <div className="empty-state compact-empty">Todavía no hay jornadas configuradas.</div>}</div>
      </div> : null}

      {tab === 'blocks' ? <div className="availability-layout">
        <form className="availability-form" onSubmit={saveBlock}>
          <h3>Nuevo bloqueo</h3>
          <label className="field">Psicóloga<select value={block.psychologist_id} onChange={event => setBlock({ ...block, psychologist_id: event.target.value })} required><option value="">Selecciona</option>{psychologists.map(item => <option key={item.id} value={item.id}>{profileName(item)}</option>)}</select></label>
          <label className="field">Tipo<select value={block.block_type} onChange={event => setBlock({ ...block, block_type: event.target.value })}><option>Bloqueo</option><option>Vacaciones</option><option>Comida</option><option>Personal</option><option>Otro</option></select></label>
          <label className="field">Título<input value={block.title} onChange={event => setBlock({ ...block, title: event.target.value })} placeholder="Ej. Vacaciones, comida o capacitación" required/></label>
          <label className="field">Inicio<input type="datetime-local" value={block.starts_at} onChange={event => setBlock({ ...block, starts_at: event.target.value })} required/></label>
          <label className="field">Fin<input type="datetime-local" value={block.ends_at} onChange={event => setBlock({ ...block, ends_at: event.target.value })} required/></label>
          <label className="field">Notas<textarea rows={2} value={block.notes} onChange={event => setBlock({ ...block, notes: event.target.value })}/></label>
          <button className="btn btn-primary" disabled={saving}><Plus size={16}/> Agregar bloqueo</button>
        </form>
        <div className="availability-list"><h3>Bloqueos registrados</h3>{blocks.length ? blocks.map(item => <article className="availability-item" key={item.id}><div><strong>{item.title}</strong><span>{psychologistMap.get(item.psychologist_id) || 'Psicóloga'} · {item.block_type}</span><small>{new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.starts_at))} – {new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.ends_at))}</small></div><button className="icon-button danger" type="button" onClick={() => remove('calendar_time_blocks', item.id)} aria-label="Eliminar bloqueo"><Trash2 size={16}/></button></article>) : <div className="empty-state compact-empty">Todavía no hay vacaciones o bloqueos.</div>}</div>
      </div> : null}
    </Modal>
  </>;
}
