'use client';

import { useState } from 'react';
import Modal from './Modal';
import { useBudgetStore } from '@/store/useBudgetStore';
import { ALL_SUBS, SUB2MACRO } from '@/lib/constants';

interface Props { open: boolean; onClose: () => void; }

export default function ReviewModal({ open, onClose }: Props) {
  const { reviewQueue, transactions, updateTransaction, learnMerchantRule, applyFilters } = useBudgetStore();
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const queue = reviewQueue();

  function apply() {
    for (const [merchant, cat] of Object.entries(decisions)) {
      if (!cat) continue;
      const macro = SUB2MACRO[cat] || 'Non classé';
      learnMerchantRule(merchant, cat);
      transactions.forEach(t => {
        if (t.merchant === merchant && !t.confirmed) {
          updateTransaction(t.id, { cat, macro, confirmed: true });
        }
      });
    }
    applyFilters();
    setDecisions({});
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="⚠️ Marchands à classer"
      footer={<>
        <button onClick={onClose} className="btn-secondary">Fermer</button>
        <button onClick={apply} className="btn-primary">Appliquer</button>
      </>}
    >
      {queue.length === 0 ? (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-lg p-3 text-sm">✅ Tous les marchands sont classés !</div>
      ) : (
        <>
          <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 rounded-lg p-3 text-sm mb-4">
            {queue.length} marchand(s) inconnu(s). Classez-les pour améliorer la catégorisation automatique.
          </div>
          <div className="space-y-2">
            {queue.map((item, i) => (
              <div key={i} className="bg-[#243347] border border-[#2D3F55] rounded-lg p-3 flex gap-3 items-center">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{item.merchant || '(vide)'}</div>
                  <div className="text-xs text-slate-400 truncate">{item.examples.join(' / ')}</div>
                </div>
                <span className="text-xs text-slate-500 shrink-0">{item.count} transaction{item.count > 1 ? 's' : ''}</span>
                <select
                  value={decisions[item.merchant] || ''}
                  onChange={e => setDecisions(d => ({ ...d, [item.merchant]: e.target.value }))}
                  className="input-sm min-w-[200px]"
                >
                  <option value="">-- Non classé --</option>
                  {ALL_SUBS.map(s => <option key={s} value={s}>{s} ({SUB2MACRO[s]})</option>)}
                </select>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
