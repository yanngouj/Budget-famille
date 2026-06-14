'use client';

import { useState } from 'react';
import { useBudgetStore } from '@/store/useBudgetStore';
import { detectCategoryRecurrences } from '@/lib/recurrences';
import { ACCOUNT_COLORS } from '@/lib/constants';
import { fmtAbs } from '@/lib/format';
import { CategoryRecurrence, ExceptionalExpense } from '@/lib/types';
import Charts from '@/components/Charts';

type Tab = 'categories-table' | 'analyses';

export default function Prevision() {
  const [tab, setTab] = useState<Tab>('categories-table');
  const { transactions } = useBudgetStore();

  if (!transactions.length) return null;

  const { recurrences: catRecs, exceptional: catExceptional } = detectCategoryRecurrences(transactions);
  const now = new Date();
  const monthLabel = now.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });

  const tabBtn = (id: Tab, label: string) => (
    <button
      onClick={() => setTab(id)}
      className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${tab === id ? 'bg-blue-500 border-blue-500 text-white' : 'bg-[#243347] border-[#2D3F55] text-slate-400 hover:border-blue-500 hover:text-blue-400'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="mb-5">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="text-sm font-bold">
          📅 Prévision — {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
        </span>
        <div className="flex gap-1.5">
          {tabBtn('categories-table', '📊 Tableau des récurrences par catégories')}
          {tabBtn('analyses', '📈 Analyses par natures')}
        </div>
      </div>

      {tab === 'categories-table' && <CategoriesTableTab catRecs={catRecs} catExceptional={catExceptional} />}
      {tab === 'analyses' && <Charts />}
    </div>
  );
}

function ExceptionalTab({ exceptional }: { exceptional: ExceptionalExpense[] }) {
  if (!exceptional.length) return null;

  const total = exceptional.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="bg-[#1E293B] border border-[#2D3F55] rounded-xl p-3.5 mb-3">
      <div className="text-xs text-slate-400 font-bold uppercase tracking-wide mb-2">
        ⚠️ Dépenses exceptionnelles détectées ({fmtAbs(total)})
      </div>
      <div className="text-[11px] text-slate-500 mb-2">
        Ces dépenses ponctuelles ont été exclues du calcul des moyennes récurrentes ci-dessous.
      </div>
      <div className="space-y-1 text-xs max-h-40 overflow-y-auto">
        {exceptional.map((e, i) => (
          <div key={i} className="flex items-center gap-1.5 py-1 border-b border-white/5 last:border-0">
            <span className="flex-1 truncate">{e.cat || 'non classé'}</span>
            <span className="text-slate-500 text-[10px] shrink-0">{e.account} · {e.month}</span>
            <span className="font-semibold text-orange-400 shrink-0">{fmtAbs(e.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoriesTableTab({ catRecs, catExceptional }: { catRecs: CategoryRecurrence[]; catExceptional: ExceptionalExpense[] }) {
  const ACCOUNTS = ['Compte SG', 'Compte commun Fortuneo', 'CB Yann', 'CB Chloé'];

  if (!catRecs.length) return (
    <>
      <ExceptionalTab exceptional={catExceptional} />
      <div className="text-slate-400 text-sm py-2">Pas assez d'historique pour détecter des dépenses récurrentes par catégorie (minimum 2 mois).</div>
    </>
  );

  // Toutes les sous-catégories présentes, triées par "reste à mobiliser" total décroissant
  const catTotals: Record<string, number> = {};
  for (const c of catRecs) catTotals[c.cat] = (catTotals[c.cat] || 0) + c.remaining;
  const cats = Object.keys(catTotals).sort((a, b) => catTotals[b] - catTotals[a]);

  const cell = (cat: string, acc: string) => catRecs.find(c => c.cat === cat && c.account === acc);

  const sumBy = (filterFn: (c: CategoryRecurrence) => boolean) => ({
    avg: catRecs.filter(filterFn).reduce((s, c) => s + c.avgMonthly, 0),
    spent: catRecs.filter(filterFn).reduce((s, c) => s + Math.min(c.spentThisMonth, c.avgMonthly), 0),
    remaining: catRecs.filter(filterFn).reduce((s, c) => s + c.remaining, 0),
  });

  const rowSum = (cat: string) => sumBy(c => c.cat === cat);
  const colSum = (acc: string) => sumBy(c => c.account === acc);
  const grand = sumBy(() => true);

  // Indicateur de fiabilité : opacité selon le nombre de mois actifs (2 = peu fiable, 5-6 = très fiable)
  const monthsColor = (n: number) => n >= 5 ? 'text-slate-400' : n >= 3 ? 'text-slate-500' : 'text-slate-600';

  const summaryLine = (avg: number, spent: number) => (
    <div className="text-[9px] text-slate-500 whitespace-nowrap">{fmtAbs(spent)} / {fmtAbs(avg)}</div>
  );

  const { setFilters } = useBudgetStore();
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = now.toISOString().slice(0, 10);

  // Première date à prendre en compte : le 1er du plus ancien mois actif parmi les
  // entrées concernées (mois ayant servi au calcul de la moyenne), ou le mois en
  // cours si aucun mois actif n'est disponible.
  const earliestMonth = (entries: CategoryRecurrence[]) => {
    const months = entries.flatMap(c => c.activeMonths);
    return months.length ? `${months.sort()[0]}-01` : monthStart;
  };

  const filterAndScroll = (f: { account?: string; subcat?: string }, entries: CategoryRecurrence[]) => {
    setFilters({ account: f.account ?? 'all', subcat: f.subcat ?? 'all', macro: 'all', search: '', start: earliestMonth(entries), end: today });
    // Laisse le temps au tableau filtré de se rerender avant de scroller, sinon la
    // mise en page change après le scroll et la position devient incorrecte.
    setTimeout(() => {
      document.getElementById('transactions-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const grandRemainingColor = grand.remaining > 0 ? 'text-yellow-400' : 'text-emerald-400';

  return (
    <div>
      <ExceptionalTab exceptional={catExceptional} />
      <div className="bg-[#1E293B] border border-blue-500/30 rounded-xl p-3.5 mb-3" style={{ background: 'linear-gradient(135deg, #1E293B, #243347)' }}>
        <div className="text-xs text-slate-400 font-bold uppercase tracking-wide mb-2">📊 Synthèse — toutes catégories</div>
        <div className={`text-2xl font-extrabold mb-1 ${grandRemainingColor}`}>{fmtAbs(grand.remaining)}</div>
        <div className="text-xs text-slate-400 mb-3">reste à mobiliser ce mois (toutes catégories, tous comptes)</div>
        <div className="space-y-1 text-xs max-w-sm">
          <div className="flex justify-between"><span className="text-slate-400">Budget mensuel moyen</span><span>{fmtAbs(grand.avg)}</span></div>
          <div className="flex justify-between"><span className="text-emerald-400">Déjà dépensé ce mois</span><span className="text-emerald-400">{fmtAbs(grand.spent)}</span></div>
          <div className={`flex justify-between font-bold border-t border-[#2D3F55] pt-1 mt-1 ${grandRemainingColor}`}>
            <span>Reste à mobiliser</span><span>{fmtAbs(grand.remaining)}</span>
          </div>
        </div>
      </div>
      <div className="bg-[#1E293B] border border-[#2D3F55] rounded-xl p-3.5 overflow-x-auto">
        <div className="text-xs text-slate-400 font-bold uppercase tracking-wide mb-1">📊 Besoin cash par sous-catégorie / compte (reste à mobiliser ce mois)</div>
        <div className="text-[10px] text-slate-500 mb-2.5">Chaque cellule : dépensé / moyenne mensuelle, puis reste à mobiliser. Le nombre de mois actifs (sur 6) est indiqué en exposant.</div>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-slate-400 border-b border-[#2D3F55]">
              <th className="text-left py-1.5 pr-3 font-semibold sticky left-0 bg-[#1E293B]">Sous-catégorie</th>
              {ACCOUNTS.map(acc => (
                <th key={acc} className="text-right py-1.5 px-2 font-semibold whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 justify-end">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ACCOUNT_COLORS[acc] || '#6B7280' }} />
                    {acc}
                  </span>
                </th>
              ))}
              <th className="text-right py-1.5 pl-3 font-semibold whitespace-nowrap">Total</th>
            </tr>
          </thead>
          <tbody>
            {cats.map(cat => {
              const rt = rowSum(cat);
              return (
                <tr key={cat} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td
                    className="py-1.5 pr-3 truncate sticky left-0 bg-[#1E293B] align-top cursor-pointer hover:text-blue-400"
                    onClick={() => filterAndScroll({ subcat: cat }, catRecs.filter(x => x.cat === cat))}
                    title="Voir les transactions de cette sous-catégorie (tous comptes, mois pertinents)"
                  >
                    {cat || 'non classé'}
                  </td>
                  {ACCOUNTS.map(acc => {
                    const c = cell(cat, acc);
                    if (!c) return <td key={acc} className="text-right py-1.5 px-2 text-slate-600 align-top">—</td>;
                    const covered = c.remaining <= 0;
                    return (
                      <td
                        key={acc}
                        className="text-right py-1.5 px-2 align-top cursor-pointer hover:bg-white/5 rounded"
                        onClick={() => filterAndScroll({ account: acc, subcat: cat }, c ? [c] : [])}
                        title={`Voir les transactions ${cat} · ${acc} (mois pertinents)`}
                      >
                        <div className={`flex items-baseline justify-end gap-0.5 ${monthsColor(c.monthsActive)}`}>
                          {summaryLine(c.avgMonthly, c.spentThisMonth)}
                          <sup className="text-[8px]">{c.monthsActive}m</sup>
                        </div>
                        <div className={`font-semibold ${covered ? 'text-emerald-400' : 'text-yellow-400'}`}>
                          {fmtAbs(c.remaining)}
                        </div>
                      </td>
                    );
                  })}
                  <td
                    className="text-right py-1.5 pl-3 align-top cursor-pointer hover:bg-white/5 rounded"
                    onClick={() => filterAndScroll({ subcat: cat }, catRecs.filter(x => x.cat === cat))}
                    title={`Voir les transactions ${cat} (tous comptes, mois pertinents)`}
                  >
                    {summaryLine(rt.avg, rt.spent)}
                    <div className={`font-bold ${rt.remaining > 0 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                      {fmtAbs(rt.remaining)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-[#2D3F55] font-bold">
              <td className="py-1.5 pr-3 sticky left-0 bg-[#1E293B] align-top">Total</td>
              {ACCOUNTS.map(acc => {
                const ct = colSum(acc);
                return (
                  <td
                    key={acc}
                    className="text-right py-1.5 px-2 align-top cursor-pointer hover:bg-white/5 rounded"
                    onClick={() => filterAndScroll({ account: acc }, catRecs.filter(x => x.account === acc))}
                    title={`Voir les transactions ${acc} (mois pertinents)`}
                  >
                    {summaryLine(ct.avg, ct.spent)}
                    <div className={ct.remaining > 0 ? 'text-yellow-400' : 'text-emerald-400'}>
                      {fmtAbs(ct.remaining)}
                    </div>
                  </td>
                );
              })}
              <td
                className="text-right py-1.5 pl-3 align-top cursor-pointer hover:bg-white/5 rounded"
                onClick={() => filterAndScroll({}, catRecs)}
                title="Voir toutes les transactions (mois pertinents)"
              >
                {summaryLine(grand.avg, grand.spent)}
                <div className={grand.remaining > 0 ? 'text-yellow-400' : 'text-emerald-400'}>
                  {fmtAbs(grand.remaining)}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
