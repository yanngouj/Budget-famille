import { Transaction, VIPair } from './types';

export function detectInternalTransfers(transactions: Transaction[]): VIPair[] {
  const debits = transactions.filter(t => t.amount < 0);
  const credits = transactions.filter(t => t.amount > 0);

  const creditsByAmt: Record<number, Transaction[]> = {};
  for (const c of credits) {
    const key = Math.round(Math.abs(c.amount) * 100);
    if (!creditsByAmt[key]) creditsByAmt[key] = [];
    creditsByAmt[key].push(c);
  }

  const candidates: VIPair[] = [];
  for (const debit of debits) {
    const key = Math.round(Math.abs(debit.amount) * 100);
    const matches = creditsByAmt[key] || [];
    for (const credit of matches) {
      if (credit.account === debit.account) continue;
      const d1 = new Date(debit.date);
      const d2 = new Date(credit.date);
      const daysDiff = Math.abs((d2.getTime() - d1.getTime()) / 86400000);
      if (daysDiff > 5) continue;
      candidates.push({ debit, credit, daysDiff, selected: true });
    }
  }

  candidates.sort(
    (a, b) =>
      a.daysDiff - b.daysDiff || a.debit.date.localeCompare(b.debit.date)
  );

  const usedIds = new Set<string>();
  const pairs: VIPair[] = [];
  for (const pair of candidates) {
    if (usedIds.has(pair.debit.id) || usedIds.has(pair.credit.id)) continue;
    usedIds.add(pair.debit.id);
    usedIds.add(pair.credit.id);
    pairs.push(pair);
  }

  return pairs.sort((a, b) => b.debit.date.localeCompare(a.debit.date));
}
