'use client';

import { FormEvent, useEffect, useState } from 'react';
import { FileSignature, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type Consent = {
  id: number;
  consent_type: string;
  document_version: string;
  document_text: string;
  signer_name?: string | null;
  signer_relationship?: string | null;
  signed_at?: string | null;
  revoked_at?: string | null;
  created_at: string;
};

type ConsentForm = {
  consent_type: string;
  document_version: string;
  document_text: string;
  signer_name: string;
  signer_relationship: string;
  signed: boolean;
};

const emptyForm = (): ConsentForm => ({ consent_type: 'Consentimiento informado', document_version: '1.0', document_text: '', signer_name: '', signer_relationship: 'Paciente', signed: false });

export function PatientConsentsPanel({ patientId }: { patientId: number }) {
  const [items, setItems] = useState<Consent[]>([]);
  const [form, setForm] = useState<ConsentForm>(emptyForm());
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    const supabase = getSupabaseBrowser();
    const { data, error: queryError } = await supabase.from('patient_consents').select('*').eq('patient_id', patientId).order('created_at', { ascending: false });
    if (queryError) setError(queryError.message);
    setItems((data || []) as Consent[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [patientId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.consent_type.trim() || !form.document_text.trim()) return;
    setSaving(true); setError('');
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from('patient_consents').insert({
      patient_id: patientId,
      consent_type: form.consent_type.trim(),
      document_version: form.document_version.trim() || '1.0',
      document_text: form.document_text.trim(),
      signer_name: form.signer_name.trim() || null,
      signer_relationship: form.signer_relationship.trim() || null,
      signed_at: form.signed ? new Date().toISOString() : null,
      created_by: user?.id || null,
    });
    if (insertError) setError(insertError.message);
    else { setOpen(false); setForm(emptyForm()); await load(); }
    setSaving(false);
  }

  async function revoke(item: Consent) {
    if (!window.confirm('¿Revocar este consentimiento? El registro se conservará para auditoría.')) return;
    const supabase = getSupabaseBrowser();
    const { error: updateError } = await supabase.from('patient_consents').update({ revoked_at: new Date().toISOString() }).eq('id', item.id);
    if (updateError) setError(updateError.message); else await load();
  }

  async function removeDraft(item: Consent) {
    if (item.signed_at) return;
    if (!window.confirm('¿Eliminar este consentimiento sin firma?')) return;
    const supabase = getSupabaseBrowser();
    const { error: deleteError } = await supabase.from('patient_consents').delete().eq('id', item.id);
    if (deleteError) setError(deleteError.message); else await load();
  }

  return <section className="card record-section">
    <div className="section-heading"><div><span className="eyebrow">Documentación legal</span><h2><FileSignature size={21}/> Consentimientos</h2><p className="muted">Registra versiones, firmantes y revocaciones sin perder trazabilidad.</p></div><button className="btn btn-primary" type="button" onClick={() => setOpen(true)}><Plus size={17}/> Nuevo consentimiento</button></div>
    {error ? <div className="clinical-alert"><strong>No fue posible completar la operación</strong><span>{error}</span></div> : null}
    {loading ? <div className="empty-state">Cargando consentimientos...</div> : null}
    {!loading && !items.length ? <div className="empty-state"><ShieldCheck size={30}/><h3>Sin consentimientos registrados</h3><p>Agrega el consentimiento informado o aviso de privacidad del paciente.</p></div> : null}
    {!loading && items.length ? <div style={{display:'grid',gap:12}}>{items.map(item => <article className="notice-card" key={item.id} style={{display:'grid',gap:8}}><div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'start'}}><div><strong>{item.consent_type}</strong><small className="muted" style={{display:'block'}}>Versión {item.document_version} · {new Intl.DateTimeFormat('es-MX',{dateStyle:'medium'}).format(new Date(item.created_at))}</small></div><span className="soft-chip">{item.revoked_at ? 'Revocado' : item.signed_at ? 'Firmado' : 'Pendiente'}</span></div>{item.signer_name ? <small>Firmante: {item.signer_name}{item.signer_relationship ? ` · ${item.signer_relationship}` : ''}</small> : null}<p className="muted" style={{whiteSpace:'pre-wrap'}}>{item.document_text.length > 260 ? `${item.document_text.slice(0,260)}…` : item.document_text}</p><div className="hero-actions">{item.signed_at && !item.revoked_at ? <button className="btn btn-secondary btn-small" type="button" onClick={() => void revoke(item)}>Revocar</button> : null}{!item.signed_at ? <button className="btn btn-secondary btn-small" type="button" onClick={() => void removeDraft(item)}><Trash2 size={15}/> Eliminar</button> : null}</div></article>)}</div> : null}
    {open ? <div className="therapy-goal-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}><form className="therapy-goal-modal card" onSubmit={submit}><div className="section-heading"><div><span className="eyebrow">Nuevo documento</span><h2>Consentimiento</h2></div><button className="icon-button" type="button" onClick={() => setOpen(false)}><X size={20}/></button></div><div className="form-grid"><label>Tipo<input required value={form.consent_type} onChange={e => setForm(current => ({...current,consent_type:e.target.value}))}/></label><label>Versión<input required value={form.document_version} onChange={e => setForm(current => ({...current,document_version:e.target.value}))}/></label><label style={{gridColumn:'1/-1'}}>Texto del consentimiento<textarea required rows={9} value={form.document_text} onChange={e => setForm(current => ({...current,document_text:e.target.value}))}/></label><label>Nombre del firmante<input value={form.signer_name} onChange={e => setForm(current => ({...current,signer_name:e.target.value}))}/></label><label>Relación<input value={form.signer_relationship} onChange={e => setForm(current => ({...current,signer_relationship:e.target.value}))} placeholder="Paciente, madre, padre, tutor..."/></label></div><label style={{display:'flex',gap:10,alignItems:'center',marginTop:14}}><input type="checkbox" checked={form.signed} onChange={e => setForm(current => ({...current,signed:e.target.checked}))}/> Marcar como firmado en este momento</label><div className="hero-actions"><button className="btn btn-secondary" type="button" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary" disabled={saving} type="submit">{saving?'Guardando...':'Guardar consentimiento'}</button></div></form></div> : null}
  </section>;
}