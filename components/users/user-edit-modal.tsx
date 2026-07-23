'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import type { UserRole } from '@/components/users/user-form-modal';

export type EditableUser = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  role_id?: number | null;
  active?: boolean | null;
};

type Props = {
  open: boolean;
  user: EditableUser | null;
  roles: UserRole[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: { fullName: string; roleId: number; active: boolean }) => Promise<void>;
};

export function UserEditModal({ open, user, roles, saving, onClose, onSubmit }: Props) {
  const [fullName, setFullName] = useState('');
  const [roleId, setRoleId] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && user) {
      setFullName(user.full_name || '');
      setRoleId(user.role_id ? String(user.role_id) : '');
      setActive(user.active !== false);
      setError('');
    }
  }, [open, user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const name = fullName.trim();
    const role = Number(roleId);
    if (!name || !role) {
      setError('Captura nombre y rol.');
      return;
    }
    try {
      await onSubmit({ fullName: name, roleId: role, active });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo actualizar el usuario.');
    }
  }

  return (
    <Modal
      open={open}
      title="Editar usuario"
      description={user?.email || 'Actualiza los datos y permisos del usuario.'}
      onClose={onClose}
      closeDisabled={saving}
    >
      <form className="form" onSubmit={submit}>
        <label className="field">
          Nombre completo
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
        </label>
        <label className="field">
          Rol
          <select value={roleId} onChange={(event) => setRoleId(event.target.value)} required>
            <option value="">Selecciona</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </select>
        </label>
        <label className="check-row">
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
          Usuario activo
        </label>
        {error ? <div className="error">{error}</div> : null}
        <footer className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
