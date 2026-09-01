'use client';

import { FormEvent, useEffect, useState } from 'react';
import { FileHeart, Save } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type ClinicalHistory = {
  id?: number;
  reason_for_consultation: string;
  current_problem: string;
  personal_history: string;
  family_history: string;
  medical_history: string;
  psychosocial_history: string;
  initial_impression: string;
  diagnosis: string;
  protective_factors: string;
  risk_factors: string;
  status: 'active' | 'closed' | 'archived';
};

const emptyHistory = (): ClinicalHistory => ({
  reason_for_consultation: '', current_problem: '', personal_history: '', family_history: '',
  medical_history: '', psychosocial_history: '', initial_impression: '', diagnosis: '',
  protective_factors: '', risk_factors: '', status: 'active',
});

export function ClinicalHistoryPanel({ patientId, psychologistId, onSaved }: { patientId: number; psychologistId?: string | null; onSaved?: () => void }) {
  const [history, setHistory] = useState<ClinicalHistory>(emptyHistory());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true); setError('');
      const supabase = getSupabaseBrowser();
      const { data, error: queryError } = await supabase.from('clinical_histories').select('*').eq('patient_id', patientId).order('opened_at', { ascending: false }).limit(1).maybeSingle();
      if (queryError) setError(queryError.message);
      if (data) setHistory({ ...emptyHistory(), ...data } as ClinicalHistory);
      setLoading(false);
    }
    void load();
  }, [patientId]);

  function field(name: keyof ClinicalHistory, value: string) {
    setSaved(false);
    setHistory(current => ({ ...current, [name]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setSaved(false);
    const supabase = getSupabaseBrowser();
    const payload = { ...history, patient_id: patientId, psychologist_id: psychologistId || null, updated_at: new Date().toISOString() };
    const result = history.id
      ? await supabase.from('clinical_histories').update(payload).eq('id', history.id).select('*').single()
      : await supabase.from('clinical_histories').insert(payload).select('*').single();
    if (result.error) setError(result.error.message);
    else { setHistory(result.data as ClinicalHistory); setSaved(true); onSaved?.(); }
    setSaving(false);
  }

  if (loading) return <section className="card record-section"><div className="empty-state">Cargando historia clínica...</div></section>;

  return <form className="card record-section" onSubmit={submit}>
    <div className="section-heading"><div><span className="eyebrow">Expediente avanzado</span><h2><FileHeart size={21}/> Historia clínica</h2><p className="muted">Concentra antecedentes, formulación inicial, factores protectores y de riesgo.</p></div><button className="btn btn-primary" disabled={saving} type="submit"><Save size={17}/>{saving ? 'Guardando...' : 'Guardar historia'}</button></div>
    {error ? <div className="clinical-alert"><strong>No fue posible guardar</strong><span>{error}</span></div> : null}
    {saved ? <div className="notice-card">Historia clínica guardada correctamente.</div> : null}
    <div className="form-grid">
      <label>Motivo de consulta<textarea rows={3} value={history.reason_for_consultation} onChange={e => field('reason_for_consultation', e.target.value)}/></label>
      <label>Problema actual<textarea rows={3} value={history.current_problem} onChange={e => field('current_problem', e.target.value)}/></label>
      <label>Antecedentes personales<textarea rows={3} value={history.personal_history} onChange={e => field('personal_history', e.target.value)}/></label>
      <label>Antecedentes familiares<textarea rows={3} value={history.family_history} onChange={e => field('family_history', e.target.value)}/></label>
      <label>Antecedentes médicos<textarea rows={3} value={history.medical_history} onChange={e => field('medical_history', e.target.value)}/></label>
      <label>Historia psicosocial<textarea rows={3} value={history.psychosocial_history} onChange={e => field('psychosocial_history', e.target.value)}/></label>
      <label>Impresión clínica inicial<textarea rows={3} value={history.initial_impression} onChange={e => field('initial_impression', e.target.value)}/></label>
      <label>Diagnóstico / hipótesis diagnóstica<textarea rows={3} value={history.diagnosis} onChange={e => field('diagnosis', e.target.value)}/></label>
      <label>Factores protectores<textarea rows={3} value={history.protective_factors} onChange={e => field('protective_factors', e.target.value)}/></label>
      <label>Factores de riesgo<textarea rows={3} value={history.risk_factors} onChange={e => field('risk_factors', e.target.value)}/></label>
      <label>Estado<select value={history.status} onChange={e => field('status', e.target.value)}><option value="active">Activa</option><option value="closed">Cerrada</option><option value="archived">Archivada</option></select></label>
    </div>
  </form>;
}