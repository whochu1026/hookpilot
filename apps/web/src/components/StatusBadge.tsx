const STYLES: Record<string, string> = {
  DELIVERED: 'badge-ok',
  SUCCESS: 'badge-ok',
  PENDING: 'badge-muted',
  PROCESSING: 'badge-warn',
  FAILED: 'badge-fail',
  TIMEOUT: 'badge-fail',
  DEAD: 'badge-fail',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${STYLES[status] || 'badge-muted'} mono`}>
      {status}
    </span>
  );
}
