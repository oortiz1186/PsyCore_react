'use client';

import { useEffect, useState } from 'react';
import { UserFormModal, UserRole } from '@/components/users/user-form-modal';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type User = {
  id: string;
  full_name?: string;
  email?: string;
  role_id?: number;
  active?: boolean;
  roles?: UserRole | UserRole[] | null;
};

type ApiPayload = {
  error?: unknown;
  passwordSent?: boolean;
  emailWarning?: string;
};

const ALLOWED_ROLES = ['Administrador', 'Asistente', 'Psicóloga', 'Recepcionista'];
const OPAQUE_ERRORS = new Set(['{}', '[object Object]', 'null', 'undefined']);

function readableApiError(value: unknown) {
  if (
    typeof value === 'string' &&
    value.trim() &&
    !OPAQUE_ERRORS.has(value.trim())
  ) {
    return value;
  }

  if (value && typeof value === 'object') {
    const candidate = value as { message?: unknown; details?: unknown; hint?: unknown };

    for (const item of [candidate.message, candidate.details, candidate.hint]) {
      if (
        typeof item === 'string' &&
        item.trim() &&
        !OPAQUE_ERRORS.has(item.trim())
      ) {
        return item;
      }
    }
  }

  return 'No se pudo crear el usuario. Revisa la terminal de Next.js para ver el detalle.';
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');

  async function load() {
    const supabase = getSupabaseBrowser();
    const [usersResult, rolesResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id,full_name,email,role_id,active,roles(id,name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('roles')
        .select('id,name')
        .in('name', ALLOWED_ROLES)
        .order('name'),
    ]);

    if (usersResult.error) setMsg(usersResult.error.message);
    else setUsers((usersResult.data || []) as User[]);

    if (rolesResult.error) setMsg(rolesResult.error.message);
    else setRoles((rolesResult.data || []) as UserRole[]);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createUser(values: {
    fullName: string;
    email: string;
    roleId: number;
  }) {
    setMsg('');
    setOk('');
    setSaving(true);

    try {
      const supabase = getSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('La sesión expiró. Inicia sesión nuevamente.');
      }

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(values),
      });

      const raw = await response.text();
      let data: ApiPayload = {};

      if (raw) {
        try {
          data = JSON.parse(raw) as ApiPayload;
        } catch {
          if (!response.ok) throw new Error(readableApiError(raw));
        }
      }

      if (!response.ok) {
        throw new Error(readableApiError(data.error));
      }

      if (data.passwordSent) {
        setOk('Usuario creado y correo enviado correctamente.');
      } else if (data.emailWarning) {
        setOk(data.emailWarning);
      } else {
        setOk('Usuario creado correctamente.');
      }

      setModalOpen(false);
      await load();
    } catch (error) {
      throw new Error(readableApiError(error));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(user: User) {
    const next = user.active === false;
    const { error } = await getSupabaseBrowser()
      .from('profiles')
      .update({ active: next })
      .eq('id', user.id);

    if (error) setMsg(error.message);
    else await load();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Administración de usuarios</h1>
          <p className="muted">Crea accesos directos y asigna roles.</p>
        </div>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => {
            setMsg('');
            setOk('');
            setModalOpen(true);
          }}
        >
          Nuevo usuario
        </button>
      </div>

      {msg ? <div className="error">{msg}</div> : null}
      {ok ? <div className="success">{ok}</div> : null}

      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const role = Array.isArray(user.roles)
                ? user.roles[0]?.name
                : user.roles?.name;

              return (
                <tr key={user.id}>
                  <td>{user.full_name || 'Sin nombre'}</td>
                  <td>{user.email || '—'}</td>
                  <td>{role || 'Sin rol'}</td>
                  <td>
                    <span className="chip">
                      {user.active === false ? 'Inactivo' : 'Activo'}
                    </span>
                  </td>
                  <td>
                    <button
                      className={`btn ${
                        user.active === false ? 'btn-secondary' : 'btn-danger'
                      }`}
                      type="button"
                      onClick={() => toggle(user)}
                    >
                      {user.active === false ? 'Activar' : 'Desactivar'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <UserFormModal
        open={modalOpen}
        roles={roles}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSubmit={createUser}
      />
    </>
  );
}
