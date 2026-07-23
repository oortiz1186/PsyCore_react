'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ClipboardList, FileText, FolderOpen, HeartPulse, History, Mail, Phone, UserRound } from 'lucide-react';
import { SoapNotesPanel } from '@/components/patients/soap-notes-panel';
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

type Appointment = {
  id: string;
  starts_at?: string | null;
  status?: string | null;
  consultation_mode?: string | null;
};

type TabKey = 'overview' | 'appointments' | 'notes' | 'evaluations' | 'files' | 'history';

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

export default function PatientRecordPage() {
  const params = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [psychologistName, setPsychologistName] = useState('');
  const [tab, setTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      const supabase = getSupabaseBrowser();
      const { data, error: patientError } = await supabase
        .from('patients')
        .select('id,first_name,last_name,preferred_name,email,phone,birth_date,status,clinical_alert,psychologist_id,created_at')
        .eq('id', params.id)
        .maybeSingle();

      if (patientError || !data) {
        setError(patientError?.message || 'No se encontró el paciente.');
        setLoading(false);
        return;
      }

      const current = data as Patient;
      setPatient(current);

      const appointmentsResult = await supabase
        .from('appointments')
        .select('id,starts_at,status,consultation_mode')
        .eq('patient_id', params.id)
        .order('starts_at', { ascending: false })
        .limit(30);
      if (!appointmentsResult.error) setAppointments((appointmentsResult.data || []) as Appointment[]);

      if (current.psychologist_id) {
        const profileResult = await supabase.from('profiles').select('full_name,email').eq('id', current.psychologist_id).maybeSingle();
        if (profileResult.data) setPsychologistName(profileResult.data.full_name || profileResult.data.email || 'Psicóloga asignada');
      }
      setLoading(false);
    }
    void load();
  }, [params.id]);

  const nextAppointment = useMemo(() => appointments
    .filter((item) => item.starts_at && new Date(item.starts_at) >= new Date())
    .sort((a, b) => new Date(a.starts_at || 0).getTime() - new Date(b.starts_at || 0).getTime())[0], [appointments]);

  if (loading) return <div className="card empty-state">Cargando expediente...</div>;
  if (error || !patient) return <div className="card empty-state"><h2>No fue posible abrir el expediente</h2><p className="error">{error}</p><Link className="btn btn-secondary" href="/patients">Volver a pacientes</Link></div>;

  const patientAge = age(patient.birth_date);
  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Información', icon: <UserRound size={17} /> },
    { key: 'appointments', label: 'Agenda', icon: <CalendarDays size={17} /> },
    { key: 'notes', label: 'Notas SOAP', icon: <ClipboardList size={17} /> },
    { key: 'evaluations', label: 'Evaluaciones', icon: <HeartPulse size={17} /> },
    { key: 'files', label: 'Archivos', icon: <FolderOpen size={17} /> },
    { key: 'history', label: 'Historial', icon: <History size={17} /> },
  ];

  return <>
    <div className="record-breadcrumb"><Link href="/patients">Pacientes</Link><span>/</span><strong>{patientName(patient)}</strong></div>

    <section className="patient-record-hero">
      <div className="patient-record-avatar">{patientName(patient).split(' ').slice(0, 2).map(value => value[0]).join('').toUpperCase()}</div>
      <div className="patient-record-copy">
        <span className="eyebrow">Expediente clínico</span>
        <h1>{patient.preferred_name || patientName(patient)}</h1>
        {patient.preferred_name ? <p className="muted">{patientName(patient)}</p> : null}
        <div className="patient-record-meta">
          <span>{patientAge === null ? 'Edad no registrada' : `${patientAge} años`}</span>
          <span>{psychologistName || 'Psicóloga no identificada'}</span>
          <span className="chip">{patient.status || 'Activo'}</span>
        </div>
      </div>
      <div className="patient-record-actions">
        <Link className="btn btn-secondary" href={`/appointments?patient=${patient.id}`}>Agendar cita</Link>
        <button className="btn btn-primary" onClick={() => setTab('notes')}>Nueva nota SOAP</button>
      </div>
    </section>

    {patient.clinical_alert ? <div className="clinical-alert record-alert"><strong>Alerta clínica</strong><span>{patient.clinical_alert}</span></div> : null}

    <nav className="record-tabs" aria-label="Secciones del expediente">
      {tabs.map(item => <button key={item.key} className={tab === item.key ? 'active' : ''} onClick={() => setTab(item.key)}>{item.icon}{item.label}</button>)}
    </nav>

    {tab === 'overview' ? <div className="record-grid">
      <section className="card record-main-card">
        <div className="section-heading"><div><span className="eyebrow">Datos generales</span><h2>Información del paciente</h2></div></div>
        <div className="detail-grid">
          <div><small>Nombre completo</small><strong>{patientName(patient)}</strong></div>
          <div><small>Fecha de nacimiento</small><strong>{patient.birth_date || 'No registrada'}</strong></div>
          <div><small>Edad</small><strong>{patientAge === null ? 'No registrada' : `${patientAge} años`}</strong></div>
          <div><small>Estado clínico</small><strong>{patient.status || 'Activo'}</strong></div>
        </div>
        <div className="contact-panel">
          <div><Phone size={18}/><span><small>Teléfono</small><strong>{patient.phone || 'No registrado'}</strong></span></div>
          <div><Mail size={18}/><span><small>Correo</small><strong>{patient.email || 'No registrado'}</strong></span></div>
        </div>
      </section>
      <aside className="card record-side-card">
        <span className="eyebrow">Seguimiento</span><h2>Próxima cita</h2>
        {nextAppointment?.starts_at ? <><strong className="next-appointment-date">{new Intl.DateTimeFormat('es-MX',{dateStyle:'long',timeStyle:'short'}).format(new Date(nextAppointment.starts_at))}</strong><p className="muted">{nextAppointment.consultation_mode || 'Consulta'} · {nextAppointment.status || 'Programada'}</p></> : <div className="empty-state compact-empty">No hay una cita futura registrada.</div>}
        <Link className="btn btn-primary" href={`/appointments?patient=${patient.id}`}>Programar cita</Link>
      </aside>
    </div> : null}

    {tab === 'appointments' ? <section className="card record-section"><div className="section-heading"><div><span className="eyebrow">Agenda</span><h2>Citas del paciente</h2></div><Link className="btn btn-primary" href={`/appointments?patient=${patient.id}`}>Nueva cita</Link></div>{appointments.length ? <div className="appointment-list">{appointments.map(item => <div className="appointment-item" key={item.id}><span className="appointment-dot"/><div><strong>{item.starts_at ? new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.starts_at)) : 'Fecha pendiente'}</strong><small>{item.consultation_mode || 'Consulta psicológica'}</small></div><span className="soft-chip">{item.status || 'Programada'}</span></div>)}</div> : <div className="empty-state">Aún no hay citas registradas.</div>}</section> : null}

    {tab === 'notes' ? <SoapNotesPanel patientId={patient.id} psychologistId={patient.psychologist_id} appointments={appointments} /> : null}
    {tab === 'evaluations' ? <RecordPlaceholder icon={<HeartPulse size={26}/>} title="Evaluaciones" text="Este espacio quedará preparado para escalas, resultados y seguimiento clínico." /> : null}
    {tab === 'files' ? <RecordPlaceholder icon={<FileText size={26}/>} title="Archivos clínicos" text="Aquí se concentrarán consentimientos, documentos, imágenes y archivos del paciente." /> : null}
    {tab === 'history' ? <RecordPlaceholder icon={<History size={26}/>} title="Historial de actividad" text="Mostrará cambios, citas, notas y eventos relevantes del expediente." /> : null}
  </>;
}

function RecordPlaceholder({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <section className="card record-placeholder"><div className="record-placeholder-icon">{icon}</div><h2>{title}</h2><p className="muted">{text}</p></section>;
}
