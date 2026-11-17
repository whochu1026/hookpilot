'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { setToken } from '@/lib/api';
import { UsageGuideModal, useUsageGuide } from './UsageGuideModal';

export function AppHeader({
  email,
  showGuideOnFirstVisit = false,
}: {
  email?: string;
  showGuideOnFirstVisit?: boolean;
}) {
  const router = useRouter();
  const { open, openGuide, closeGuide } = useUsageGuide(showGuideOnFirstVisit);

  function logout() {
    setToken(null);
    router.push('/');
  }

  return (
    <>
      <header className="app-header">
        <Link href="/dashboard" className="brand">
          <span className="brand-name">HookPilot</span>
          <span className="mono brand-tag">webhook delivery</span>
        </Link>
        <div className="header-actions">
          {email && <span className="mono header-email">{email}</span>}
          <button className="btn btn-ghost btn-sm" onClick={openGuide} type="button">
            사용법
          </button>
          <button className="btn btn-ghost btn-sm" onClick={logout} type="button">
            Logout
          </button>
        </div>
      </header>
      <UsageGuideModal open={open} onClose={closeGuide} />
    </>
  );
}
