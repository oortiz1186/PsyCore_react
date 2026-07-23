'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import {
  clearSessionActivity,
  markSessionActivity,
  sessionIsExpired,
} from '@/lib/session-activity';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;

    void (async () => {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase.auth.getSession();

      if (!active) return;

      if (!data.session) {
        setCheckingSession(false);
        return;
      }

      if (sessionIsExpired()) {
        await supabase.auth.signOut();
        clearSessionActivity();
        setCheckingSession(false);
        return;
      }

      markSessionActivity();

      const { data: profile } = await supabase
        .from('profiles')
        .select('active,must_change_password')
        .eq('id', data.session.user.id)
        .maybeSingle();

      if (profile?.active === false) {
        await supabase.auth.signOut();
        clearSessionActivity();
        setCheckingSession(false);
        return;
      }

      router.replace(profile?.must_change_password ? '/change-password' : '/dashboard');
    })();

    return () => {
      active = false;
    };
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const supabase = getSupabaseBrowser();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('active,must_change_password')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profile?.active === false) {
      await supabase.auth.signOut();
      clearSessionActivity();
      setError('Tu acceso está desactivado.');
      setLoading(false);
      return;
    }

    markSessionActivity();
    router.replace(profile?.must_change_password ? '/change-password' : '/dashboard');
  }

  if (checkingSession) {
    return <main className="auth">Recuperando sesión...</main>;
  }

  return (
    <main className="auth">
      <section className="auth-card">
        <div className="brand">
          <div className="brand-mark">Ψ</div>
          <div>
            <h1>PsyCore</h1>
            <p className="muted">Gestión psicológica</p>
          </div>
        </div>

        <form className="form" onSubmit={submit}>
          <label className="field">
            Correo
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="field">
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error ? <div className="error">{error}</div> : null}

          <button className="btn btn-primary" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}
