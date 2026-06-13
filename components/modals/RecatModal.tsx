'use client';

import { useState, useMemo } from 'react';
import Modal from './Modal';
import { useBudgetStore } from '@/store/useBudgetStore';
import { ALL_SUBS, SUB2MACRO } from '@/lib/constants';
import { categorize } from '@/lib/categorize';
import { fmt } from '@/lib/format';

interface Props { open: boolean; onClose: () => void; }

interface Proposal {
  id: string;
  merchant: string;
  label: string;
  date: string;
  amount: number;
  currentCat: string;
  proposedCat: string;
  proposedMacro: string;
  selected: boolean;
}

export default function RecatModal({ open, onClose }: Props) {
  const { transactions, merchantRules, applyRecat } = useBudgetStore();

  const initialProposals = useMemo((): Proposal[] => {
    const rules = { ...merchantRules };
    transactions.forEach(t => {
      if (t.confirmed && t.cat && t.merchant && t.merchant.length > 2) {
        if (!rules[t.merchant]) rules[t.merchant] = t.cat;
      }
    });
    return transactions
      .filter(t => !t.confirmed)
      .flatMap(tx => {
        const { cat, macro } = categorize(tx.merchant, tx.label, tx.amount, rules);
        if (cat && (cat !== tx.cat || macro !== tx.macro)) {
          return [{ id: tx.id, merchant: tx.merchant, label: tx.label, date: tx.date, amount: tx.amount, currentCat: tx.cat, proposedCat: cat, proposedMacro: macro, selected: true }];
        }
        return [];
      });
  }, [transactions, merchantRules]);

  const [proposals, setProposals] = useState<Proposal[]>(initialProposals);

  const byMerchant = proposals.reduce<Record<string, Proposal[]>>((acc, p) => {
    const k = p.merchant || p.label.slice(0, 30);
    if (!acc[k]) acc[k] = [];
    acc[k].push(p);
    return acc;
  }, {});

  function toggleAll(v: boolean) {
    setProposals(ps => ps.map(p => ({ ...p, selected: v })));
  }
  function toggleMerchant(merchant: string, v: boolean) {
    setProposals(ps => ps.map(p => (p.merchant || p.label.slice(0, 30)) === merchant ? { ...p, selected: v } : p));
  }
  function toggleOne(id: string, v: boolean) {
    setProposals(ps => ps.map(p => p.id === id ? { ...p, selected: v } : p));
  }
  function changeProposal(id: string, cat: string) {
    const macro = SUB2MACRO[cat] || 'Non classé';
    setProposals(ps => ps.map(p => p.id === id ? { ...p, proposedCat: cat, proposedMacro: macro } : p));
  }

  function apply(subset: Proposal[]) {
    applyRecat(subset.map(p => ({ id: p.id, cat: p.proposedCat, macro: p.proposedMacro })));
    onClose();
  }

  const selCount = proposals.filter(p => p.selected).length;
  const MACRO_COLORS: Record<string, string> = { Besoins: '#3B82F6', Envies: '#F59E0B', Épargne: '#10B981', Revenus: '#8B5CF6', 'Non classé': '#6B7280' };

  if (initialProposals.length === 0) return (
    <Modal open={open} onClose={onClose} title="🔄 Propositions de recatégorisation"
      footer={<button onClick={onClose} className="btn-secondary">Fermer</button>}
    >
      <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-lg p-3 text-sm">
        ✅ Aucune nouvelle proposition. Validez manuellement quelques transactions pour enrichir les règles.
      </div>
    </Modal>
  );

  return (
    <Modal open={open} onClose={onClose} title="🔄 Propositions de recatégorisation" maxWidth="max-w-4xl"
      footer={<>
        <span className="flex-1 text-xs text-slate-400">{selCount} / {proposals.length} proposition{proposals.length > 1 ? 's' : ''} sélectionnée{selCount > 1 ? 's' : ''}</span>
        <button onClick={onClose} className="btn-secondary">Annuler</button>
        <button onClick={() => apply(proposals.filter(p => p.selected))} className="btn-secondary">✓ Appliquer la sélection</button>
        <button onClick={() => apply(proposals)} className="btn-ok">✓ Tout appliquer</button>
      </>}
    >
      <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 rounded-lg p-3 text-sm mb-4">
        <strong>{proposals.length} opération(s)</strong> peuvent être recatégorisées. Décochez les propositions incorrectes.
      </div>
      <div className="flex justify-end gap-2 mb-3">
        <button onClick={() => toggleAll(true)} className="btn-secondary text-xs py-1 px-2">✓ Tout sélectionner</button>
        <button onClick={() => toggleAll(false)} className="btn-secondary text-xs py-1 px-2">✗ Tout désélectionner</button>
      </div>
      <div className="space-y-2">
        {Object.entries(byMerchant).map(([merchant, items]) => {
          const mc = MACRO_COLORS[items[0].proposedMacro] || '#6B7280';
          const allSelected = items.every(p => p.selected);
          return (
            <div key={merchant} className="bg-[#243347] border border-[#2D3F55] rounded-lg overflow-hidden">
              <div className="flex items-center gap-2.5 px-3 py-2 border-b border-[#2D3F55] bg-white/5">
                <input type="checkbox" checked={allSelected} onChange={e => toggleMerchant(merchant, e.target.checked)} className="cursor-pointer" />
                <strong className="flex-1 text-sm">{merchant}</strong>
                <span className="text-xs text-slate-400">{items.length} transaction{items.length > 1 ? 's' : ''}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: mc + '22', color: mc }}>{items[0].proposedCat}</span>
              </div>
              {items.map(p => (
                <div key={p.id} className="flex items-center gap-2.5 px-3 py-1.5 pl-9 border-b border-white/5 last:border-0 text-xs">
                  <input type="checkbox" checked={p.selected} onChange={e => toggleOne(p.id, e.target.checked)} className="cursor-pointer" />
                  <span className="text-slate-500 whitespace-nowrap">{p.date.split('-').reverse().join('/')}</span>
                  <span className="flex-1 text-slate-300 truncate" title={p.label}>{p.label.length > 55 ? p.label.slice(0, 55) + '…' : p.label}</span>
                  <span className={`font-semibold whitespace-nowrap ${p.amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{fmt(p.amount)}</span>
                  <span className="text-slate-500">{p.currentCat ? `«${p.currentCat}» →` : '(vide) →'}</span>
                  <select value={p.proposedCat} onChange={e => changeProposal(p.id, e.target.value)} className="input-sm text-xs max-w-[180px]">
                    {ALL_SUBS.map(s => <option key={s} value={s}>{s} ({SUB2MACRO[s]})</option>)}
                  </select>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
