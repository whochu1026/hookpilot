import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HookPilot — Webhook Delivery Platform',
  description:
    '웹훅이 제대로 전달됐는지, 실패했다면 왜 실패했는지 한곳에서 확인하세요.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
