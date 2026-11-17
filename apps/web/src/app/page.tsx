'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email, password }),
      });
      setToken(res.accessToken);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function onDemoLogin() {
    setDemoLoading(true);
    setError('');
    try {
      const res = await api<{ accessToken: string }>('/auth/demo', {
        method: 'POST',
        auth: false,
      });
      setToken(res.accessToken);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo login failed');
    } finally {
      setDemoLoading(false);
    }
  }

  const busy = loading || demoLoading;

  return (
    <main className="shell" style={{ minHeight: '100vh', display: 'grid', alignItems: 'center' }}>
      <div className="fade-up home-grid">
        <section className="home-copy">
          <p className="mono home-kicker">WEBHOOK DELIVERY PLATFORM</p>
          <h1>HookPilot</h1>
          <p className="home-lead">
            웹훅이 제대로 전달됐는지, 실패했다면 왜 실패했는지 한곳에서 확인하세요.
          </p>
          <ul className="feature-list">
            <li>BullMQ + Redis 비동기 전송</li>
            <li>Exponential backoff 재시도</li>
            <li>Idempotency · HMAC-SHA256 서명</li>
          </ul>
        </section>

        <section className="panel auth-card">
          <h2>Sign in</h2>
          <p className="lead">대시보드에서 프로젝트와 전송 이력을 관리합니다.</p>

          <button
            className="btn btn-block"
            type="button"
            onClick={onDemoLogin}
            disabled={busy}
          >
            {demoLoading ? 'Entering demo…' : 'Demo로 체험하기'}
          </button>

          <div className="divider">또는 계정으로 로그인</div>

          <form onSubmit={onSubmit} className="form-stack">
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={busy}
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="current-password"
                disabled={busy}
              />
            </div>
            {error && <p className="alert alert-err">{error}</p>}
            <button className="btn btn-ghost" type="submit" disabled={busy}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
            계정이 없나요?{' '}
            <Link href="/register" style={{ color: 'var(--accent)' }}>
              회원가입
            </Link>
          </p>
          <p className="mono muted" style={{ marginTop: 8, fontSize: 11 }}>
            demo@hookpilot.test · password123
          </p>
        </section>
      </div>
    </main>
  );
}
