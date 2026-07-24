'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type Tab='hours'|'rooms'|'blocks'|'duration';
type Room={id:number;name:string;description?:string|null;color?:string|null;active:boolean};
type Psychologist={id:string;full_name?:string|null;email?:string|null;calendar_color?:string|null;default_session_minutes?:number|null};
type WorkingHour={id:number;psychologist_id:string;day_of_week:number;start_time:string;end_time:string;room_id?:number|null;consulting_rooms?:Room|null};
type TimeBlock={id:number;psychologist_id:string;title:string;block_type:string;starts_at:string;ends_at:string;notes?:string|null;profiles?:{full_name?:string|null}|null};

const DAYS=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const BLOCK_TYPES=['Bloqueo','Vacaciones','Comida','Personal','Otro'];

function localDateTime(value:string){
  const date=new Date(value);
  const pad=(n:number)=>String(n).padStart(2,'0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function PracticeSettings(){
  const [tab,setTab]=useState<Tab>('hours');
  const [rooms,setRooms]=useState<Room[]>([]);
  const [psychologists,setPsychologists]=useState<Psychologist[]>([]);
  const [hours,setHours]=useState<WorkingHour[]>([]);
  const [blocks,setBlocks]=useState<TimeBlock[]>([]);
  const [selectedPsychologist,setSelectedPsychologist]=useState('');
  const [roomForm,setRoomForm]=useState({name:'',description:'',color:'#8172d9'});
  const [hourForm,setHourForm]=useState({day_of_week:'1',start_time:'09:00',end_time:'14:00',room_id:''});
  const [blockForm,setBlockForm]=useState({title:'',block_type:'Bloqueo',starts_at:'',ends_at:'',notes:''});
  const [msg,setMsg]=useState('');
  const [ok,setOk]=useState('');
  const [loading,setLoading]=useState(true);

  async function load(){
    setMsg('');setLoading(true);
    const s=getSupabaseBrowser();
    const [r,p,h,b]=await Promise.all([
      s.from('consulting_rooms').select('*').order('name'),
      s.from('profiles').select('id,full_name,email,calendar_color,default_session_minutes,roles!inner(name)').eq('roles.name','Psicóloga').order('full_name'),
      s.from('calendar_working_hours').select('*,consulting_rooms(*)').order('day_of_week').order('start_time'),
      s.from('calendar_time_blocks').select('*,profiles!calendar_time_blocks_psychologist_id_fkey(full_name)').order('starts_at',{ascending:false})
    ]);
    const firstError=[r.error,p.error,h.error,b.error].find(Boolean);
    if(firstError)setMsg(firstError.message);
    setRooms((r.data||[]) as Room[]);
    const people=(p.data||[]) as Psychologist[];
    setPsychologists(people);
    setHours((h.data||[]) as WorkingHour[]);
    setBlocks((b.data||[]) as TimeBlock[]);
    setSelectedPsychologist(current=>current||people[0]?.id||'');
    setLoading(false);
  }

  useEffect(()=>{void load();},[]);

  const selected=psychologists.find(p=>p.id===selectedPsychologist);
  const selectedHours=useMemo(()=>hours.filter(h=>h.psychologist_id===selectedPsychologist),[hours,selectedPsychologist]);
  const selectedBlocks=useMemo(()=>blocks.filter(b=>b.psychologist_id===selectedPsychologist),[blocks,selectedPsychologist]);
  const activeRooms=rooms.filter(r=>r.active);

  function clearMessages(){setMsg('');setOk('');}

  async function saveRoom(e:FormEvent){
    e.preventDefault();clearMessages();
    const {error}=await getSupabaseBrowser().from('consulting_rooms').insert({
      name:roomForm.name.trim(),description:roomForm.description.trim()||null,color:roomForm.color,active:true
    });
    if(error){setMsg(error.message);return;}
    setRoomForm({name:'',description:'',color:'#8172d9'});setOk('Consultorio agregado.');await load();setTab('rooms');
  }

  async function toggleRoom(room:Room){
    clearMessages();
    const {error}=await getSupabaseBrowser().from('consulting_rooms').update({active:!room.active,updated_at:new Date().toISOString()}).eq('id',room.id);
    if(error)setMsg(error.message);else await load();
  }

  async function saveHour(e:FormEvent){
    e.preventDefault();clearMessages();
    if(!selectedPsychologist){setMsg('Selecciona una psicóloga.');return;}
    if(hourForm.end_time<=hourForm.start_time){setMsg('La hora final debe ser posterior a la inicial.');return;}
    const {error}=await getSupabaseBrowser().from('calendar_working_hours').insert({
      psychologist_id:selectedPsychologist,day_of_week:Number(hourForm.day_of_week),start_time:hourForm.start_time,end_time:hourForm.end_time,room_id:hourForm.room_id?Number(hourForm.room_id):null,active:true
    });
    if(error){setMsg(error.message);return;}
    setOk('Horario agregado.');await load();
  }

  async function removeHour(id:number){
    clearMessages();
    const {error}=await getSupabaseBrowser().from('calendar_working_hours').delete().eq('id',id);
    if(error)setMsg(error.message);else await load();
  }

  async function saveBlock(e:FormEvent){
    e.preventDefault();clearMessages();
    if(!selectedPsychologist){setMsg('Selecciona una psicóloga.');return;}
    if(!blockForm.starts_at||!blockForm.ends_at||blockForm.ends_at<=blockForm.starts_at){setMsg('Revisa el rango de fechas del bloqueo.');return;}
    const {data:{user}}=await getSupabaseBrowser().auth.getUser();
    const {error}=await getSupabaseBrowser().from('calendar_time_blocks').insert({
      psychologist_id:selectedPsychologist,title:blockForm.title.trim(),block_type:blockForm.block_type,starts_at:new Date(blockForm.starts_at).toISOString(),ends_at:new Date(blockForm.ends_at).toISOString(),notes:blockForm.notes.trim()||null,created_by:user?.id||null
    });
    if(error){setMsg(error.message);return;}
    setBlockForm({title:'',block_type:'Bloqueo',starts_at:'',ends_at:'',notes:''});setOk('Bloqueo agregado.');await load();
  }

  async function removeBlock(id:number){
    clearMessages();
    const {error}=await getSupabaseBrowser().from('calendar_time_blocks').delete().eq('id',id);
    if(error)setMsg(error.message);else await load();
  }

  async function saveDuration(psychologistId:string,value:number){
    clearMessages();
    if(value<15||value>480){setMsg('La duración debe estar entre 15 y 480 minutos.');return;}
    const {error}=await getSupabaseBrowser().from('profiles').update({default_session_minutes:value,updated_at:new Date().toISOString()}).eq('id',psychologistId);
    if(error)setMsg(error.message);else{setOk('Duración actualizada.');await load();}
  }

  return <>
    <div className="page-head"><div><span className="eyebrow">Configuración clínica</span><h1>Disponibilidad</h1><p className="muted">Administra horarios semanales, consultorios, bloqueos y duración de sesiones.</p></div></div>

    <div className="availability-tabs">
      <button className={`availability-tab ${tab==='hours'?'active':''}`} onClick={()=>setTab('hours')}>Horarios semanales <span className="tab-count">{hours.length}</span></button>
      <button className={`availability-tab ${tab==='rooms'?'active':''}`} onClick={()=>setTab('rooms')}>Consultorios <span className="tab-count">{rooms.length}</span></button>
      <button className={`availability-tab ${tab==='blocks'?'active':''}`} onClick={()=>setTab('blocks')}>Bloqueos y vacaciones <span className="tab-count">{blocks.length}</span></button>
      <button className={`availability-tab ${tab==='duration'?'active':''}`} onClick={()=>setTab('duration')}>Duración de sesiones</button>
    </div>

    {msg&&<div className="error">{msg}</div>}{ok&&<div className="success">{ok}</div>}
    {loading?<div className="card">Cargando disponibilidad…</div>:<>
      {(tab==='hours'||tab==='blocks')&&<div className="availability-toolbar card">
        <label className="field">Psicóloga<select value={selectedPsychologist} onChange={e=>setSelectedPsychologist(e.target.value)}>{psychologists.map(p=><option key={p.id} value={p.id}>{p.full_name||p.email}</option>)}</select></label>
        {selected&&<div className="muted">Configurando a <strong>{selected.full_name||selected.email}</strong></div>}
      </div>}

      {tab==='hours'&&<>
        <div className="availability-summary">
          <div className="availability-stat"><span className="muted">Bloques semanales</span><strong>{selectedHours.length}</strong></div>
          <div className="availability-stat"><span className="muted">Días con atención</span><strong>{new Set(selectedHours.map(h=>h.day_of_week)).size}</strong></div>
          <div className="availability-stat"><span className="muted">Duración predeterminada</span><strong>{selected?.default_session_minutes||50} min</strong></div>
        </div>
        <div className="availability-layout">
          <form className="card form" onSubmit={saveHour}>
            <div><h2>Agregar bloque semanal</h2><p className="muted">Define un periodo habitual de atención.</p></div>
            <label className="field">Día<select value={hourForm.day_of_week} onChange={e=>setHourForm({...hourForm,day_of_week:e.target.value})}>{DAYS.map((day,index)=><option key={day} value={index}>{day}</option>)}</select></label>
            <div className="two"><label className="field">Desde<input type="time" value={hourForm.start_time} onChange={e=>setHourForm({...hourForm,start_time:e.target.value})} required/></label><label className="field">Hasta<input type="time" value={hourForm.end_time} onChange={e=>setHourForm({...hourForm,end_time:e.target.value})} required/></label></div>
            <label className="field">Consultorio<select value={hourForm.room_id} onChange={e=>setHourForm({...hourForm,room_id:e.target.value})}><option value="">Sin asignar / por definir</option>{activeRooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
            <button className="btn btn-primary">Agregar horario</button>
          </form>
          <div className="availability-stack">{DAYS.map((day,index)=>{
            const dayHours=selectedHours.filter(h=>h.day_of_week===index);
            return <section className="availability-day" key={day}><div className="availability-day-head"><h3>{day}</h3><span className="count-badge">{dayHours.length}</span></div>{dayHours.length?dayHours.map(h=><div className="availability-row" key={h.id}><div className="availability-time">{h.start_time.slice(0,5)} – {h.end_time.slice(0,5)}</div><div className="availability-meta"><span className="availability-dot" style={{background:h.consulting_rooms?.color||selected?.calendar_color||'#8172d9'}}/><span>{h.consulting_rooms?.name||'Sin consultorio'}</span></div><button className="btn btn-danger btn-small" onClick={()=>removeHour(h.id)}>Eliminar</button></div>):<div className="availability-empty">No atiende este día.</div>}</section>;
          })}</div>
        </div>
      </>}

      {tab==='rooms'&&<div className="availability-layout">
        <form className="card form" onSubmit={saveRoom}><div><h2>Nuevo consultorio</h2><p className="muted">Registra espacios físicos o una sala virtual.</p></div><label className="field">Nombre<input value={roomForm.name} onChange={e=>setRoomForm({...roomForm,name:e.target.value})} placeholder="Consultorio Norte" required/></label><label className="field">Descripción<input value={roomForm.description} onChange={e=>setRoomForm({...roomForm,description:e.target.value})} placeholder="Planta alta, sala virtual, etc."/></label><label className="field">Color<input type="color" value={roomForm.color} onChange={e=>setRoomForm({...roomForm,color:e.target.value})}/></label><button className="btn btn-primary">Guardar consultorio</button></form>
        <section className="card"><div className="section-heading"><div><h2>Consultorios configurados</h2><p className="muted">Activa o desactiva espacios sin perder su historial.</p></div></div><div className="room-list">{rooms.length?rooms.map(room=><article className="room-card" key={room.id}><div className="room-card-main"><span className="room-color" style={{background:room.color||'#8172d9'}}/><div><h3>{room.name}</h3><div className="muted">{room.description||'Sin descripción'} · {room.active?'Activo':'Inactivo'}</div></div></div><button className={`btn ${room.active?'btn-danger':'btn-primary'} btn-small`} onClick={()=>toggleRoom(room)}>{room.active?'Desactivar':'Activar'}</button></article>):<div className="availability-empty">Aún no hay consultorios.</div>}</div></section>
      </div>}

      {tab==='blocks'&&<div className="availability-layout">
        <form className="card form" onSubmit={saveBlock}><div><h2>Nuevo bloqueo</h2><p className="muted">Vacaciones, comidas, permisos o tiempo personal.</p></div><label className="field">Título<input value={blockForm.title} onChange={e=>setBlockForm({...blockForm,title:e.target.value})} placeholder="Vacaciones" required/></label><label className="field">Tipo<select value={blockForm.block_type} onChange={e=>setBlockForm({...blockForm,block_type:e.target.value})}>{BLOCK_TYPES.map(type=><option key={type}>{type}</option>)}</select></label><label className="field">Desde<input type="datetime-local" value={blockForm.starts_at} onChange={e=>setBlockForm({...blockForm,starts_at:e.target.value})} required/></label><label className="field">Hasta<input type="datetime-local" value={blockForm.ends_at} onChange={e=>setBlockForm({...blockForm,ends_at:e.target.value})} required/></label><label className="field">Notas<textarea value={blockForm.notes} onChange={e=>setBlockForm({...blockForm,notes:e.target.value})} rows={3}/></label><button className="btn btn-primary">Agregar bloqueo</button></form>
        <section className="card"><div className="section-heading"><div><h2>Bloqueos configurados</h2><p className="muted">La agenda impedirá crear citas dentro de estos periodos.</p></div><span className="count-badge">{selectedBlocks.length}</span></div><div className="block-list">{selectedBlocks.length?selectedBlocks.map(block=><article className="block-card" key={block.id}><div className="block-card-main"><div><h3>{block.title}</h3><div className="muted">{block.block_type} · {new Date(block.starts_at).toLocaleString('es-MX')} — {new Date(block.ends_at).toLocaleString('es-MX')}</div>{block.notes&&<div>{block.notes}</div>}</div></div><button className="btn btn-danger btn-small" onClick={()=>removeBlock(block.id)}>Eliminar</button></article>):<div className="availability-empty">No hay bloqueos para esta psicóloga.</div>}</div></section>
      </div>}

      {tab==='duration'&&<><div className="settings-note">Esta duración se usa como valor inicial al crear una cita; puede cambiarse para una cita específica.</div><div className="duration-grid">{psychologists.map(p=><DurationCard key={p.id} psychologist={p} onSave={saveDuration}/>)}</div></>}
    </>}
  </>;
}

function DurationCard({psychologist,onSave}:{psychologist:Psychologist;onSave:(id:string,value:number)=>Promise<void>}){
  const [value,setValue]=useState(psychologist.default_session_minutes||50);
  useEffect(()=>setValue(psychologist.default_session_minutes||50),[psychologist.default_session_minutes]);
  return <article className="duration-card"><div className="duration-card-head"><span className="duration-avatar" style={{background:psychologist.calendar_color||'#8172d9'}}>{(psychologist.full_name||psychologist.email||'P').slice(0,1).toUpperCase()}</span><div><strong>{psychologist.full_name||psychologist.email}</strong><div className="muted">Duración habitual</div></div></div><label className="field">Minutos<input type="number" min={15} max={480} step={5} value={value} onChange={e=>setValue(Number(e.target.value))}/></label><button className="btn btn-primary btn-small" onClick={()=>onSave(psychologist.id,value)}>Guardar duración</button></article>;
}
