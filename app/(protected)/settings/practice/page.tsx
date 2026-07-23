'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type Room = { id:string; name:string; location?:string|null; room_type:string; active:boolean };
type Psychologist = { id:string; full_name?:string|null; email?:string|null; calendar_color?:string|null; default_session_minutes?:number|null };
type Schedule = { id:string; psychologist_id:string; weekday:number; start_time:string; end_time:string; room_id?:string|null; practice_rooms?:Room|null; profiles?:{full_name?:string|null}|null };

const DAYS=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

export default function PracticeSettings(){
  const [rooms,setRooms]=useState<Room[]>([]);
  const [psychologists,setPsychologists]=useState<Psychologist[]>([]);
  const [schedules,setSchedules]=useState<Schedule[]>([]);
  const [roomForm,setRoomForm]=useState({name:'',location:'',room_type:'Presencial'});
  const [scheduleForm,setScheduleForm]=useState({psychologist_id:'',weekday:'1',start_time:'09:00',end_time:'14:00',room_id:''});
  const [msg,setMsg]=useState('');
  const [ok,setOk]=useState('');

  async function load(){
    setMsg('');
    const s=getSupabaseBrowser();
    const [r,p,h]=await Promise.all([
      s.from('practice_rooms').select('*').order('name'),
      s.from('profiles').select('id,full_name,email,calendar_color,default_session_minutes,roles!inner(name)').eq('roles.name','Psicóloga').order('full_name'),
      s.from('psychologist_schedules').select('*,practice_rooms(*),profiles!psychologist_schedules_psychologist_id_fkey(full_name)').order('weekday').order('start_time')
    ]);
    if(r.error)setMsg(r.error.message);else setRooms((r.data||[]) as Room[]);
    if(p.error)setMsg(p.error.message);else setPsychologists((p.data||[]) as Psychologist[]);
    if(h.error)setMsg(h.error.message);else setSchedules((h.data||[]) as Schedule[]);
  }

  useEffect(()=>{void load();},[]);

  async function saveRoom(e:FormEvent){
    e.preventDefault();setMsg('');setOk('');
    const s=getSupabaseBrowser();const {data:{user}}=await s.auth.getUser();
    const {error}=await s.from('practice_rooms').insert({...roomForm,location:roomForm.location||null,created_by:user?.id});
    if(error){setMsg(error.message);return;}
    setRoomForm({name:'',location:'',room_type:'Presencial'});setOk('Consultorio agregado.');await load();
  }

  async function saveSchedule(e:FormEvent){
    e.preventDefault();setMsg('');setOk('');
    const {error}=await getSupabaseBrowser().from('psychologist_schedules').insert({
      psychologist_id:scheduleForm.psychologist_id,
      weekday:Number(scheduleForm.weekday),
      start_time:scheduleForm.start_time,
      end_time:scheduleForm.end_time,
      room_id:scheduleForm.room_id||null
    });
    if(error){setMsg(error.message);return;}
    setOk('Horario agregado.');await load();
  }

  async function removeSchedule(id:string){
    const {error}=await getSupabaseBrowser().from('psychologist_schedules').delete().eq('id',id);
    if(error)setMsg(error.message);else await load();
  }

  const activeRooms=useMemo(()=>rooms.filter(r=>r.active),[rooms]);

  return <>
    <div className="page-head"><div><span className="eyebrow">Configuración clínica</span><h1>Consultorios y horarios</h1><p className="muted">Define dónde y cuándo atiende cada psicóloga.</p></div></div>
    {msg&&<div className="error">{msg}</div>}{ok&&<div className="success">{ok}</div>}
    <section className="settings-grid">
      <form className="card form" onSubmit={saveRoom}>
        <div><h2>Nuevo consultorio</h2><p className="muted">También puedes registrar la modalidad en línea.</p></div>
        <label className="field">Nombre<input value={roomForm.name} onChange={e=>setRoomForm({...roomForm,name:e.target.value})} placeholder="Consultorio Norte" required/></label>
        <label className="field">Ubicación<input value={roomForm.location} onChange={e=>setRoomForm({...roomForm,location:e.target.value})} placeholder="Dirección o enlace"/></label>
        <label className="field">Tipo<select value={roomForm.room_type} onChange={e=>setRoomForm({...roomForm,room_type:e.target.value})}><option>Presencial</option><option>Online</option></select></label>
        <button className="btn btn-primary">Guardar consultorio</button>
      </form>

      <form className="card form" onSubmit={saveSchedule}>
        <div><h2>Agregar horario</h2><p className="muted">Bloque habitual de atención semanal.</p></div>
        <label className="field">Psicóloga<select value={scheduleForm.psychologist_id} onChange={e=>setScheduleForm({...scheduleForm,psychologist_id:e.target.value})} required><option value="">Selecciona</option>{psychologists.map(p=><option key={p.id} value={p.id}>{p.full_name||p.email}</option>)}</select></label>
        <div className="two"><label className="field">Día<select value={scheduleForm.weekday} onChange={e=>setScheduleForm({...scheduleForm,weekday:e.target.value})}>{DAYS.map((d,i)=><option key={d} value={i}>{d}</option>)}</select></label><label className="field">Consultorio<select value={scheduleForm.room_id} onChange={e=>setScheduleForm({...scheduleForm,room_id:e.target.value})}><option value="">Sin asignar</option>{activeRooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label></div>
        <div className="two"><label className="field">Desde<input type="time" value={scheduleForm.start_time} onChange={e=>setScheduleForm({...scheduleForm,start_time:e.target.value})} required/></label><label className="field">Hasta<input type="time" value={scheduleForm.end_time} onChange={e=>setScheduleForm({...scheduleForm,end_time:e.target.value})} required/></label></div>
        <button className="btn btn-primary">Agregar horario</button>
      </form>
    </section>

    <section className="card table-wrap section-card"><div className="section-heading"><div><h2>Horarios configurados</h2><p className="muted">Vista general del equipo clínico.</p></div><span className="count-badge">{schedules.length}</span></div>
      <table className="table"><thead><tr><th>Psicóloga</th><th>Día</th><th>Horario</th><th>Consultorio</th><th></th></tr></thead><tbody>{schedules.length?schedules.map(h=><tr key={h.id}><td>{h.profiles?.full_name||'—'}</td><td>{DAYS[h.weekday]}</td><td>{h.start_time.slice(0,5)} – {h.end_time.slice(0,5)}</td><td>{h.practice_rooms?.name||'Sin asignar'}</td><td><button className="btn btn-danger btn-small" onClick={()=>removeSchedule(h.id)}>Eliminar</button></td></tr>):<tr><td colSpan={5}><div className="empty-state">Aún no hay horarios configurados.</div></td></tr>}</tbody></table>
    </section>
  </>;
}
