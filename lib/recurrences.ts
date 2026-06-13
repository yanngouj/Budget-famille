import { Transaction, Recurrence, CategoryRecurrence } from './types';
import { SUB2MACRO } from './constants';

export function detectRecurrences(transactions: Transaction[]): Recurrence[] {
  const txs = transactions.filter(
    t => t.amount < 0 && t.macro !== 'Virements internes' && t.cat !== 'virement interne'
  );
  if (!txs.length) return [];

  const groups: Record<string, Transaction[]> = {};
  for (const t of txs) {
    const roundedAmt = Math.round(Math.abs(t.amount) / 5) * 5;
    const key = `${(t.merchant || '').slice(0, 25)}|${t.account || ''}|${roundedAmt}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1)
    .toISOString()
    .slice(0, 7);

  const recurrences: Recurrence[] = [];

  for (const [key, group] of Object.entries(groups)) {
    const recentTxs = group.filter(t => t.date.slice(0, 7) >= sixMonthsAgo);
    const recentMonths = [...new Set(recentTxs.map(t => t.date.slice(0, 7)))].sort();
    if (recentMonths.length < 2) continue;

    const amounts = recentTxs.map(t => Math.abs(t.amount || 0));
    const days = recentTxs.map(t => parseInt((t.date || '2000-01-01').slice(8, 10)));
    const avgAmt = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const avgDay = Math.round(days.reduce((s, d) => s + d, 0) / days.length);
    const [merchant, account] = key.split('|');

    const paidThisMonth = recentTxs.filter(t => t.date.slice(0, 7) === currentMonth);
    const isPaid = paidThisMonth.length > 0;
    const paidAmt = paidThisMonth.reduce((s, t) => s + Math.abs(t.amount), 0);

    const today = now.getDate();
    const isOverdue = !isPaid && avgDay < today - 2;
    const isUpcoming = !isPaid && !isOverdue;

    recurrences.push({
      merchant: merchant.trim(),
      account,
      cat: recentTxs[0]?.cat || '',
      macro: recentTxs[0]?.macro || '',
      avgAmt: Math.round(avgAmt * 100) / 100,
      avgDay,
      monthsActive: recentMonths.length,
      isPaid,
      isOverdue,
      isUpcoming,
      paidAmt: Math.round(paidAmt * 100) / 100,
      label: recentTxs[0]?.label?.slice(0, 50) || merchant,
    });
  }

  return recurrences.sort((a, b) => a.avgDay - b.avgDay);
}

export function detectCategoryRecurrences(transactions: Transaction[]): CategoryRecurrence[] {
  const txs = transactions.filter(
    t => t.amount < 0 && t.macro !== 'Virements internes' && t.cat !== 'virement interne'
  );
  if (!txs.length) return [];

  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1)
    .toISOString()
    .slice(0, 7);

  const groups: Record<string, Transaction[]> = {};
  for (const t of txs) {
    const key = `${t.account || ''}|${t.cat || ''}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  const result: CategoryRecurrence[] = [];

  for (const [key, group] of Object.entries(groups)) {
    const recentTxs = group.filter(t => t.date.slice(0, 7) >= sixMonthsAgo);
    const pastTxs = recentTxs.filter(t => t.date.slice(0, 7) !== currentMonth);

    const monthlyTotals: Record<string, number> = {};
    for (const t of pastTxs) {
      const m = t.date.slice(0, 7);
      monthlyTotals[m] = (monthlyTotals[m] || 0) + Math.abs(t.amount);
    }
    const monthsActive = Object.keys(monthlyTotals).length;
    if (monthsActive < 2) continue;

    const avgMonthly = Object.values(monthlyTotals).reduce((s, v) => s + v, 0) / monthsActive;
    const spentThisMonth = recentTxs
      .filter(t => t.date.slice(0, 7) === currentMonth)
      .reduce((s, t) => s + Math.abs(t.amount), 0);

    const [account, cat] = key.split('|');

    result.push({
      account,
      cat,
      macro: SUB2MACRO[cat] || '',
      avgMonthly: Math.round(avgMonthly * 100) / 100,
      monthsActive,
      spentThisMonth: Math.round(spentThisMonth * 100) / 100,
      remaining: Math.round(Math.max(0, avgMonthly - spentThisMonth) * 100) / 100,
    });
  }

  return result.sort((a, b) => b.remaining - a.remaining);
}
