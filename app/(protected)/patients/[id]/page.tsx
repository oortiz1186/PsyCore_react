'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ClipboardList, FileText, FolderOpen, HeartPulse, History, Mail, Phone, Printer, Search, Target, UserRound } from 'lucide-react';
import { PatientEvaluationsPanel } from '@/components/patients/patient-evaluations-panel';
import { PatientFilesPanel } from '@/components/patients/patient-files-panel';
import { SoapNotesPanel } from '@/components/patients/soap-notes-panel';
import { TherapyGoalsPanel } from '@/components/patients/therapy-goals-panel';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type Patient = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  preferred_name?: string | null;
  email?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  status?: string | null;
  clinical_alert?: string | null;
  psychologist_id?: string | null;
  created_at?: string | null;
};

type Appointment = { id: string; starts_at?: string | null; status?: string | null; consultation_mode?: string | null };
type TabKey = 'overview' | 'appointments' | 'notes' | 'evaluations' | 'files' | 'goals' | 'history';
type TimelineKind = 'appointment' | 'soap' | 'evaluation' | 'file' | 'goal' | 'patient';
type TimelineItem = { id: string; kind: TimelineKind; title: string; detail: string; occurredAt: string; target: TabKey };
type EvaluationPoint = { id: string; instrument: string; evaluation_date: string; total_score?: number | null; severity?: string | null };

type RecordStats = {
  appointments: number;
  soap: number;
  evaluations: number;
  files: number;
};

function patientName(patient: Patient) {
  return `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Paciente';
}

function age(date?: string | null) {
  if (!date) return null;
  const birth = new Date(`${date}T00:00:00`);
  const now = new Date();
  let value = now.getFullYear() - birth.getFullYear();
  const month = now.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < birth.getDate())) value--;
  return value;
}

function timelineIcon(kind: TimelineKind) {
  if (kind === 'appointment') return <CalendarDays size={17}/>;
  if (kind === 'soap') return <ClipboardList size={17}/>;
  if (kind === 'evaluation') return <HeartPulse size={17}/>;
  if (kind === 'file') return <FileText size={17}/>;
  if (kind === 'goal') return <Target size={17}/>;
  return <UserRound size={17}/>;
}

function EvaluationTrend({ title, points, maximum }: { title: string; points: EvaluationPoint[]; maximum: number }) {
  const ordered = [...points].sort((a, b) => a.evaluation_date.localeCompare(b.evaluation_date));
  const latest = ordered.at(-1);

  return <article className="card" style={{ minHeight: 230 }}>
    <div className="section-heading">
      <div><span className="eyebrow">Evolución clínica</span><h2>{title}</h2></div>
      <span className="count-badge">{latest?.total_score ?? '—'}</span>
    </div>
    {ordered.length ? <>
      <div style={{ display: 'flex', alignItems: 'end', gap: 10, minHeight: 105, padding: '8px 2px 0' }}>
        {ordered.slice(-8).map(point => {
          const score = point.total_score ?? 0;
          const height = Math.max(8, Math.round((score / maximum) * 100));
          return <div key={point.id} title={`${point.evaluation_date}: ${score}`} style={{ flex: 1, minWidth: 24, textAlign: 'center' }}>
            <small style={{ display: 'block', marginBottom: 5, color: 'var(--muted)' }}>{score}</small>
            <div style={{ height, borderRadius: '9px 9px 4px 4px', background: 'linear-gradient(180deg,var(--lav),var(--sage))' }}/>
          </div>;
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, color: 'var(--muted)', fontSize: 12 }}>
        <span>{ordered[0].evaluation_date}</span><span>{latest?.severity || 'Sin clasificación'}</span><span>{latest?.evaluation_date}</span>
      </div>
    </> : <div className="empty-state compact-empty">Todavía no hay aplicaciones de {title}.</div>}
  </article>;
}

export default function PatientRecordPage() {
  const params = useParams<{ id: string }>();
  const patientId = Number(params.id);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [evaluationPoints, setEvaluationPoints] = useState<EvaluationPoint[]>([]);
  const [stats, setStats] = useState<RecordStats>({ appointments: 0, soap: 0, evaluations: 0, files: 0 });
  const [psychologistName, setPsychologistName] = useState('');
  const [tab, setTab] = useState<TabKey>('overview');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [historySearch, setHistorySearch] = useState('');
  const [historyKind, setHistoryKind] = useState<'all' | TimelineKind>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      if (!Number.isSafeInteger(patientId) || patientId <= 0) {
        setError('El identificador del paciente no es válido.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      const supabase = getSupabaseBrowser();
      const { data, error: patientError } = await supabase
        .from('patients')
        .select('id,first_name,last_name,preferred_name,email,phone,birth_date,status,clinical_alert,psychologist_id,created_at')
        .eq('id', patientId)
        .maybeSingle();

      if (patientError || !data) {
        setError(patientError?.message || 'No se encontró el paciente.');
        setLoading(false);
        return;
      }

      const current = data as Patient;
      setPatient(current);

      const [appointmentsResult, soapResult, evaluationsResult, filesResult, goalsResult] = await Promise.all([
        supabase.from('appointments').select('id,starts_at,status,consultation_mode').eq('patient_id', patientId).order('starts_at', { ascending: false }).limit(50),
        supabase.from('soap_notes').select('id,session_date,status,updated_at').eq('patient_id', patientId).order('session_date', { ascending: false }).limit(50),
        supabase.from('patient_evaluations').select('id,instrument,custom_instrument_name,evaluation_date,total_score,severity,created_at').eq('patient_id', patientId).order('evaluation_date', { ascending: false }).limit(50),
        supabase.from('patient_files').select('id,display_name,document_type,created_at').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(50),
        supabase.from('therapy_goals').select('id,title,status,progress,created_at,updated_at').eq('patient_id', patientId).order('updated_at', { ascending: false }).limit(50),
      ]);

      const appointmentRows = (appointmentsResult.data || []) as Appointment[];
      const soapRows = soapResult.data || [];
      const evaluationRows = evaluationsResult.data || [];
      const fileRows = filesResult.data || [];
      const goalRows = goalsResult.data || [];

      setAppointments(appointmentRows);
      setEvaluationPoints(evaluationRows.filter(item => item.instrument === 'PHQ-9' || item.instrument === 'GAD-7') as EvaluationPoint[]);
      setStats({ appointments: appointmentRows.length, soap: soapRows.length, evaluations: evaluationRows.length, files: fileRows.length });

      const items: TimelineItem[] = [];
      if (current.created_at) items.push({ id: `patient-${current.id}`, kind: 'patient', target: 'overview', title: 'Paciente registrado', detail: 'Se creó el expediente del paciente.', occurredAt: current.created_at });
      for (const item of appointmentRows) if (item.starts_at) items.push({ id: `appointment-${item.id}`, kind: 'appointment', target: 'appointments', title: 'Cita', detail: `${item.consultation_mode || 'Consulta psicológica'} · ${item.status || 'Programada'}`, occurredAt: item.starts_at });
      for (const item of soapRows) items.push({ id: `soap-${item.id}`, kind: 'soap', target: 'notes', title: 'Nota SOAP', detail: item.status || 'Registrada', occurredAt: item.updated_at || `${item.session_date}T12:00:00` });
      for (const item of evaluationRows) items.push({ id: `evaluation-${item.id}`, kind: 'evaluation', target: 'evaluations', title: item.instrument === 'Evaluación libre' ? item.custom_instrument_name || 'Evaluación libre' : item.instrument, detail: `${item.severity || 'Evaluación registrada'}${item.total_score === null || item.total_score === undefined ? '' : ` · ${item.total_score} puntos`}`, occurredAt: item.created_at || `${item.evaluation_date}T12:00:00` });
      for (const item of fileRows) items.push({ id: `file-${item.id}`, kind: 'file', target: 'files', title: item.display_name || 'Archivo clínico', detail: item.document_type || 'Documento', occurredAt: item.created_at });
      for (const item of goalRows) items.push({ id: `goal-${item.id}`, kind: 'goal', target: 'goals', title: `Objetivo: ${item.title}`, detail: `${item.status || 'Activo'} · ${item.progress || 0}% de progreso`, occurredAt: item.updated_at || item.created_at });
      setTimeline(items.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()));

      if (current.psychologist_id) {
        const profileResult = await supabase.from('profiles').select('full_name,email').eq('id', current.psychologist_id).maybeSingle();
        if (profileResult.data) setPsychologistName(profileResult.data.full_name || profileResult.data.email || 'Psicóloga asignada');
      }
      setLoading(false);
    }
    void load();
  }, [patientId, refreshVersion]);

  function openTab(nextTab: TabKey) {
    setTab(nextTab);
    if (nextTab === 'history' || nextTab === 'overview') setRefreshVersion(current => current + 1);
  }

  const nextAppointment = useMemo(() => appointments
    .filter(item => item.starts_at && new Date(item.starts_at) >= new Date())
    .sort((a, b) => new Date(a.starts_at || 0).getTime() - new Date(b.starts_at || 0).getTime())[0], [appointments]);

  const lastAppointment = useMemo(() => appointments
    .filter(item => item.starts_at && new Date(item.starts_at) < new Date())
    .sort((a, b) => new Date(b.starts_at || 0).getTime() - new Date(a.starts_at || 0).getTime())[0], [appointments]);

  const filteredTimeline = useMemo(() => {
    const query = historySearch.trim().toLocaleLowerCase('es');
    return timeline.filter(item => {
      const matchesKind = historyKind === 'all' || item.kind === historyKind;
      const matchesSearch = !query || `${item.title} ${item.detail}`.toLocaleLowerCase('es').includes(query);
      return matchesKind && matchesSearch;
    });
  }, [historyKind, historySearch, timeline]);

  if (loading) return <div className="card empty-state">Cargando expediente...</div>;
  if (error || !patient) return <div className="card empty-state"><h2>No fue posible abrir el expediente</h2><p className="error">{error}</p><Link className="btn btn-secondary" href="/patients">Volver a pacientes</Link></div>;

  const patientAge = age(patient.birth_date);
  const phqPoints = evaluationPoints.filter(point => point.instrument === 'PHQ-9');
  const gadPoints = evaluationPoints.filter(point => point.instrument === 'GAD-7');
  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Resumen', icon: <UserRound size={17} /> },
    { key: 'appointments', label: 'Agenda', icon: <CalendarDays size={17} /> },
    { key: 'notes', label: 'Notas SOAP', icon: <ClipboardList size={17} /> },
    { key: 'evaluations', label: 'Evaluaciones', icon: <HeartPulse size={17} /> },
    { key: 'files', label: 'Archivos', icon: <FolderOpen size={17} /> },
    { key: 'goals', label: 'Objetivos', icon: <Target size={17} /> },
    { key: 'history', label: 'Historial', icon: <History size={17} /> },
  ];

  return <>
    <div className="record-breadcrumb"><Link href="/patients">Pacientes</Link><span>/</span><strong>{patientName(patient)}</strong></div>
    <section className="patient-record-hero">
      <div className="patient-record-avatar">{patientName(patient).split(' ').slice(0, 2).map(value => value[0]).join('').toUpperCase()}</div>
      <div className="patient-record-copy"><span className="eyebrow">Expediente clínico</span><h1>{patient.preferred_name || patientName(patient)}</h1>{patient.preferred_name ? <p className="muted">{patientName(patient)}</p> : null}<div className="patient-record-meta"><span>{patientAge === null ? 'Edad no registrada' : `${patientAge} años`}</span><span>{psychologistName || 'Psicóloga no identificada'}</span><span className="chip">{patient.status || 'Activo'}</span></div></div>
      <div className="patient-record-actions"><button className="btn btn-secondary" type="button" onClick={() => window.print()}><Printer size={16}/> Imprimir / PDF</button><Link className="btn btn-secondary" href={`/appointments?patient=${patient.id}`}>Agendar cita</Link><button className="btn btn-primary" onClick={() => openTab('notes')}>Nueva nota SOAP</button></div>
    </section>

    {patient.clinical_alert ? <div className="clinical-alert record-alert"><strong>Alerta clínica</strong><span>{patient.clinical_alert}</span></div> : null}

    <section className="dashboard-stats" aria-label="Resumen del expediente">
      <button className="metric-card" type="button" onClick={() => openTab('appointments')}><span className="metric-icon"><CalendarDays size={21}/></span><span><small>Sesiones registradas</small><strong>{stats.appointments}</strong></span></button>
      <button className="metric-card" type="button" onClick={() => openTab('notes')}><span className="metric-icon"><ClipboardList size={21}/></span><span><small>Notas SOAP</small><strong>{stats.soap}</strong></span></button>
      <button className="metric-card" type="button" onClick={() => openTab('evaluations')}><span className="metric-icon"><HeartPulse size={21}/></span><span><small>Evaluaciones</small><strong>{stats.evaluations}</strong></span></button>
      <button className="metric-card" type="button" onClick={() => openTab('files')}><span className="metric-icon"><FolderOpen size={21}/></span><span><small>Archivos clínicos</small><strong>{stats.files}</strong></span></button>
    </section>

    <nav className="record-tabs" aria-label="Secciones del expediente">{tabs.map(item => <button key={item.key} className={tab === item.key ? 'active' : ''} onClick={() => openTab(item.key)}>{item.icon}{item.label}</button>)}</nav>

    {tab === 'overview' ? <>
      <div className="record-grid"><section className="card record-main-card"><div className="section-heading"><div><span className="eyebrow">Datos generales</span><h2>Información del paciente</h2></div></div><div className="detail-grid"><div><small>Nombre completo</small><strong>{patientName(patient)}</strong></div><div><small>Fecha de nacimiento</small><strong>{patient.birth_date || 'No registrada'}</strong></div><div><small>Edad</small><strong>{patientAge === null ? 'No registrada' : `${patientAge} años`}</strong></div><div><small>Estado clínico</small><strong>{patient.status || 'Activo'}</strong></div><div><small>Última sesión</small><strong>{lastAppointment?.starts_at ? new Intl.DateTimeFormat('es-MX',{dateStyle:'medium'}).format(new Date(lastAppointment.starts_at)) : 'Sin sesiones previas'}</strong></div><div><small>Fecha de alta</small><strong>{patient.created_at ? new Intl.DateTimeFormat('es-MX',{dateStyle:'medium'}).format(new Date(patient.created_at)) : 'No registrada'}</strong></div></div><div className="contact-panel"><div><Phone size={18}/><span><small>Teléfono</small><strong>{patient.phone || 'No registrado'}</strong></span></div><div><Mail size={18}/><span><small>Correo</small><strong>{patient.email || 'No registrado'}</strong></span></div></div></section><aside className="card record-side-card"><span className="eyebrow">Seguimiento</span><h2>Próxima cita</h2>{nextAppointment?.starts_at ? <><strong className="next-appointment-date">{new Intl.DateTimeFormat('es-MX',{dateStyle:'long',timeStyle:'short'}).format(new Date(nextAppointment.starts_at))}</strong><p className="muted">{nextAppointment.consultation_mode || 'Consulta'} · {nextAppointment.status || 'Programada'}</p></> : <div className="empty-state compact-empty">No hay una cita futura registrada.</div>}<Link className="btn btn-primary" href={`/appointments?patient=${patient.id}`}>Programar cita</Link></aside></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 18, marginTop: 20 }}><EvaluationTrend title="PHQ-9" points={phqPoints} maximum={27}/><EvaluationTrend title="GAD-7" points={gadPoints} maximum={21}/></div>
    </> : null}
    {tab === 'appointments' ? <section className="card record-section"><div className="section-heading"><div><span className="eyebrow">Agenda</span><h2>Citas del paciente</h2></div><Link className="btn btn-primary" href={`/appointments?patient=${patient.id}`}>Nueva cita</Link></div>{appointments.length ? <div className="appointment-list">{appointments.map(item => <div className="appointment-item" key={item.id}><span className="appointment-dot"/><div><strong>{item.starts_at ? new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.starts_at)) : 'Fecha pendiente'}</strong><small>{item.consultation_mode || 'Consulta psicológica'}</small></div><span className="soft-chip">{item.status || 'Programada'}</span></div>)}</div> : <div className="empty-state">Aún no hay citas registradas.</div>}</section> : null}
    {tab === 'notes' ? <SoapNotesPanel patientId={patient.id} psychologistId={patient.psychologist_id} appointments={appointments} /> : null}
    {tab === 'evaluations' ? <PatientEvaluationsPanel patientId={patient.id} psychologistId={patient.psychologist_id} appointments={appointments} /> : null}
    {tab === 'files' ? <PatientFilesPanel patientId={patient.id} psychologistId={patient.psychologist_id} /> : null}
    {tab === 'goals' ? <TherapyGoalsPanel patientId={patientId} psychologistId={patient.psychologist_id} /> : null}
    {tab === 'history' ? <section className="card record-section">
      <div className="section-heading"><div><span className="eyebrow">Actividad del expediente</span><h2>Historial clínico</h2><p className="muted">Selecciona cualquier movimiento para abrir su sección.</p></div><span className="count-badge">{filteredTimeline.length}</span></div>
      <div className="patient-toolbar" style={{ marginBottom: 20 }}><label className="search-box"><Search size={18}/><input value={historySearch} onChange={event => setHistorySearch(event.target.value)} placeholder="Buscar en el historial..."/></label><select value={historyKind} onChange={event => setHistoryKind(event.target.value as 'all' | TimelineKind)}><option value="all">Todos los movimientos</option><option value="appointment">Citas</option><option value="soap">Notas SOAP</option><option value="evaluation">Evaluaciones</option><option value="file">Archivos</option><option value="goal">Objetivos</option><option value="patient">Expediente</option></select></div>
      {filteredTimeline.length ? <div className="record-timeline">{filteredTimeline.map(item => <button type="button" className="record-timeline-item" key={item.id} onClick={() => openTab(item.target)} style={{ width: '100%', border: 0, background: 'transparent', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}><div className={`record-timeline-icon kind-${item.kind}`}>{timelineIcon(item.kind)}</div><div><strong>{item.title}</strong><p>{item.detail}</p><time>{new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.occurredAt))}</time></div></button>)}</div> : <div className="empty-state">No hay movimientos que coincidan con los filtros.</div>}
    </section> : null}
  </>;
}
