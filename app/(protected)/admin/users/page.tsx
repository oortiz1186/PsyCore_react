'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  PsychologistOption,
  UserFormModal,
  UserRole,
} from '@/components/users/user-form-modal';
import { UserEditModal } from '@/components/users/user-edit-modal';
import { UserAccessModal } from '@/components/users/user-access-modal';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type User = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  role_id?: number | null;
  active?: boolean | null;
  psychologist_id?: string | null;
  psychologist_name?: string | null;
  roles?: UserRole | UserRole[] | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
  creator_name?: string | null;
};

type ApiPayload = {
  error?: unknown;
  users?: User[];
  passwordSent?: boolean;
  emailWarning?: string;
  email?: string;
};

const ALLOWED_ROLES = ['Administrador', 'Asistente', 'Psicóloga', 'Recepcionista'];

function roleName(user: User) {
  return Array.isArray(user.roles) ? user.roles[0]?.name : user.roles?.name;
}

function errorText(value: unknown, fallback = 'Ocurrió un error inesperado.') {
  if (value instanceof Error && value.message) return value.message;
  if (typeof value === 'string' && value.trim() && value.trim() !== '{}') return value;
  if (value && typeof value === 'object') {
    const item = value as { message?: unknown; details?: unknown; hint?: unknown };
    for (const candidate of [item.message, item.details, item.hint]) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate;
    }
  }
  return fallback;
}

function formatDate(value?: string | null) {
  if (!value) return 'Nunca';
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [accessUser, setAccessUser] = useState<User | null>(null);
  const [accessAction, setAccessAction] = useState<'reset-access' | 'resend-access'>('reset-access');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');

  const psychologists = useMemo<PsychologistOption[]>(
    () => users
      .filter((user) => roleName(user) === 'Psicóloga' && user.active !== false)
      .map((user) => ({ id: user.id, full_name: user.full_name, email: user.email })),
    [users]
  );

  async function authHeaders() {
    const { data: { session } } = await getSupabaseBrowser().auth.getSession();
    if (!session?.access_token) throw new Error('La sesión expiró. Inicia sesión nuevamente.');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    };
  }

  async function readResponse(response: Response) {
    const raw = await response.text();
    let data: ApiPayload = {};
    if (raw) {
      try { data = JSON.parse(raw) as ApiPayload; }
      catch { if (!response.ok) throw new Error(raw); }
    }
    if (!response.ok) throw new Error(errorText(data.error, 'No se pudo completar la operación.'));
    return data;
  }

  async function load() {
    setMsg('');
    try {
      const supabase = getSupabaseBrowser();
      const [{ data: sessionData }, rolesResult] = await Promise.all([
        supabase.auth.getSession(),
        supabase.from('roles').select('id,name').in('name', ALLOWED_ROLES).order('name'),
      ]);
      if (!sessionData.session?.access_token) throw new Error('La sesión expiró.');
      const response = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });
      const data = await readResponse(response);
      setUsers(data.users || []);
      if (rolesResult.error) throw rolesResult.error;
      setRoles((rolesResult.data || []) as UserRole[]);
    } catch (error) {
      setMsg(errorText(error, 'No se pudieron cargar los usuarios.'));
    }
  }

  useEffect(() => { void load(); }, []);

  async function createUser(values: {
    fullName: string;
    email: string;
    roleId: number;
    psychologistId: string | null;
  }) {
    setSaving(true); setMsg(''); setOk('');
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST', headers: await authHeaders(), body: JSON.stringify(values),
      });
      const data = await readResponse(response);
      setOk(data.passwordSent ? 'Usuario creado y correo enviado correctamente.' : data.emailWarning || 'Usuario creado correctamente.');
      setNewOpen(false);
      await load();
    } finally { setSaving(false); }
  }

  async function updateUser(values: { fullName: string; roleId: number; active: boolean }) {
    if (!editing) return;
    setSaving(true); setMsg(''); setOk('');
    try {
      const response = await fetch(`/api/admin/users/${editing.id}`, {
        method: 'PATCH', headers: await authHeaders(), body: JSON.stringify(values),
      });
      await readResponse(response);
      setOk('Usuario actualizado correctamente.');
      setEditing(null);
      await load();
    } finally { setSaving(false); }
  }

  async function confirmAccess() {
    if (!accessUser) return;
    setSaving(true); setMsg(''); setOk('');
    try {
      const response = await fetch(`/api/admin/users/${accessUser.id}`, {
        method: 'POST', headers: await authHeaders(), body: JSON.stringify({ action: accessAction }),
      });
      const data = await readResponse(response);
      setOk(`Se generó una nueva contraseña temporal y se envió a ${data.email || accessUser.email}.`);
      setAccessUser(null);
      await load();
    } catch (error) {
      setMsg(errorText(error, 'No se pudo enviar el acceso.'));
    } finally { setSaving(false); }
  }

  function openAccess(user: User, action: 'reset-access' | 'resend-access') {
    setMsg(''); setOk(''); setAccessAction(action); setAccessUser(user);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Administración de usuarios</h1>
          <p className="muted">Accesos, roles, psicóloga responsable y auditoría del personal.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => { setMsg(''); setOk(''); setNewOpen(true); }}>Nuevo usuario</button>
      </div>

      {msg ? <div className="error">{msg}</div> : null}
      {ok ? <div className="success">{ok}</div> : null}

      <div className="card table-wrap">
        <table className="table users-admin-table">
          <thead><tr><th>Usuario</th><th>Rol</th><th>Psicóloga vinculada</th><th>Estado</th><th>Último acceso</th><th>Creado por</th><th>Acciones</th></tr></thead>
          <tbody>
            {users.map((user) => {
              const role = roleName(user);
              return (
                <tr key={user.id}>
                  <td><strong>{user.full_name || 'Sin nombre'}</strong><small className="table-subtext">{user.email || '—'}</small></td>
                  <td>{role || 'Sin rol'}</td>
                  <td>
                    {role === 'Psicóloga'
                      ? 'Ella misma'
                      : role === 'Asistente'
                        ? user.psychologist_name || 'Sin asignar'
                        : 'Acceso general'}
                  </td>
                  <td><span className={`chip ${user.active === false ? 'chip-inactive' : ''}`}>{user.active === false ? 'Inactivo' : 'Activo'}</span></td>
                  <td>{formatDate(user.last_sign_in_at)}</td>
                  <td>{user.creator_name || 'Registro anterior'}</td>
                  <td>
                    <div className="row-actions wrap-actions">
                      <button className="btn btn-secondary btn-small" type="button" onClick={() => setEditing(user)}>Editar</button>
                      <button className="btn btn-secondary btn-small" type="button" onClick={() => openAccess(user, 'reset-access')}>Restablecer contraseña</button>
                      <button className="btn btn-secondary btn-small" type="button" onClick={() => openAccess(user, 'resend-access')}>Reenviar acceso</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <UserFormModal
        open={newOpen}
        roles={roles}
        psychologists={psychologists}
        saving={saving}
        onClose={() => setNewOpen(false)}
        onSubmit={createUser}
      />
      <UserEditModal open={Boolean(editing)} user={editing} roles={roles} saving={saving} onClose={() => setEditing(null)} onSubmit={updateUser} />
      <UserAccessModal
        open={Boolean(accessUser)}
        userName={accessUser?.full_name || 'Usuario'}
        userEmail={accessUser?.email || ''}
        action={accessAction}
        saving={saving}
        onClose={() => setAccessUser(null)}
        onConfirm={confirmAccess}
      />
    </>
  );
}
