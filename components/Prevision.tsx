'use client';

import { useState } from 'react';
import { useBudgetStore } from '@/store/useBudgetStore';
import { detectRecurrences, detectCategoryRecurrences } from '@/lib/recurrences';
import { ACCOUNT_COLORS } from '@/lib/constants';
import { fmt, fmtAbs } from '@/lib/format';
import { Recurrence, CategoryRecurrence, ExceptionalExpense } from '@/lib/types';

type Tab = 'besoin' | 'recurrences' | 'alertes' | 'categories' | 'categories-table';

export default function Prevision() {
  const [tab, setTab] = useState<Tab>('besoin');
  const { transactions } = useBudgetStore();

  if (!transactions.length) return null;

  const recs = detectRecurrences(transactions);
  const { recurrences: catRecs, exceptional: catExceptional } = detectCategoryRecurrences(transactions);
  const now = new Date();
  const monthLabel = now.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();

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
          {tabBtn('besoin', '💳 Besoin en cash')}
          {tabBtn('recurrences', '🔁 Récurrences détectées')}
          {tabBtn('alertes', '🔔 Alertes')}
          {tabBtn('categories', '📂 Par catégorie')}
          {tabBtn('categories-table', '📊 Tableau par catégorie')}
        </div>
      </div>

      {tab === 'besoin' && <BesoinTab recs={recs} transactions={transactions} />}
      {tab === 'recurrences' && <RecurrencesTab recs={recs} />}
      {tab === 'alertes' && <AlertesTab recs={recs} daysLeft={daysLeft} />}
      {tab === 'categories' && <CategoriesTab catRecs={catRecs} catExceptional={catExceptional} />}
      {tab === 'categories-table' && <CategoriesTableTab catRecs={catRecs} catExceptional={catExceptional} />}
    </div>
  );
}

function RecRow({ r, type }: { r: Recurrence; type: 'paid' | 'late' | 'pend' }) {
  const iconMap = { paid: '✓', late: '⚠', pend: '○' };
  const colorMap = { paid: 'text-emerald-400', late: 'text-red-400', pend: 'text-yellow-400' };
  return (
    <div className="flex items-center gap-1.5 py-1 border-b border-white/5 last:border-0 text-xs">
      <span className="text-slate-500 w-8 text-right shrink-0">~{r.avgDay}</span>
      <span className={`w-4 text-center shrink-0 ${colorMap[type]}`}>{iconMap[type]}</span>
      <span className={`flex-1 truncate ${type === 'late' ? 'text-red-400' : type === 'paid' ? 'text-slate-500' : ''}`}>{r.merchant}</span>
      <span className="text-slate-500 text-[10px] shrink-0">{r.cat}</span>
      <span className={`font-semibold shrink-0 ${colorMap[type]}`}>-{fmtAbs(type === 'paid' ? r.paidAmt : r.avgAmt)}</span>
    </div>
  );
}

function BesoinTab({ recs, transactions }: { recs: Recurrence[]; transactions: ReturnType<typeof useBudgetStore.getState>['transactions'] }) {
  const ACCOUNTS = ['Compte SG', 'Compte commun Fortuneo', 'CB Yann', 'CB Chloé'];
  const now = new Date();

  function avgMonthlyVI(acc: string) {
    const viTxs = transactions.filter(t => t.account === acc && t.macro === 'Virements internes' && t.amount < 0);
    if (!viTxs.length) return 0;
    const months = new Set(viTxs.map(t => t.date.slice(0, 7))).size || 1;
    return viTxs.reduce((s, t) => s + Math.abs(t.amount), 0) / months;
  }

  const viTxsAll = transactions.filter(t => t.macro === 'Virements internes' && t.amount < 0);
  const viMonths = new Set(viTxsAll.map(t => t.date.slice(0, 7))).size || 1;
  const avgVIAll = viTxsAll.reduce((s, t) => s + Math.abs(t.amount), 0) / viMonths;

  const totalAll = recs.reduce((s, r) => s + r.avgAmt, 0);
  const paidAll = recs.filter(r => r.isPaid).reduce((s, r) => s + r.paidAmt, 0);
  const needAll = recs.filter(r => !r.isPaid).reduce((s, r) => s + r.avgAmt, 0);
  const needColor2 = needAll > 0 ? 'text-yellow-400' : 'text-emerald-400';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-3">
      {ACCOUNTS.map(acc => {
        const accRecs = recs.filter(r => r.account === acc);
        if (!accRecs.length) return null;
        const totalMonthly = accRecs.reduce((s, r) => s + r.avgAmt, 0);
        const paidAmt = accRecs.filter(r => r.isPaid).reduce((s, r) => s + r.paidAmt, 0);
        const overdueAmt = accRecs.filter(r => r.isOverdue).reduce((s, r) => s + r.avgAmt, 0);
        const pendingAmt = accRecs.filter(r => r.isUpcoming).reduce((s, r) => s + r.avgAmt, 0);
        const remaining = overdueAmt + pendingAmt;
        const paidPct = totalMonthly > 0 ? Math.round(paidAmt / totalMonthly * 100) : 0;
        const latePct = totalMonthly > 0 ? Math.round(overdueAmt / totalMonthly * 100) : 0;
        const pendPct = totalMonthly > 0 ? Math.round(pendingAmt / totalMonthly * 100) : 0;
        const dotColor = ACCOUNT_COLORS[acc] || '#6B7280';
        const needLabel = remaining > 0 ? `Besoin cash : ${fmtAbs(remaining)}` : '✓ Récurrences couvertes';
        const needTextColor = remaining > 0 ? (overdueAmt > 0 ? 'text-red-400' : 'text-yellow-400') : 'text-emerald-400';
        return (
          <div key={acc} className="bg-[#1E293B] border border-[#2D3F55] rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: dotColor }} />
              <span className="text-sm font-bold flex-1 truncate">{acc}</span>
              <span className="text-xs text-slate-400">{fmt(-totalMonthly)}/mois</span>
            </div>
            <div className="flex rounded-full overflow-hidden h-2 mb-2.5 bg-[#2D3F55]">
              <div className="bg-emerald-500 transition-all" style={{ width: `${paidPct}%` }} />
              <div className="bg-red-500 transition-all" style={{ width: `${latePct}%` }} />
              <div className="bg-yellow-500 transition-all" style={{ width: `${pendPct}%` }} />
            </div>
            <div className="flex gap-3 text-[11px] mb-2.5 flex-wrap">
              <span className="text-emerald-400">✓ Payé : {fmtAbs(paidAmt)}</span>
              {overdueAmt > 0 && <span className="text-red-400">⚠ En retard : {fmtAbs(overdueAmt)}</span>}
              {pendingAmt > 0 && <span className="text-yellow-400">○ À venir : {fmtAbs(pendingAmt)}</span>}
            </div>
            <div className={`text-sm font-extrabold mb-2 ${needTextColor}`}>{needLabel}</div>
            <div className="max-h-44 overflow-y-auto">
              {accRecs.filter(r => !r.isPaid).sort((a, b) => a.avgDay - b.avgDay).map((r, i) =>
                <RecRow key={`pending-${i}`} r={r} type={r.isOverdue ? 'late' : 'pend'} />
              )}
              {accRecs.filter(r => r.isPaid).slice(0, 4).map((r, i) =>
                <RecRow key={`paid-${i}`} r={r} type="paid" />
              )}
            </div>
          </div>
        );
      })}

      <div className="bg-[#1E293B] border border-blue-500/30 rounded-xl p-3.5" style={{ background: 'linear-gradient(135deg, #1E293B, #243347)' }}>
        <div className="text-xs text-slate-400 font-bold uppercase tracking-wide mb-2">📊 Synthèse tous comptes</div>
        <div className={`text-2xl font-extrabold mb-1 ${needColor2}`}>{fmtAbs(needAll)}</div>
        <div className="text-xs text-slate-400 mb-3">besoin en cash restant ce mois</div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between"><span className="text-slate-400">Dépenses récurrentes</span><span>{fmtAbs(totalAll)}</span></div>
          <div className="flex justify-between"><span className="text-emerald-400">Déjà débité ce mois</span><span className="text-emerald-400">{fmtAbs(paidAll)}</span></div>
          <div className={`flex justify-between font-bold border-t border-[#2D3F55] pt-1 mt-1 ${needColor2}`}>
            <span>Reste à couvrir</span><span>{fmtAbs(needAll)}</span>
          </div>
          {avgVIAll > 0 && <div className="text-[10px] text-slate-500 italic pt-1 border-t border-dashed border-[#2D3F55]">⇄ Virements internes : ~{fmtAbs(avgVIAll)}/mois (neutralisés)</div>}
        </div>
      </div>
    </div>
  );
}

function RecurrencesTab({ recs }: { recs: Recurrence[] }) {
  if (!recs.length) return <div className="text-slate-400 text-sm py-2">Pas assez d'historique pour détecter des récurrences (minimum 2 mois).</div>;
  const byAcc: Record<string, Recurrence[]> = {};
  for (const r of recs) { if (!byAcc[r.account]) byAcc[r.account] = []; byAcc[r.account].push(r); }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {Object.entries(byAcc).map(([acc, accRecs]) => {
        const total = accRecs.reduce((s, r) => s + r.avgAmt, 0);
        const dotColor = ACCOUNT_COLORS[acc] || '#6B7280';
        return (
          <div key={acc} className="bg-[#1E293B] border border-[#2D3F55] rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: dotColor }} />
              <strong className="flex-1 text-sm">{acc}</strong>
              <span className="text-xs text-slate-400">{fmtAbs(total)}/mois · {accRecs.length} récurrences</span>
            </div>
            <div className="space-y-0">
              {accRecs.map((r, i) => (
                <div key={i} className="flex items-center gap-1.5 py-1 border-b border-white/5 last:border-0 text-xs">
                  <span className="text-slate-500 w-8 text-right shrink-0">~{r.avgDay}</span>
                  <span className="flex-1 truncate">{r.merchant} <span className="text-slate-500">{r.cat}</span></span>
                  <span className="text-slate-500 text-[10px] shrink-0">{r.monthsActive}×</span>
                  <span className="text-red-400 font-semibold shrink-0">-{fmtAbs(r.avgAmt)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CatRow({ c }: { c: CategoryRecurrence }) {
  const covered = c.remaining <= 0;
  return (
    <div className="flex items-center gap-1.5 py-1 border-b border-white/5 last:border-0 text-xs">
      <span className={`w-4 text-center shrink-0 ${covered ? 'text-emerald-400' : 'text-yellow-400'}`}>{covered ? '✓' : '○'}</span>
      <span className="flex-1 truncate">{c.cat || 'non classé'}</span>
      <span className="text-slate-500 text-[10px] shrink-0">{fmtAbs(c.spentThisMonth)} / {fmtAbs(c.avgMonthly)}</span>
      <span className={`font-semibold shrink-0 ${covered ? 'text-emerald-400' : 'text-yellow-400'}`}>-{fmtAbs(c.remaining)}</span>
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

function CategoriesTab({ catRecs, catExceptional }: { catRecs: CategoryRecurrence[]; catExceptional: ExceptionalExpense[] }) {
  const ACCOUNTS = ['Compte SG', 'Compte commun Fortuneo', 'CB Yann', 'CB Chloé'];

  if (!catRecs.length) return (
    <>
      <ExceptionalTab exceptional={catExceptional} />
      <div className="text-slate-400 text-sm py-2">Pas assez d'historique pour détecter des dépenses récurrentes par catégorie (minimum 2 mois).</div>
    </>
  );

  const totalAll = catRecs.reduce((s, c) => s + c.avgMonthly, 0);
  const paidAll = catRecs.reduce((s, c) => s + Math.min(c.spentThisMonth, c.avgMonthly), 0);
  const remainingAll = catRecs.reduce((s, c) => s + c.remaining, 0);
  const remainingColor = remainingAll > 0 ? 'text-yellow-400' : 'text-emerald-400';

  return (
    <div>
      <ExceptionalTab exceptional={catExceptional} />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-3">
      {ACCOUNTS.map(acc => {
        const accCats = catRecs.filter(c => c.account === acc);
        if (!accCats.length) return null;
        const totalMonthly = accCats.reduce((s, c) => s + c.avgMonthly, 0);
        const paidAmt = accCats.reduce((s, c) => s + Math.min(c.spentThisMonth, c.avgMonthly), 0);
        const remaining = accCats.reduce((s, c) => s + c.remaining, 0);
        const paidPct = totalMonthly > 0 ? Math.round(paidAmt / totalMonthly * 100) : 0;
        const dotColor = ACCOUNT_COLORS[acc] || '#6B7280';
        const remainTextColor = remaining > 0 ? 'text-yellow-400' : 'text-emerald-400';
        return (
          <div key={acc} className="bg-[#1E293B] border border-[#2D3F55] rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: dotColor }} />
              <span className="text-sm font-bold flex-1 truncate">{acc}</span>
              <span className="text-xs text-slate-400">{fmt(-totalMonthly)}/mois</span>
            </div>
            <div className="flex rounded-full overflow-hidden h-2 mb-2.5 bg-[#2D3F55]">
              <div className="bg-emerald-500 transition-all" style={{ width: `${paidPct}%` }} />
              <div className="bg-yellow-500 transition-all" style={{ width: `${100 - paidPct}%` }} />
            </div>
            <div className="flex gap-3 text-[11px] mb-2.5 flex-wrap">
              <span className="text-emerald-400">✓ Dépensé : {fmtAbs(paidAmt)}</span>
              {remaining > 0 && <span className="text-yellow-400">○ Reste à mobiliser : {fmtAbs(remaining)}</span>}
            </div>
            <div className={`text-sm font-extrabold mb-2 ${remainTextColor}`}>
              {remaining > 0 ? `Besoin cash : ${fmtAbs(remaining)}` : '✓ Budget mensuel couvert'}
            </div>
            <div className="max-h-44 overflow-y-auto">
              {accCats.map((c, i) => <CatRow key={i} c={c} />)}
            </div>
          </div>
        );
      })}

      <div className="bg-[#1E293B] border border-blue-500/30 rounded-xl p-3.5" style={{ background: 'linear-gradient(135deg, #1E293B, #243347)' }}>
        <div className="text-xs text-slate-400 font-bold uppercase tracking-wide mb-2">📊 Synthèse tous comptes</div>
        <div className={`text-2xl font-extrabold mb-1 ${remainingColor}`}>{fmtAbs(remainingAll)}</div>
        <div className="text-xs text-slate-400 mb-3">reste à mobiliser ce mois (par catégorie)</div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between"><span className="text-slate-400">Budget mensuel moyen</span><span>{fmtAbs(totalAll)}</span></div>
          <div className="flex justify-between"><span className="text-emerald-400">Déjà dépensé ce mois</span><span className="text-emerald-400">{fmtAbs(paidAll)}</span></div>
          <div className={`flex justify-between font-bold border-t border-[#2D3F55] pt-1 mt-1 ${remainingColor}`}>
            <span>Reste à mobiliser</span><span>{fmtAbs(remainingAll)}</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

function AlertesTab({ recs, daysLeft }: { recs: Recurrence[]; daysLeft: number }) {
  const overdue = recs.filter(r => r.isOverdue);
  const upcoming = recs.filter(r => r.isUpcoming);
  const paid = recs.filter(r => r.isPaid);
  return (
    <div className="space-y-2.5">
      {overdue.length > 0 && (
        <div className="bg-[#1E293B] border border-[#2D3F55] rounded-xl p-3.5">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">⚠️ En retard — attendu mais non débité</div>
          {overdue.map((r, i) => (
            <div key={i} className="flex items-center gap-2 py-2 border-b border-white/5 last:border-0">
              <span className="text-slate-500 text-xs w-8 text-right shrink-0">~{r.avgDay}</span>
              <span className="text-red-400 shrink-0">⚠</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-100">{r.merchant}</div>
                <div className="text-xs text-slate-500">{r.account} · {r.cat || 'non classé'} · vu {r.monthsActive} mois</div>
              </div>
              <span className="text-red-400 font-semibold shrink-0 text-sm">-{fmtAbs(r.avgAmt)}</span>
            </div>
          ))}
        </div>
      )}
      {upcoming.length > 0 && (
        <div className="bg-[#1E293B] border border-[#2D3F55] rounded-xl p-3.5">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">○ À venir ce mois ({daysLeft}j restants)</div>
          {upcoming.map((r, i) => (
            <div key={i} className="flex items-center gap-2 py-2 border-b border-white/5 last:border-0">
              <span className="text-slate-500 text-xs w-8 text-right shrink-0">~{r.avgDay}</span>
              <span className="text-yellow-400 shrink-0">○</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-100">{r.merchant}</div>
                <div className="text-xs text-slate-500">{r.account} · {r.cat || 'non classé'}</div>
              </div>
              <span className="text-yellow-400 font-semibold shrink-0 text-sm">-{fmtAbs(r.avgAmt)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="bg-[#1E293B] border border-[#2D3F55] rounded-xl p-3.5">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">✓ Déjà débités ce mois ({paid.length})</div>
        <div className="flex flex-wrap gap-1.5">
          {paid.length === 0 && <span className="text-slate-500 text-xs">Aucun pour l'instant</span>}
          {paid.map((r, i) => (
            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-300">
              ✓ {r.merchant} ({fmtAbs(r.paidAmt)})
            </span>
          ))}
        </div>
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

  const filterAndScroll = (f: { account?: string; subcat?: string }) => {
    setFilters({ account: f.account ?? 'all', subcat: f.subcat ?? 'all', macro: 'all', search: '', start: monthStart, end: today });
    // Laisse le temps au tableau filtré de se rerender avant de scroller, sinon la
    // mise en page change après le scroll et la position devient incorrecte.
    setTimeout(() => {
      document.getElementById('transactions-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  return (
    <div>
      <ExceptionalTab exceptional={catExceptional} />
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
                    onClick={() => filterAndScroll({ subcat: cat })}
                    title="Voir les transactions de cette sous-catégorie (tous comptes, ce mois)"
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
                        onClick={() => filterAndScroll({ account: acc, subcat: cat })}
                        title={`Voir les transactions ${cat} · ${acc} (ce mois)`}
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
                    onClick={() => filterAndScroll({ subcat: cat })}
                    title={`Voir les transactions ${cat} (tous comptes, ce mois)`}
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
                    onClick={() => filterAndScroll({ account: acc })}
                    title={`Voir les transactions ${acc} (ce mois)`}
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
                onClick={() => filterAndScroll({})}
                title="Voir toutes les transactions (ce mois)"
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
