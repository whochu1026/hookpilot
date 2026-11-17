'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';

const STORAGE_KEY = 'hp_usage_guide_seen';

const STEPS = [
  {
    title: '프로젝트 만들기',
    body: '프로젝트 단위로 Endpoint · API Key · 이벤트를 관리합니다.',
  },
  {
    title: 'Endpoint 등록',
    body: '웹훅 수신 URL을 등록합니다. (예: httpbin, 로컬 receiver)',
  },
  {
    title: 'API Key 발급',
    body: 'Keys 탭에서 키를 발급합니다. 생성 직후 한 번만 표시됩니다.',
  },
  {
    title: '이벤트 전송',
    body: 'Overview 테스트 전송, 또는 POST /api/v1/events + X-API-Key',
  },
  {
    title: '이력 · 재시도',
    body: 'Events에서 실패 원인을 확인하고 Redeliver로 재전송합니다.',
  },
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
};

export function UsageGuideModal({ open, onClose }: Props) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div className="modal-header-text">
            <p className="mono modal-eyebrow">HOW TO USE</p>
            <h2 id={titleId} className="modal-title">
              HookPilot 사용법
            </h2>
            <p className="modal-lead">전송 → 재시도 → 이력 확인, 5단계</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost modal-close"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </header>

        <div className="modal-body">
          <ol className="modal-steps">
            {STEPS.map((step, index) => (
              <li key={step.title} className="modal-step">
                <span className="modal-step-num mono" aria-hidden>
                  {index + 1}
                </span>
                <div className="modal-step-copy">
                  <strong>{step.title}</strong>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="modal-tip">
            <span className="mono">Tip</span>
            Demo 로그인 시 <em>Demo Shop</em> 샘플이 준비됩니다.
          </p>
        </div>

        <footer className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            닫기
          </button>
          <button type="button" className="btn" onClick={onClose}>
            시작하기
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

export function useUsageGuide(autoOpen = true) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!autoOpen) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) !== '1') {
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  }, [autoOpen]);

  function openGuide() {
    setOpen(true);
  }

  function closeGuide() {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
  }

  return { open, openGuide, closeGuide };
}
