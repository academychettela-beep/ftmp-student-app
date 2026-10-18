import React, { useEffect, useState } from 'react';
import { getSession, onAuthChange, signIn, signUp, ensureStudentRow } from '../lib/api.js';

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSession().then(setSession);
    const sub = onAuthChange((s) => setSession(s));
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) ensureStudentRow(session.user);
  }, [session]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const fn = mode === 'signin' ? signIn : signUp;
    const { error } = await fn(email, password);
    setBusy(false);
    if (error) setError(error.message);
  }

  if (session === undefined) {
    return <div className="p-6 text-sm" style={{ color: '#6B6A62' }}>Loading…</div>;
  }

  if (session) return children;

  return (
    <div style={{ background: 'var(--parchment)', minHeight: '600px' }} className="w-full flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} style={{ background: 'white', borderColor: 'var(--parchment-line)' }} className="border rounded p-6 w-full max-w-sm">
        <div style={{ fontFamily: '"Cormorant Garamond", serif', color: 'var(--navy)' }} className="text-xl font-semibold mb-1">
          Chettela Forex Academy
        </div>
        <div style={{ fontFamily: 'Montserrat, sans-serif', color: 'var(--gold-ink)' }} className="text-xs mb-5">
          {mode === 'signin' ? 'Sign in to continue' : 'Create your student account'}
        </div>

        <label className="block text-xs mb-1" style={{ color: '#6B6A62' }}>Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ borderColor: 'var(--parchment-line)' }}
          className="w-full border rounded px-3 py-2 text-sm mb-3"
        />

        <label className="block text-xs mb-1" style={{ color: '#6B6A62' }}>Password</label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ borderColor: 'var(--parchment-line)' }}
          className="w-full border rounded px-3 py-2 text-sm mb-4"
        />

        {error && <p className="text-xs mb-3" style={{ color: '#A65D57' }}>{error}</p>}

        <button
          type="submit"
          disabled={busy}
          style={{ background: 'var(--navy)', color: 'white', fontFamily: 'Montserrat, sans-serif', opacity: busy ? 0.6 : 1 }}
          className="w-full text-sm px-4 py-2 rounded mb-3"
        >
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          className="w-full text-xs"
          style={{ color: 'var(--gold-ink)' }}
        >
          {mode === 'signin' ? "New here? Create an account" : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}
