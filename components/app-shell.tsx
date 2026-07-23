'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import {
  clearSessionActivity,
  getLastSessionActivity,
  markSessionActivity,
  SESSION_ACTIVITY_KEY,
  SESSION_TIMEOUT_MS,
  sessionIsExpired,
} from '@/lib/session-activity';

type Profile = {
  full_name?: string | null;
  email?: string | null;
  active?: boolean | null;
  must_change_password?: boolean | null;
  roles?: { name?: string } | { name?: string }[] | null;
};

const links = [
  ['/dashboard', 'Inicio', '⌂'],
  ['/patients', 'Pacientes', '♡'],
  ['/appointments', 'Agenda', '◷'],
  ['/clinical-records', 'Expedientes', '▤'],
  ['/admin/users', 'Usuarios', '♙'],
  ['/settings/smtp', 'Configuración SMTP', '⚙'],
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const activityThrottleRef = useRef(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem('psycore-sidebar-collapsed');
    setCollapsed(stored === 'true');
  }, []);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowser();

    async function closeExpiredSession() {
      if (!active) return;
      await supabase.auth.signOut();
      clearSessionActivity();
      setReady(false);
      router.replace('/login?reason=expired');
    }

    async function restoreSession() {
      const { data } = await supabase.auth.getSession();

      if (!active) return;

      if (!data.session) {
        clearSessionActivity();
        router.replace('/login');
        return;
      }

      if (sessionIsExpired()) {
        await closeExpiredSession();
        return;
      }

      if (getLastSessionActivity() === null) {
        markSessionActivity();
      }

      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('full_name,email,active,must_change_password,roles(name)')
        .eq('id', data.session.user.id)
        .maybeSingle();

      if (!active) return;

      if (currentProfile?.active === false) {
        await supabase.auth.signOut();
        clearSessionActivity();
        router.replace('/login');
        return;
      }

      if (currentProfile?.must_change_password && path !== '/change-password') {
        router.replace('/change-password');
        return;
      }

      setProfile({
        ...currentProfile,
        email: currentProfile?.email || data.session.user.email,
      });
      setReady(true);
    }

    void restoreSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        clearSessionActivity();
        setReady(false);
        router.replace('/login');
      }
    });

    const activityEvents: Array<keyof WindowEventMap> = [
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
    ];

    const registerActivity = () => {
      const now = Date.now();
      if (now - activityThrottleRef.current < 60_000) return;
      activityThrottleRef.current = now;
      markSessionActivity(now);
    };

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, registerActivity, { passive: true });
    });

    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        if (sessionIsExpired()) void closeExpiredSession();
        else registerActivity();
      }
    };

    const storageHandler = (event: StorageEvent) => {
      if (event.key !== SESSION_ACTIVITY_KEY) return;
      if (sessionIsExpired()) void closeExpiredSession();
    };

    document.addEventListener('visibilitychange', visibilityHandler);
    window.addEventListener('storage', storageHandler);

    const expirationTimer = window.setInterval(() => {
      if (sessionIsExpired()) void closeExpiredSession();
    }, 60_000);

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, registerActivity);
      });
      document.removeEventListener('visibilitychange', visibilityHandler);
      window.removeEventListener('storage', storageHandler);
      window.clearInterval(expirationTimer);
    };
  }, [path, router]);

  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem('psycore-sidebar-collapsed', String(next));
  }

  async function logout() {
    await getSupabaseBrowser().auth.signOut();
    clearSessionActivity();
    router.replace('/login');
  }

  if (!ready) return <main className="auth">Cargando PsyCore...</main>;

  const role = Array.isArray(profile?.roles)
    ? profile?.roles[0]?.name
    : profile?.roles?.name;

  const initials = (profile?.full_name || profile?.email || 'U')
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <div className={`shell ${collapsed ? 'shell-collapsed' : ''}`}>
      <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark">Ψ</div>
            {!collapsed ? (
              <div>
                <strong>PsyCore</strong>
                <div className="muted brand-caption">Gestión psicológica</div>
              </div>
            ) : null}
          </div>

          <div className="sidebar-user" ref={menuRef}>
            <button
              type="button"
              className="sidebar-user-button"
              onClick={() => setUserMenuOpen((current) => !current)}
              aria-expanded={userMenuOpen}
            >
              <span className="user-avatar">{initials}</span>
              {!collapsed ? (
                <span className="user-copy">
                  <strong>{profile?.full_name || 'Usuario'}</strong>
                  <small>{role || 'PsyCore'}</small>
                </span>
              ) : null}
              {!collapsed ? (
                <span className={`user-caret ${userMenuOpen ? 'open' : ''}`}>▾</span>
              ) : null}
            </button>

            {userMenuOpen ? (
              <div className={`user-popover ${collapsed ? 'user-popover-collapsed' : ''}`}>
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    router.push('/change-password');
                  }}
                >
                  Cambiar contraseña
                </button>
                <button type="button" className="danger-link" onClick={logout}>
                  Cerrar sesión
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <nav className="nav">
          {links.map(([href, label, icon]) => (
            <Link
              key={href}
              href={href}
              className={path === href ? 'nav-link active' : 'nav-link'}
              title={collapsed ? label : undefined}
            >
              <span className="nav-icon">{icon}</span>
              {!collapsed ? <span>{label}</span> : null}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className="sidebar-toggle"
          onClick={toggleSidebar}
          title={collapsed ? 'Mostrar menú' : 'Ocultar menú'}
          aria-label={collapsed ? 'Mostrar menú' : 'Ocultar menú'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
