'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { PatientPortalInvitePanel } from '@/components/patients/patient-portal-invite-panel';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type Patient = { id: number; first_name?: string | null; last_name?: string | null; preferred_name?: string | null; email?: string | null };

export default function PatientPortalManagementPage() {
  const params = useParams<{ id: string }>();
  const patientId = Number(params.id);
  const [patient,setPatient]=useState<Patient|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  useEffect(()=>{async function load(){if(!Number.isSafeInteger(patientId)||patientId<=0){setError('Paciente no válido.');setLoading(false);return;}const supabase=getSupabaseBrowser();const {data,error:queryError}=await supabase.from('patients').select('id,first_name,last_name,preferred_name,email').eq('id',patientId).maybeSingle();if(queryError||!data)setError(queryError?.message||'Paciente no encontrado.');else setPatient(data as Patient);setLoading(false);}void load();},[patientId]);

  if(loading)return <div className="card empty-state">Cargando portal...</div>;
  if(error||!patient)return <div className="card empty-state"><h2>No se pudo abrir la administración del portal</h2><p className="error">{error}</p><Link className="btn btn-secondary" href="/patients">Volver a pacientes</Link></div>;
  const name=patient.preferred_name||`${patient.first_name||''} ${patient.last_name||''}`.trim()||'Paciente';

  return <><div className="record-breadcrumb"><Link href={`/patients/${patient.id}`}><ArrowLeft size={15}/> Expediente</Link><span>/</span><strong>Portal del paciente</strong></div><section className="patient-record-hero"><div className="patient-record-copy"><span className="eyebrow">Acceso del paciente</span><h1>{name}</h1><p className="muted">Genera enlaces temporales para acceso de solo lectura al portal.</p></div><div className="patient-record-actions"><Link className="btn btn-secondary" href={`/patients/${patient.id}/care`}>Seguimiento</Link><Link className="btn btn-secondary" href={`/patients/${patient.id}`}><ExternalLink size={16}/> Expediente</Link></div></section><PatientPortalInvitePanel patientId={patientId} defaultEmail={patient.email}/></>;
}
