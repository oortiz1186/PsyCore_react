'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';

export type UserRole = {
  id: number;
  name: string;
};

type UserFormModalProps = {
  open: boolean;
  roles: UserRole[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: { fullName: string; email: string; roleId: number }) => Promise<void>;
};

const initialForm = {
  fullName: '',
  email: '',
  roleId: '',
};

export function UserFormModal({
  open,
  roles,
  saving,
  onClose,
  onSubmit,
}: UserFormModalProps) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setForm(initialForm);
      setError('');
    }
  }, [open]);

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

    try {
      await onSubmit({ fullName, email, roleId });
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
      description="Crea el acceso y asigna el rol que tendrá dentro de PsyCore."
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
