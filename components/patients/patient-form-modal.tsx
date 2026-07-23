'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';

export type PsychologistOption = { id: string; label: string };
export type PatientFormValues = {
  firstName: string;
  lastName: string;
  preferredName: string;
  email: string;
  phone: string;
  birthDate: string;
  psychologistId: string;
  status: string;
  clinicalAlert: string;
};

type Props = {
  open: boolean;
  saving: boolean;
  psychologists: PsychologistOption[];
  needsPsychologist: boolean;
  initialValues?: PatientFormValues | null;
  onClose: () => void;
  onSubmit: (values: PatientFormValues) => Promise<void>;
};

const emptyValues: PatientFormValues = {
  firstName: '', lastName: '', preferredName: '', email: '', phone: '', birthDate: '',
  psychologistId: '', status: 'Activo', clinicalAlert: '',
};

export function PatientFormModal({ open, saving, psychologists, needsPsychologist, initialValues, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<PatientFormValues>(emptyValues);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) setForm(initialValues || emptyValues);
    else { setForm(emptyValues); setError(''); }
  }, [open, initialValues]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!form.firstName.trim() || !form.lastName.trim()) return setError('Captura nombre y apellidos.');
    if (needsPsychologist && !form.psychologistId) return setError('Selecciona la psicóloga responsable.');
    try { await onSubmit({ ...form, firstName: form.firstName.trim(), lastName: form.lastName.trim() }); }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar el paciente.'); }
  }

  return <Modal open={open} title={initialValues ? 'Editar paciente' : 'Nuevo paciente'} description="Datos generales y asignación clínica." onClose={onClose} closeDisabled={saving}>
    <form className="form" onSubmit={submit}>
      <div className="two">
        <label className="field">Nombre<input autoFocus value={form.firstName} onChange={e=>setForm({...form,firstName:e.target.value})} required /></label>
        <label className="field">Apellidos<input value={form.lastName} onChange={e=>setForm({...form,lastName:e.target.value})} required /></label>
      </div>
      <label className="field">Nombre preferido<input value={form.preferredName} onChange={e=>setForm({...form,preferredName:e.target.value})} placeholder="Opcional" /></label>
      <div className="two">
        <label className="field">Correo<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></label>
        <label className="field">Teléfono<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} /></label>
      </div>
      <div className="two">
        <label className="field">Fecha de nacimiento<input type="date" value={form.birthDate} onChange={e=>setForm({...form,birthDate:e.target.value})} /></label>
        <label className="field">Estado<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>Activo</option><option>En pausa</option><option>Alta clínica</option></select></label>
      </div>
      {needsPsychologist ? <label className="field">Psicóloga responsable<select value={form.psychologistId} onChange={e=>setForm({...form,psychologistId:e.target.value})} required><option value="">Selecciona una psicóloga</option>{psychologists.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label> : null}
      <label className="field">Alerta clínica breve<textarea rows={3} value={form.clinicalAlert} onChange={e=>setForm({...form,clinicalAlert:e.target.value})} placeholder="Información importante visible en la ficha rápida" /></label>
      {error ? <div className="error">{error}</div> : null}
      <footer className="modal-actions"><button className="btn btn-secondary" type="button" onClick={onClose} disabled={saving}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving?'Guardando...':'Guardar paciente'}</button></footer>
    </form>
  </Modal>;
}
