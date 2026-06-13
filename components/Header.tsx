'use client';

import { useRef } from 'react';
import { useBudgetStore } from '@/store/useBudgetStore';
import { fmt } from '@/lib/format';
import { Transaction } from '@/lib/types';
import {
  detectFormat, parseByFormat, guessAccountFromFilename,
  readFileAsText, readFileAsArrayBuffer, parseXLSXtoCSV, getFormatLabel,
  FileFormat,
} from '@/lib/parsers';

interface Props {
  onOpenReview: () => void;
  onOpenVI: () => void;
  onOpenRecat: () => void;
  onOpenImport: (text: string, format: FileFormat, filename: string) => void;
}

export default function Header({ onOpenReview, onOpenVI, onOpenRecat, onOpenImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  const {
    filtered, transactions, merchantRules,
    importTransactions, importJSON, exportJSON, clearAll,
  } = useBudgetStore();

  const txs = filtered.filter(t => t.macro !== 'Virements internes');
  const rev = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const dep = txs.filter(t => t.amount < 0 && t.macro !== 'Épargne').reduce((s, t) => s + t.amount, 0);
  const sav = txs.filter(t => t.macro === 'Épargne').reduce((s, t) => s + t.amount, 0);
  const bal = rev + dep + sav;

  const reviewCount = useBudgetStore(s => s.reviewQueue().length);
  const unconfirmedCount = useBudgetStore(s => s.unconfirmedCount());

  async function processFiles(files: FileList) {
    for (const file of Array.from(files)) {
      const name = file.name.toLowerCase();
      if (name.endsWith('.csv')) {
        const text = await readFileAsText(file);
        const lines = text.split(/\r?\n/);
        const headerLine = lines.find(l => /date|libell/i.test(l) && l.includes(';')) || lines[0] || '';
        const sep = headerLine.includes(';') ? ';' : ',';
        const headers = headerLine.split(sep).map(x => (x || '').trim());
        const fmt = detectFormat(headers);
        const account = guessAccountFromFilename(file.name);
        if (account) {
          const txs = parseByFormat(text, fmt, account, { ...merchantRules });
          importTransactions(txs);
        } else {
          onOpenImport(text, fmt, file.name);
        }
      } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const buf = await readFileAsArrayBuffer(file);
        const csv = parseXLSXtoCSV(buf);
        onOpenImport(csv, 'generic', file.name);
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleJSON(file: File) {
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      let txs: Transaction[] = [];
      if (Array.isArray(data)) txs = data;
      else if (data.transactions) txs = data.transactions;
      else return;
      if (!txs.length) return;
      importJSON(txs);
    } catch { /* ignore */ }
    if (jsonRef.current) jsonRef.current.value = '';
  }

  const stat = (label: string, val: string, cls: string) => (
    <div className="text-center">
      <div className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</div>
      <div className={`text-[15px] font-bold ${cls}`}>{val}</div>
    </div>
  );

  return (
    <header className="bg-[#1E293B] border-b border-[#2D3F55] px-5 py-2.5 flex items-center gap-3 sticky top-0 z-40 flex-wrap">
      <div className="text-lg font-extrabold whitespace-nowrap">
        💰 Budget <span className="text-blue-400">Famille</span>
      </div>

      {transactions.length > 0 && (
        <div className="flex gap-5 flex-1 justify-center flex-wrap">
          {stat('Revenus', fmt(rev), 'text-emerald-400')}
          <div className="w-px h-5 bg-[#2D3F55]" />
          {stat('Dépenses', fmt(dep), 'text-red-400')}
          <div className="w-px h-5 bg-[#2D3F55]" />
          {stat('Balance', fmt(bal), bal >= 0 ? 'text-blue-400' : 'text-red-400')}
          <div className="w-px h-5 bg-[#2D3F55]" />
          {stat('Épargne', fmt(-sav), 'text-emerald-400')}
          <div className="w-px h-5 bg-[#2D3F55]" />
          {stat('Transactions', String(txs.length), 'text-blue-400')}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {reviewCount > 0 && (
          <button onClick={onOpenReview} className="btn-secondary text-yellow-400 border-yellow-600">
            ⚠️ À classer ({reviewCount})
          </button>
        )}
        <button onClick={onOpenVI} className="btn-secondary">⇄ Virements internes</button>
        <button onClick={() => fileRef.current?.click()} className="btn-primary">↑ Importer</button>
        {unconfirmedCount > 0 && (
          <button onClick={onOpenRecat} className="btn-secondary">
            🔄 Recatégoriser ({unconfirmedCount})
          </button>
        )}
        <button onClick={exportJSON} className="btn-secondary">↓ Export JSON</button>
        <button onClick={() => jsonRef.current?.click()} className="btn-secondary">↑ Import JSON</button>
        <button onClick={() => { if (confirm('Effacer toutes les données ?')) clearAll(); }} className="btn-secondary">🗑</button>
      </div>

      <input ref={fileRef} type="file" accept=".csv,.xls,.xlsx" multiple className="hidden"
        onChange={e => e.target.files && processFiles(e.target.files)} />
      <input ref={jsonRef} type="file" accept=".json" className="hidden"
        onChange={e => e.target.files?.[0] && handleJSON(e.target.files[0])} />
    </header>
  );
}
