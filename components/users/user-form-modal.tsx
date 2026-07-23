'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/modal';

export type UserRole = {
  id: number;
  name: string;
};

export type PsychologistOption = {
  id: string;
  full_name?: string | null;
  email?: string | null;
};

type UserFormModalProps = {
  open: boolean;
  roles: UserRole[];
  psychologists: PsychologistOption[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: {
    fullName: string;
    email: string;
    roleId: number;
    psychologistId: string | null;
  }) => Promise<void>;
};

const initialForm = {
  fullName: '',
  email: '',
  roleId: '',
  psychologistId: '',
};

export function UserFormModal({
  open,
  roles,
  psychologists,
  saving,
  onClose,
  onSubmit,
}: UserFormModalProps) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === Number(form.roleId))?.name,
    [form.roleId, roles]
  );

  useEffect(() => {
    if (!open) {
      setForm(initialForm);
      setError('');
    }
  }, [open]);

  useEffect(() => {
    if (selectedRole !== 'Asistente') {
      setForm((current) => ({ ...current, psychologistId: '' }));
    }
  }, [selectedRole]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const fullName = form.fullName.trim();
    const email = form.email.trim().toLowerCase();
    const roleId = Number(form.roleId);

    if (!fullName || !email || !roleId) {
      setError('Captura nombre, correo y rol.');
      return;
    }

    if (selectedRole === 'Asistente' && !form.psychologistId) {
      setError('Selecciona la psicóloga responsable de esta asistente.');
      return;
    }

    try {
      await onSubmit({
        fullName,
        email,
        roleId,
        psychologistId: selectedRole === 'Asistente' ? form.psychologistId : null,
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No se pudo crear el usuario.'
      );
    }
  }

  return (
    <Modal
      open={open}
      title="Nuevo usuario"
      description="Crea el acceso, asigna el rol y define el alcance de información."
      onClose={onClose}
      closeDisabled={saving}
    >
      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          Nombre completo
          <input
            autoFocus
            value={form.fullName}
            onChange={(event) =>
              setForm((current) => ({ ...current, fullName: event.target.value }))
            }
            required
          />
        </label>

        <label className="field">
          Correo electrónico
          <input
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm((current) => ({ ...current, email: event.target.value }))
            }
            required
          />
        </label>

        <label className="field">
          Rol
          <select
            value={form.roleId}
            onChange={(event) =>
              setForm((current) => ({ ...current, roleId: event.target.value }))
            }
            required
          >
            <option value="">Selecciona</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>

        {selectedRole === 'Asistente' ? (
          <label className="field">
            Psicóloga responsable
            <select
              value={form.psychologistId}
              onChange={(event) =>
                setForm((current) => ({ ...current, psychologistId: event.target.value }))
              }
              required
            >
              <option value="">Selecciona una psicóloga</option>
              {psychologists.map((psychologist) => (
                <option key={psychologist.id} value={psychologist.id}>
                  {psychologist.full_name || psychologist.email || 'Psicóloga'}
                </option>
              ))}
            </select>
            <small className="muted">
              La asistente solamente podrá consultar la información de esta psicóloga.
            </small>
          </label>
        ) : null}

        {selectedRole === 'Psicóloga' ? (
          <div className="notice-card">
            La psicóloga quedará vinculada consigo misma y solo verá sus pacientes, citas y expedientes.
          </div>
        ) : null}

        {selectedRole === 'Recepcionista' ? (
          <div className="notice-card">
            La recepcionista tendrá acceso operativo a la información de todas las psicólogas.
          </div>
        ) : null}

        {error ? <div className="error">{error}</div> : null}

        <footer className="modal-actions">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Creando usuario...' : 'Crear y enviar acceso'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
