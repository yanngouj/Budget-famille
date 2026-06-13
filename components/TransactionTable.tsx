'use client';

import { useBudgetStore } from '@/store/useBudgetStore';
import { MACROS, SUBS, SUB2MACRO, ACCOUNT_COLORS } from '@/lib/constants';
import { fmt } from '@/lib/format';

const CAT_OPTIONS = (() => {
  const opts: { value: string; label: string; group: string }[] = [];
  for (const [macro, subs] of Object.entries(SUBS)) {
    for (const s of subs) opts.push({ value: s, label: s, group: macro });
  }
  return opts;
})();

function MacroBadge({ macro }: { macro: string }) {
  const info = MACROS[macro as keyof typeof MACROS];
  if (!info) return <span className="text-slate-500 text-xs">{macro}</span>;
  const bgColor = info.color + '26';
  const textColor = info.color;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
      style={{ background: bgColor, color: textColor }}>
      {macro}
    </span>
  );
}

export default function TransactionTable() {
  const {
    filtered, transactions, page, pageSize,
    setPage, setSort, updateTransaction, confirmOne, confirmAllFiltered, learnMerchantRule,
  } = useBudgetStore();

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const unconfirmed = filtered.filter(t => !t.confirmed).length;

  function editCat(id: string, cat: string) {
    const macro = SUB2MACRO[cat] || 'Non classé';
    const tx = transactions.find(t => t.id === id);
    if (tx?.merchant && cat) learnMerchantRule(tx.merchant, cat);
    updateTransaction(id, { cat, macro, confirmed: !!cat });
  }

  function renderPagination() {
    if (pages <= 1) return null;
    const range: (number | '…')[] = [];
    for (let i = 1; i <= pages; i++) {
      if (i === 1 || i === pages || Math.abs(i - safePage) <= 2) range.push(i);
      else if (range[range.length - 1] !== '…') range.push('…');
    }
    return (
      <div className="flex items-center justify-center gap-1.5 p-2.5 border-t border-[#2D3F55]">
        <button onClick={() => setPage(safePage - 1)} disabled={safePage <= 1} className="pg-btn">‹</button>
        {range.map((p, i) =>
          p === '…' ? <span key={i} className="text-slate-500 px-1">…</span>
            : <button key={p} onClick={() => setPage(p as number)} className={`pg-btn ${p === safePage ? 'bg-blue-500 border-blue-500 text-white' : ''}`}>{p}</button>
        )}
        <button onClick={() => setPage(safePage + 1)} disabled={safePage >= pages} className="pg-btn">›</button>
        <span className="text-xs text-slate-400 pl-2">Page {safePage}/{pages}</span>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-[#1E293B] border border-[#2D3F55] rounded-xl p-12 text-center text-slate-400">
        <div className="text-5xl mb-4">📂</div>
        <div className="text-lg font-bold text-slate-200 mb-2">Aucune donnée importée</div>
        <div className="text-sm mb-5">Glissez-déposez vos exports CSV/Excel Fortuneo ou SG, ou cliquez sur "↑ Importer".</div>
      </div>
    );
  }

  return (
    <div id="transactions-table" className="bg-[#1E293B] border border-[#2D3F55] rounded-xl overflow-hidden">
      <div className="flex items-center gap-2.5 p-3 border-b border-[#2D3F55] flex-wrap">
        <span className="text-sm font-bold flex-1">📋 Transactions</span>
        <span className="text-xs text-slate-400">
          {total.toLocaleString('fr-FR')} transaction{total !== 1 ? 's' : ''} · {unconfirmed} non confirmée{unconfirmed !== 1 ? 's' : ''}
        </span>
        <button onClick={confirmAllFiltered} className="btn-ok text-xs py-1 px-2">✓ Tout confirmer</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#243347]">
              <th className="th cursor-pointer" onClick={() => setSort('date')}>Date ↕</th>
              <th className="th">Compte</th>
              <th className="th">Libellé</th>
              <th className="th">Marchand</th>
              <th className="th cursor-pointer" onClick={() => setSort('amount')}>Montant ↕</th>
              <th className="th">Macro</th>
              <th className="th">Catégorie</th>
              <th className="th">✓</th>
            </tr>
          </thead>
          <tbody>
            {slice.map(t => {
              const dotColor = ACCOUNT_COLORS[t.account] || '#6B7280';
              const amtClass = t.amount >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold';
              const dateDisp = t.date.split('-').reverse().join('/');
              const label = t.label.length > 40 ? t.label.slice(0, 40) + '…' : t.label;
              const merchant = t.merchant.length > 25 ? t.merchant.slice(0, 25) + '…' : t.merchant;
              return (
                <tr key={t.id} className="border-b border-[#2D3F55] hover:bg-[#243347] transition-colors">
                  <td className="td whitespace-nowrap">{dateDisp}</td>
                  <td className="td whitespace-nowrap">
                    <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: dotColor }} />
                    {t.account}
                  </td>
                  <td className="td" title={t.label}>{label}</td>
                  <td className="td text-slate-400" title={t.merchant}>{merchant}</td>
                  <td className={`td text-right whitespace-nowrap ${amtClass}`}>{fmt(t.amount)}</td>
                  <td className="td"><MacroBadge macro={t.macro} /></td>
                  <td className="td">
                    <select
                      value={t.cat}
                      onChange={e => editCat(t.id, e.target.value)}
                      className="bg-transparent border border-transparent hover:border-[#2D3F55] focus:border-blue-500 focus:bg-[#243347] text-slate-100 text-xs rounded px-1 py-0.5 outline-none max-w-[180px] cursor-pointer"
                    >
                      <option value="">— Non classé —</option>
                      {Object.entries(SUBS).map(([macro, subs]) => (
                        <optgroup key={macro} label={macro}>
                          {subs.map(s => <option key={s} value={s}>{s}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </td>
                  <td className="td text-center">
                    {t.confirmed
                      ? <span className="text-emerald-400 text-base cursor-default" title="Confirmé">✓</span>
                      : <button onClick={() => confirmOne(t.id)} className="text-slate-500 hover:text-yellow-400 text-base transition-colors" title="Confirmer">○</button>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {renderPagination()}
    </div>
  );
}
