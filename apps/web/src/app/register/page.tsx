'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api<{ accessToken: string }>('/auth/register', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ name, email, password }),
      });
      setToken(res.accessToken);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Register failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <section className="panel auth-card fade-up" style={{ width: 'min(400px, 100%)' }}>
        <h1>Create account</h1>
        <p className="lead">HookPilot에서 웹훅 전송을 관리하세요.</p>
        <form onSubmit={onSubmit} className="form-stack">
          <div className="field">
            <label htmlFor="name">Name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password (min 8)</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          {error && <p className="alert alert-err">{error}</p>}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
          이미 계정이 있나요?{' '}
          <Link href="/" style={{ color: 'var(--accent)' }}>
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
