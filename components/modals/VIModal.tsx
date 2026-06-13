'use client';

import { useState, useMemo } from 'react';
import Modal from './Modal';
import { useBudgetStore } from '@/store/useBudgetStore';
import { detectInternalTransfers } from '@/lib/detectVI';
import { ACCOUNT_COLORS } from '@/lib/constants';
import { fmt, fmtAbs } from '@/lib/format';
import { VIPair } from '@/lib/types';

interface Props { open: boolean; onClose: () => void; }

export default function VIModal({ open, onClose }: Props) {
  const { transactions, applyVI } = useBudgetStore();
  const allPairs = useMemo(() => detectInternalTransfers(transactions), [transactions]);
  const newPairs = allPairs.filter(p => p.debit.macro !== 'Virements internes' && p.credit.macro !== 'Virements internes');
  const alreadyVI = allPairs.filter(p => p.debit.macro === 'Virements internes' || p.credit.macro === 'Virements internes');

  const [selected, setSelected] = useState<Set<number>>(() => new Set(newPairs.map((_, i) => i)));

  function toggle(i: number) {
    setSelected(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  }
  function selectAll(v: boolean) {
    setSelected(v ? new Set(newPairs.map((_, i) => i)) : new Set());
  }

  function apply() {
    const ids: string[] = [];
    for (const i of selected) {
      ids.push(newPairs[i].debit.id, newPairs[i].credit.id);
    }
    applyVI(ids);
    onClose();
  }

  const selCount = selected.size;
  const selAmt = [...selected].reduce((s, i) => s + Math.abs(newPairs[i]?.debit.amount || 0), 0);

  const dot = (acc: string) => (
    <span className="inline-block w-2 h-2 rounded-full shrink-0 align-middle" style={{ background: ACCOUNT_COLORS[acc] || '#6B7280' }} />
  );

  return (
    <Modal open={open} onClose={onClose} title="⇄ Virements internes détectés" maxWidth="max-w-4xl"
      footer={<>
        <span className="flex-1 text-xs text-slate-400">{selCount}/{newPairs.length} paire(s) sélectionnée(s) · {fmtAbs(selAmt)} déplacé(s)</span>
        <button onClick={onClose} className="btn-secondary">Annuler</button>
        <button onClick={() => selectAll(true)} className="btn-secondary">✓ Tout sélectionner</button>
        <button onClick={apply} className="btn-ok">⇄ Appliquer la sélection</button>
      </>}
    >
      {newPairs.length === 0 ? (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-lg p-3 text-sm">
          ✅ Aucun virement interne détecté.<br />
          <span className="text-slate-400 text-xs">Critères : même montant · comptes différents · date ≤ 5 jours d'écart · signes opposés.</span>
        </div>
      ) : (
        <>
          <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 rounded-lg p-3 text-sm mb-4">
            <strong>{newPairs.length} paire(s) nouvelle(s)</strong> détectée(s) — {alreadyVI.length} déjà classée(s).
            <br /><span className="text-xs text-slate-400">Logique : montant identique · comptes différents · signes opposés · ≤ 5 jours d'écart</span>
          </div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#243347]">
                <th className="p-2 w-8 text-center"><input type="checkbox" checked={selCount === newPairs.length} onChange={e => selectAll(e.target.checked)} /></th>
                <th className="p-2 text-left text-slate-400">Débit</th>
                <th className="p-2 w-8 text-center text-slate-400">⇄</th>
                <th className="p-2 text-left text-slate-400">Crédit</th>
                <th className="p-2 text-right text-slate-400">Montant</th>
                <th className="p-2 text-center text-slate-400">Écart</th>
              </tr>
            </thead>
            <tbody>
              {newPairs.map((pair, i) => (
                <tr key={i} className="border-b border-[#2D3F55] hover:bg-[#243347]">
                  <td className="p-2 text-center"><input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} /></td>
                  <td className="p-2">
                    <div className="flex items-center gap-1.5">{dot(pair.debit.account)}
                      <div>
                        <div className="font-semibold text-red-400">{pair.debit.date.split('-').reverse().join('/')} · {fmt(pair.debit.amount)}</div>
                        <div className="text-slate-500">{pair.debit.account}</div>
                        <div className="text-slate-400 truncate max-w-[200px]" title={pair.debit.label}>{pair.debit.label.slice(0, 45)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-2 text-center text-blue-400 text-lg">⇄</td>
                  <td className="p-2">
                    <div className="flex items-center gap-1.5">{dot(pair.credit.account)}
                      <div>
                        <div className="font-semibold text-emerald-400">{pair.credit.date.split('-').reverse().join('/')} · {fmt(pair.credit.amount)}</div>
                        <div className="text-slate-500">{pair.credit.account}</div>
                        <div className="text-slate-400 truncate max-w-[200px]" title={pair.credit.label}>{pair.credit.label.slice(0, 45)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-2 text-right font-bold">{fmtAbs(pair.debit.amount)}</td>
                  <td className={`p-2 text-center ${pair.daysDiff === 0 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                    {pair.daysDiff === 0 ? 'même jour' : `+${pair.daysDiff}j`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Modal>
  );
}
