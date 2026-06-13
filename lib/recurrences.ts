import { Transaction, Recurrence, CategoryRecurrence, ExceptionalExpense } from './types';
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

// Détecte les mois "exceptionnels" au sein d'un groupe : un mois dont le total
// est nettement supérieur (>3x) à la médiane des autres mois est considéré
// comme une dépense ponctuelle (ex: gros virement épargne) et n'est pas pris
// en compte dans le calcul de la moyenne récurrente.
function splitExceptionalMonths(monthlyTotals: Record<string, number>): {
  kept: Record<string, number>;
  exceptional: { month: string; amount: number }[];
} {
  const entries = Object.entries(monthlyTotals);
  const kept: Record<string, number> = {};
  const exceptional: { month: string; amount: number }[] = [];

  for (const [month, amount] of entries) {
    const others = entries.filter(([m]) => m !== month).map(([, v]) => v);
    if (!others.length) {
      kept[month] = amount;
      continue;
    }
    const sorted = [...others].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    if (amount > median * 3 && amount - median > 100) {
      exceptional.push({ month, amount });
    } else {
      kept[month] = amount;
    }
  }

  return { kept, exceptional };
}

export function detectCategoryRecurrences(transactions: Transaction[]): {
  recurrences: CategoryRecurrence[];
  exceptional: ExceptionalExpense[];
} {
  // "Besoins" + les "Envies" qui sont en réalité des abonnements récurrents
  // (sport, divertissement) — le reste des "Envies" (sorties, vacances, shopping...)
  // est trop ponctuel pour représenter un besoin de cash mensuel.
  const RECURRING_ENVIES = ['abonnements sports', 'abonnements divertissements'];
  const txs = transactions.filter(
    t => t.amount < 0 && (t.macro === 'Besoins' || RECURRING_ENVIES.includes(t.cat))
  );
  if (!txs.length) return { recurrences: [], exceptional: [] };

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

  const recurrences: CategoryRecurrence[] = [];
  const exceptional: ExceptionalExpense[] = [];

  for (const [key, group] of Object.entries(groups)) {
    const recentTxs = group.filter(t => t.date.slice(0, 7) >= sixMonthsAgo);
    const pastTxs = recentTxs.filter(t => t.date.slice(0, 7) !== currentMonth);

    const monthlyTotals: Record<string, number> = {};
    for (const t of pastTxs) {
      const m = t.date.slice(0, 7);
      monthlyTotals[m] = (monthlyTotals[m] || 0) + Math.abs(t.amount);
    }

    const [account, cat] = key.split('|');
    const macro = SUB2MACRO[cat] || '';

    const { kept, exceptional: exceptionalMonths } = splitExceptionalMonths(monthlyTotals);
    for (const { month, amount } of exceptionalMonths) {
      exceptional.push({ account, cat, macro, month, amount: Math.round(amount * 100) / 100 });
    }

    // La catégorie est récurrente si elle a eu de l'activité au moins 2 mois
    // (exceptionnels inclus), mais la moyenne ne porte que sur les mois normaux.
    const monthsActiveTotal = Object.keys(monthlyTotals).length;
    if (monthsActiveTotal < 2) continue;

    const monthsActive = Object.keys(kept).length;
    if (monthsActive < 1) continue;

    const avgMonthly = Object.values(kept).reduce((s, v) => s + v, 0) / monthsActive;
    const spentThisMonth = recentTxs
      .filter(t => t.date.slice(0, 7) === currentMonth)
      .reduce((s, t) => s + Math.abs(t.amount), 0);

    recurrences.push({
      account,
      cat,
      macro,
      avgMonthly: Math.round(avgMonthly * 100) / 100,
      monthsActive,
      spentThisMonth: Math.round(spentThisMonth * 100) / 100,
      remaining: Math.round(Math.max(0, avgMonthly - spentThisMonth) * 100) / 100,
    });
  }

  return {
    recurrences: recurrences.sort((a, b) => b.remaining - a.remaining),
    exceptional: exceptional.sort((a, b) => b.amount - a.amount),
  };
}
