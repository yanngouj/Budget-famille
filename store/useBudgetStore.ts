'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Transaction, Filters, SortState, ReviewItem } from '@/lib/types';
import { MERCHANT_RULES, SUB2MACRO } from '@/lib/constants';
import { TRANSFER_SIGNALS } from '@/lib/categorize';
import { categorize } from '@/lib/categorize';

interface BudgetStore {
  transactions: Transaction[];
  merchantRules: Record<string, string>;

  // UI state (not persisted)
  filtered: Transaction[];
  filters: Filters;
  sort: SortState;
  page: number;
  pageSize: number;
  chartMonthFilter: string | null;

  // Actions
  importTransactions: (newTxs: Transaction[]) => number;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  learnMerchantRule: (merchant: string, cat: string) => void;
  confirmOne: (id: string) => void;
  confirmAllFiltered: () => void;
  applyVI: (ids: string[]) => void;
  applyRecat: (patches: { id: string; cat: string; macro: string }[]) => void;
  clearAll: () => void;
  exportJSON: () => void;
  importJSON: (txs: Transaction[]) => void;

  // Filter actions
  setFilters: (f: Partial<Filters>) => void;
  setSort: (key: 'date' | 'amount') => void;
  setPage: (p: number) => void;
  setPageSize: (n: number) => void;
  setChartMonthFilter: (month: string | null) => void;
  applyFilters: () => void;
  resetFilters: () => void;

  // Derived
  reviewQueue: () => ReviewItem[];
  unconfirmedCount: () => number;
}

const defaultFilters: Filters = {
  start: '', end: '', account: 'all', macro: 'all', subcat: 'all', search: '',
};

function computeFiltered(transactions: Transaction[], filters: Filters, sort: SortState): Transaction[] {
  let txs = transactions;
  if (filters.start) txs = txs.filter(t => t.date >= filters.start);
  if (filters.end) txs = txs.filter(t => t.date <= filters.end);
  if (filters.account !== 'all') txs = txs.filter(t => t.account === filters.account);
  if (filters.macro !== 'all') txs = txs.filter(t => t.macro === filters.macro);
  if (filters.subcat === '') txs = txs.filter(t => !t.cat);
  else if (filters.subcat !== 'all') txs = txs.filter(t => t.cat === filters.subcat);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    txs = txs.filter(t =>
      (t.label || '').toLowerCase().includes(q) ||
      (t.merchant || '').toLowerCase().includes(q) ||
      (t.cat || '').toLowerCase().includes(q)
    );
  }
  return [...txs].sort((a, b) => {
    let av: string | number = a[sort.key];
    let bv: string | number = b[sort.key];
    if (sort.key === 'amount') { av = Math.abs(av as number); bv = Math.abs(bv as number); }
    if (av < bv) return -sort.dir;
    if (av > bv) return sort.dir;
    return 0;
  });
}

export const useBudgetStore = create<BudgetStore>()(
  persist(
    (set, get) => ({
      transactions: [],
      merchantRules: { ...MERCHANT_RULES },
      filtered: [],
      filters: { ...defaultFilters },
      sort: { key: 'date', dir: -1 },
      page: 1,
      pageSize: 50,
      chartMonthFilter: null,

      importTransactions: (newTxs) => {
        const existing = new Set(get().transactions.map(t => t.id));
        let added = 0;
        const toAdd: Transaction[] = [];
        for (const tx of newTxs) {
          if (!existing.has(tx.id)) { toAdd.push(tx); added++; }
        }
        const merged = [...get().transactions, ...toAdd].sort((a, b) =>
          b.date.localeCompare(a.date)
        );
        const filtered = computeFiltered(merged, get().filters, get().sort);
        set({ transactions: merged, filtered });
        return added;
      },

      updateTransaction: (id, patch) => {
        const transactions = get().transactions.map(t =>
          t.id === id ? { ...t, ...patch } : t
        );
        const filtered = computeFiltered(transactions, get().filters, get().sort);
        set({ transactions, filtered });
      },

      learnMerchantRule: (merchant, cat) => {
        set(s => ({ merchantRules: { ...s.merchantRules, [merchant]: cat } }));
      },

      confirmOne: (id) => {
        const tx = get().transactions.find(t => t.id === id);
        if (tx && tx.cat) {
          get().updateTransaction(id, { confirmed: true });
        }
      },

      confirmAllFiltered: () => {
        const filteredIds = new Set(get().filtered.map(t => t.id));
        const transactions = get().transactions.map(t =>
          filteredIds.has(t.id) && t.cat ? { ...t, confirmed: true } : t
        );
        const filtered = computeFiltered(transactions, get().filters, get().sort);
        set({ transactions, filtered });
      },

      applyVI: (ids) => {
        const idSet = new Set(ids);
        const transactions = get().transactions.map(t =>
          idSet.has(t.id)
            ? { ...t, macro: 'Virements internes', cat: 'virement interne', confirmed: true }
            : t
        );
        const filtered = computeFiltered(transactions, get().filters, get().sort);
        set({ transactions, filtered });
      },

      applyRecat: (patches) => {
        const patchMap = new Map(patches.map(p => [p.id, p]));
        const transactions = get().transactions.map(t => {
          const p = patchMap.get(t.id);
          return p ? { ...t, cat: p.cat, macro: p.macro, confirmed: false } : t;
        });
        // Learn merchant rules
        patches.forEach(p => {
          const tx = get().transactions.find(t => t.id === p.id);
          if (tx?.merchant) get().learnMerchantRule(tx.merchant, p.cat);
        });
        const filtered = computeFiltered(transactions, get().filters, get().sort);
        set({ transactions, filtered });
      },

      clearAll: () => set({ transactions: [], filtered: [] }),

      exportJSON: () => {
        const blob = new Blob([JSON.stringify(get().transactions, null, 2)], {
          type: 'application/json',
        });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `budget-famille-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
      },

      importJSON: (txs) => {
        // Learn confirmed merchant rules
        const rules = { ...get().merchantRules };
        txs.forEach(t => {
          if (t.confirmed && t.cat && t.merchant) rules[t.merchant] = t.cat;
        });
        set({ merchantRules: rules });
        get().importTransactions(txs);
      },

      setFilters: (f) => {
        const filters = { ...get().filters, ...f };
        const filtered = computeFiltered(get().transactions, filters, get().sort);
        set({ filters, filtered, page: 1 });
      },

      setSort: (key) => {
        const sort: SortState = {
          key,
          dir: get().sort.key === key ? (get().sort.dir === 1 ? -1 : 1) : -1,
        };
        const filtered = computeFiltered(get().transactions, get().filters, sort);
        set({ sort, filtered });
      },

      setPage: (page) => set({ page }),
      setPageSize: (pageSize) => set({ pageSize, page: 1 }),
      setChartMonthFilter: (chartMonthFilter) => set({ chartMonthFilter }),

      applyFilters: () => {
        const filtered = computeFiltered(get().transactions, get().filters, get().sort);
        set({ filtered, page: 1 });
      },

      resetFilters: () => {
        const filters = { ...defaultFilters };
        const filtered = computeFiltered(get().transactions, filters, get().sort);
        set({ filters, filtered, page: 1, chartMonthFilter: null });
      },

      reviewQueue: () => {
        const unknown = get().transactions.filter(t => !t.cat);
        const map: Record<string, { count: number; examples: string[] }> = {};
        for (const t of unknown) {
          const m = t.merchant || t.label.slice(0, 30);
          if (!map[m]) map[m] = { count: 0, examples: [] };
          map[m].count++;
          if (map[m].examples.length < 2) map[m].examples.push(t.label);
        }
        return Object.entries(map)
          .sort((a, b) => b[1].count - a[1].count)
          .map(([merchant, { count, examples }]) => ({ merchant, count, examples }));
      },

      unconfirmedCount: () => get().transactions.filter(t => !t.confirmed).length,
    }),
    {
      name: 'budget-famille-v2',
      partialize: (s) => ({
        transactions: s.transactions,
        merchantRules: s.merchantRules,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const filtered = computeFiltered(state.transactions, state.filters, state.sort);
          state.filtered = filtered;
        }
      },
    }
  )
);
