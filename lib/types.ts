export type MacroCategory =
  | 'Besoins'
  | 'Envies'
  | 'Épargne'
  | 'Revenus'
  | 'Virements internes'
  | 'Non classé';

export type AccountName =
  | 'CB Yann'
  | 'CB Chloé'
  | 'Compte commun Fortuneo'
  | 'Compte SG';

export interface Transaction {
  id: string;
  date: string;        // YYYY-MM-DD
  label: string;
  merchant: string;
  amount: number;
  account: AccountName | string;
  macro: MacroCategory | string;
  cat: string;
  confirmed: boolean;
}

export interface Filters {
  start: string;
  end: string;
  account: string;
  macro: string;
  subcat: string;
  search: string;
}

export interface SortState {
  key: 'date' | 'amount';
  dir: 1 | -1;
}

export interface ReviewItem {
  merchant: string;
  count: number;
  examples: string[];
}

export interface Recurrence {
  merchant: string;
  account: string;
  cat: string;
  macro: string;
  avgAmt: number;
  avgDay: number;
  monthsActive: number;
  isPaid: boolean;
  isOverdue: boolean;
  isUpcoming: boolean;
  paidAmt: number;
  label: string;
}

export interface CategoryRecurrence {
  account: string;
  cat: string;
  macro: string;
  avgMonthly: number;
  monthsActive: number;
  spentThisMonth: number;
  remaining: number;
}

export interface VIPair {
  debit: Transaction;
  credit: Transaction;
  daysDiff: number;
  selected: boolean;
}
