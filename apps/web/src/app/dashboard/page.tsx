'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { api, User } from '@/lib/api';

type Project = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  _count: { endpoints: number; events: number; apiKeys: number };
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const me = await api<User>('/auth/me');
        setUser(me);
        const list = await api<Project[]>('/projects');
        setProjects(list);
      } catch {
        router.replace('/');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function createProject(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const project = await api<Project>('/projects', {
        method: 'POST',
        body: JSON.stringify({ name, description: description || undefined }),
      });
      setProjects((prev) => [project as Project, ...prev]);
      setName('');
      setDescription('');
      router.push(`/dashboard/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  if (loading) {
    return (
      <main className="shell">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  return (
    <main className="shell fade-up">
      <AppHeader email={user?.email} showGuideOnFirstVisit />
      <div className="dash-grid">
        <section className="panel panel-pad">
          <h2 className="panel-title">Projects</h2>
          {projects.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              아직 프로젝트가 없습니다. 오른쪽에서 생성하세요.
            </p>
          ) : (
            <div className="list-stack">
              {projects.map((p) => (
                <Link key={p.id} href={`/dashboard/projects/${p.id}`} className="list-row">
                  <div className="list-row-top">
                    <strong>{p.name}</strong>
                    <span className="mono list-row-meta">{p._count?.events ?? 0} events</span>
                  </div>
                  {p.description && <p className="list-row-desc">{p.description}</p>}
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="panel panel-pad" style={{ alignSelf: 'start' }}>
          <h2 className="panel-title">New project</h2>
          <form onSubmit={createProject} className="form-stack">
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            {error && <p className="alert alert-err">{error}</p>}
            <button className="btn" type="submit">
              Create project
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
