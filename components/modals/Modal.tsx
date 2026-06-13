'use client';

import { ReactNode, useEffect } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}

export default function Modal({ open, onClose, title, children, footer, maxWidth = 'max-w-3xl' }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-5" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`bg-[#1E293B] border border-[#2D3F55] rounded-2xl w-full ${maxWidth} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#2D3F55] shrink-0">
          <span className="text-[15px] font-bold flex-1">{title}</span>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-[#2D3F55] flex items-center justify-center hover:border-slate-400 text-slate-400 hover:text-slate-200 transition-colors text-lg">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="px-5 py-3.5 border-t border-[#2D3F55] flex gap-2 justify-end shrink-0">{footer}</div>}
      </div>
    </div>
  );
}
