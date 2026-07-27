'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, ClipboardList, FilePlus2, HeartPulse, Plus, UserPlus, UsersRound } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import styles from './dashboard.module.css';

type Appointment = {
  id: string;
  starts_at?: string | null;
  status?: string | null;
  consultation_mode?: string | null;
  patients?: { id?: string; first_name?: string | null; last_name?: string | null; full_name?: string | null } | null;
};

type Patient = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  preferred_name?: string | null;
  status?: string | null;
  clinical_alert?: string | null;
  created_at?: string | null;
};

type Stats = { patients: number; today: number; upcoming: number; soap: number };

function patientName(patient?: Patient | Appointment['patients'] | null) {
  if (!patient) return 'Paciente';
  if ('preferred_name' in patient && patient.preferred_name) return patient.preferred_name;
  if ('full_name' in patient && patient.full_name) return patient.full_name;
  return `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Paciente';
}

function initials(patient: Patient) {
  return patientName(patient).split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ patients: 0, today: 0, upcoming: 0, soap: 0 });
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [recentPatients, setRecentPatients] = useState<Patient[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      const supabase = getSupabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date();
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

      const [profile, patientsCount, todayCount, upcomingCount, soapCount, agenda, patients] = await Promise.all([
        user ? supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('patients').select('*', { count: 'exact', head: true }),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).gte('starts_at', todayStart.toISOString()).lte('starts_at', todayEnd.toISOString()),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).gte('starts_at', now.toISOString()),
        supabase.from('soap_notes').select('*', { count: 'exact', head: true }),
        supabase.from('appointments').select('id,starts_at,status,consultation_mode,patients(id,first_name,last_name)').gte('starts_at', todayStart.toISOString()).lte('starts_at', todayEnd.toISOString()).order('starts_at').limit(12),
        supabase.from('patients').select('id,first_name,last_name,preferred_name,status,clinical_alert,created_at').order('created_at', { ascending: false }).limit(6),
      ]);

      setName(profile.data?.full_name?.split(' ')[0] || '');
      setStats({
        patients: patientsCount.count || 0,
        today: todayCount.count || 0,
        upcoming: upcomingCount.count || 0,
        soap: soapCount.count || 0,
      });
      setTodayAppointments((agenda.data || []) as Appointment[]);
      setRecentPatients((patients.data || []) as Patient[]);
      setLoading(false);
    }

    void loadDashboard();
  }, []);

  const alerts = useMemo(() => recentPatients.filter((patient) => Boolean(patient.clinical_alert)), [recentPatients]);
  const greeting = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  if (loading) return <div className={`card ${styles.loading}`}>Preparando tu panel clínico...</div>;

  const cards = [
    { label: 'Pacientes', value: stats.patients, icon: <UsersRound size={22} /> },
    { label: 'Citas de hoy', value: stats.today, icon: <CalendarDays size={22} /> },
    { label: 'Próximas citas', value: stats.upcoming, icon: <HeartPulse size={22} /> },
    { label: 'Notas SOAP', value: stats.soap, icon: <ClipboardList size={22} /> },
  ];

  return <>
    <section className="dashboard-hero">
      <div>
        <span className="eyebrow">Panel clínico</span>
        <h1>{name ? `Hola, ${name}` : 'Bienvenida a PsyCore'}</h1>
        <p>Hoy es {greeting}. Aquí tienes la actividad principal de tu consultorio.</p>
      </div>
      <div className="hero-actions">
        <Link className="btn btn-primary" href="/appointments"><Plus size={17} /> Nueva cita</Link>
        <Link className="btn btn-secondary" href="/patients"><UserPlus size={17} /> Nuevo paciente</Link>
      </div>
    </section>

    <section className={styles.summaryGrid}>
      {cards.map((card) => <article className={styles.summaryCard} key={card.label}>
        <span className={styles.summaryIcon}>{card.icon}</span>
        <div><small>{card.label}</small><strong>{card.value}</strong></div>
      </article>)}
    </section>

    <section className={styles.contentGrid}>
      <article className="card">
        <div className="section-heading">
          <div><span className="eyebrow">Agenda del día</span><h2>Sesiones de hoy</h2></div>
          <Link href="/appointments" className="text-link">Ver agenda</Link>
        </div>
        {todayAppointments.length ? <div className={styles.list}>{todayAppointments.map((appointment) => <div className={styles.listItem} key={appointment.id}>
          <span className="appointment-dot" />
          <div className={styles.listCopy}>
            <strong>{patientName(appointment.patients)}</strong>
            <small>{formatDate(appointment.starts_at)} · {appointment.consultation_mode || 'Consulta psicológica'}</small>
          </div>
          <span className="soft-chip">{appointment.status || 'Programada'}</span>
        </div>)}</div> : <div className="empty-state">No hay sesiones programadas para hoy.</div>}
      </article>

      <div className={styles.stack}>
        <article className="card">
          <div className="section-heading"><div><span className="eyebrow">Acciones rápidas</span><h2>Registrar actividad</h2></div></div>
          <div className={styles.quickActions}>
            <Link className={styles.quickAction} href="/appointments"><CalendarDays size={18} /> Nueva cita</Link>
            <Link className={styles.quickAction} href="/patients"><UserPlus size={18} /> Paciente</Link>
            <Link className={styles.quickAction} href="/clinical-records"><ClipboardList size={18} /> Expediente</Link>
            <Link className={styles.quickAction} href="/patients"><FilePlus2 size={18} /> Archivo</Link>
          </div>
        </article>

        <article className="card">
          <div className="section-heading"><div><span className="eyebrow">Alertas clínicas</span><h2>Requieren atención</h2></div><span className="count-badge">{alerts.length}</span></div>
          {alerts.length ? <div className={styles.alertList}>{alerts.map((patient) => <Link className={styles.alertItem} href={`/patients/${patient.id}`} key={patient.id}>
            <AlertTriangle size={18} />
            <div><strong>{patientName(patient)}</strong><span>{patient.clinical_alert}</span></div>
          </Link>)}</div> : <div className="empty-state">No hay alertas clínicas entre los pacientes recientes.</div>}
        </article>
      </div>
    </section>

    <article className="card">
      <div className="section-heading">
        <div><span className="eyebrow">Pacientes recientes</span><h2>Expedientes agregados recientemente</h2></div>
        <Link href="/patients" className="text-link">Ver pacientes</Link>
      </div>
      {recentPatients.length ? <div className={styles.list}>{recentPatients.map((patient) => <Link href={`/patients/${patient.id}`} className={styles.listItem} key={patient.id}>
        <span className={styles.avatar}>{initials(patient)}</span>
        <div className={styles.listCopy}><strong>{patientName(patient)}</strong><small>Registrado {formatDate(patient.created_at)}</small></div>
        <span className="soft-chip">{patient.status || 'Activo'}</span>
      </Link>)}</div> : <div className="empty-state">Todavía no hay pacientes registrados.</div>}
    </article>
  </>;
}
