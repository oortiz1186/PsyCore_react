'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, FileHeart, Target } from 'lucide-react';
import { ClinicalHistoryPanel } from '@/components/patients/clinical-history-panel';
import { TreatmentPlanPanel } from '@/components/patients/treatment-plan-panel';
import { TherapyGoalsPanel } from '@/components/patients/therapy-goals-panel';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type Patient = { id: string; first_name?: string | null; last_name?: string | null; preferred_name?: string | null; psychologist_id?: string | null };

export default function ClinicalPlanPage() {
  const params = useParams<{ id: string }>();
  const patientId = Number(params.id);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      if (!Number.isSafeInteger(patientId) || patientId <= 0) { setError('Paciente no válido.'); setLoading(false); return; }
      const supabase = getSupabaseBrowser();
      const { data, error: queryError } = await supabase.from('patients').select('id,first_name,last_name,preferred_name,psychologist_id').eq('id', patientId).maybeSingle();
      if (queryError || !data) setError(queryError?.message || 'No se encontró el paciente.');
      else setPatient(data as Patient);
      setLoading(false);
    }
    void load();
  }, [patientId]);

  if (loading) return <div className="card empty-state">Cargando plan clínico...</div>;
  if (error || !patient) return <div className="card empty-state"><h2>No fue posible abrir el plan clínico</h2><p className="error">{error}</p><Link className="btn btn-secondary" href={`/patients/${patientId}`}>Volver</Link></div>;

  const name = patient.preferred_name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Paciente';
  return <>
    <div className="record-breadcrumb"><Link href={`/patients/${patient.id}`}><ArrowLeft size={15}/> Expediente</Link><span>/</span><strong>Historia y tratamiento</strong></div>
    <section className="patient-record-hero"><div className="patient-record-avatar"><FileHeart size={28}/></div><div className="patient-record-copy"><span className="eyebrow">Área clínica</span><h1>Historia y plan de {name}</h1><p className="muted">Un espacio integrado para documentar el caso, definir el tratamiento y medir sus objetivos.</p></div><div className="patient-record-actions"><Link className="btn btn-secondary" href={`/patients/${patient.id}`}>Expediente completo</Link></div></section>
    <div className="notice-card" style={{ marginBottom: 20 }}><Target size={18}/><span>Los objetivos terapéuticos se mantienen vinculados al expediente y pueden actualizarse conforme avanza el tratamiento.</span></div>
    <div style={{ display: 'grid', gap: 20 }}>
      <ClinicalHistoryPanel patientId={patientId} psychologistId={patient.psychologist_id}/>
      <TreatmentPlanPanel patientId={patientId} psychologistId={patient.psychologist_id}/>
      <TherapyGoalsPanel patientId={patientId} psychologistId={patient.psychologist_id}/>
    </div>
  </>;
}