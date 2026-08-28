'use client';

import { FormEvent, useState } from 'react';
import { Copy, Link2, Send } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

export function PatientPortalInvitePanel({ patientId, defaultEmail }: { patientId: number; defaultEmail?: string | null }) {
  const [email, setEmail] = useState(defaultEmail || '');
  const [days, setDays] = useState(7);
  const [portalUrl, setPortalUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setPortalUrl(''); setCopied(false);
    try {
      const supabase = getSupabaseBrowser();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('La sesión expiró. Inicia sesión nuevamente.');
      const response = await fetch('/api/portal/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ patientId, email, expiresInDays: days }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo crear la invitación.');
      setPortalUrl(payload.portalUrl); setExpiresAt(payload.expiresAt);
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo crear la invitación.'); }
    finally { setSaving(false); }
  }

  async function copy() {
    if (!portalUrl) return;
    await navigator.clipboard.writeText(portalUrl);
    setCopied(true);
  }

  return <section className="card record-section"><div className="section-heading"><div><span className="eyebrow">Portal del paciente</span><h2><Link2 size={21}/> Crear acceso seguro</h2><p className="muted">Genera un enlace temporal para que el paciente consulte citas, tareas y consentimientos.</p></div></div>
    <form onSubmit={submit} className="form-grid"><label>Correo del paciente<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="paciente@correo.com"/></label><label>Vigencia<select value={days} onChange={e=>setDays(Number(e.target.value))}><option value={1}>1 día</option><option value={3}>3 días</option><option value={7}>7 días</option><option value={14}>14 días</option><option value={30}>30 días</option></select></label><div><button className="btn btn-primary" disabled={saving} type="submit"><Send size={17}/>{saving?'Generando...':'Generar invitación'}</button></div></form>
    {error?<div className="clinical-alert"><strong>No fue posible generar el acceso</strong><span>{error}</span></div>:null}
    {portalUrl?<div className="notice-card" style={{marginTop:18}}><strong>Enlace generado</strong><p className="muted" style={{wordBreak:'break-all'}}>{portalUrl}</p><p className="muted">Expira: {new Intl.DateTimeFormat('es-MX',{dateStyle:'long',timeStyle:'short'}).format(new Date(expiresAt))}</p><button type="button" className="btn btn-secondary" onClick={()=>void copy()}><Copy size={16}/>{copied?'Copiado':'Copiar enlace'}</button></div>:null}
  </section>;
}
