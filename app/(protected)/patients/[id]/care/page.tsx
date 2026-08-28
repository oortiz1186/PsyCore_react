'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, HeartHandshake } from 'lucide-react';
import { PatientConsentsPanel } from '@/components/patients/patient-consents-panel';
import { TherapyHomeworkPanel } from '@/components/patients/therapy-homework-panel';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type Patient = { id:string; first_name?:string|null; last_name?:string|null; preferred_name?:string|null; psychologist_id?:string|null };

function nameOf(patient:Patient){return patient.preferred_name||`${patient.first_name||''} ${patient.last_name||''}`.trim()||'Paciente';}

export default function PatientCarePage(){
  const params=useParams<{id:string}>();const patientId=Number(params.id);const [patient,setPatient]=useState<Patient|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  useEffect(()=>{async function load(){if(!Number.isSafeInteger(patientId)||patientId<=0){setError('Paciente no válido.');setLoading(false);return;}const supabase=getSupabaseBrowser();const {data,error:queryError}=await supabase.from('patients').select('id,first_name,last_name,preferred_name,psychologist_id').eq('id',patientId).maybeSingle();if(queryError||!data)setError(queryError?.message||'No se encontró el paciente.');else setPatient(data as Patient);setLoading(false);}void load();},[patientId]);
  if(loading)return <div className="card empty-state">Cargando seguimiento...</div>;
  if(error||!patient)return <div className="card empty-state"><h2>No fue posible abrir el seguimiento</h2><p className="error">{error}</p><Link className="btn btn-secondary" href="/patients">Volver a pacientes</Link></div>;
  return <><div className="record-breadcrumb"><Link href={`/patients/${patient.id}`}><ArrowLeft size={15}/> Expediente</Link><span>/</span><strong>Seguimiento y consentimientos</strong></div><section className="patient-record-hero"><div className="patient-record-avatar"><HeartHandshake size={28}/></div><div className="patient-record-copy"><span className="eyebrow">Atención continua</span><h1>{nameOf(patient)}</h1><p className="muted">Consentimientos, documentación y actividades terapéuticas entre sesiones.</p></div><div className="patient-record-actions"><Link className="btn btn-secondary" href={`/patients/${patient.id}/clinical-plan`}>Historia y plan</Link><Link className="btn btn-primary" href={`/patients/${patient.id}`}>Expediente completo</Link></div></section><div style={{display:'grid',gap:20}}><PatientConsentsPanel patientId={patientId}/><TherapyHomeworkPanel patientId={patientId} psychologistId={patient.psychologist_id}/></div></>;
}