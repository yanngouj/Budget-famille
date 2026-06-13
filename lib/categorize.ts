import { MacroCategory } from './types';
import { MERCHANT_RULES, KW_RULES, SUB2MACRO } from './constants';

const INCOME_SIGNALS = ['SALAIRE','TENACY','RTE RESEAU','PAIE','CPAM','CAMIEG','PAJEMPLOI','ENERGIE MUTUELLE','CAF ','ALLOC','APL ','PRIME ','BONUS'];
export const TRANSFER_SIGNALS = ['VIR ','VIREMENT','LOGITEL','SEPA '];

export function normalizeMerchant(label: string): string {
  let s = label.toUpperCase();
  s = s.replace(/^(CARTE|CB)\s+\d{2}[\/\-\.]\d{2}([\/\-\.]\d{2,4})?\s*/i, '');
  s = s.replace(/^VIR(EMENT)?\s+(SEPA\s+)?/i, '');
  s = s.replace(/^PRLV\s+(SEPA\s+)?/i, '');
  s = s.replace(/^CHEQUE\s+/i, '');
  s = s.replace(/^RETRAIT\s+(DAB\s+)?/i, '');
  s = s.replace(/^PAIEMENT\s+PAR\s+CARTE\s+/i, '');
  s = s.replace(/^PAIEMENT\s+CARTE\s+\*?/i, '');
  s = s.replace(/\s+\d{6,}.*$/, '');
  s = s.replace(/\d{2}[\/\-\.]\d{2}([\/\-\.]\d{2,4})?/g, '');
  s = s.replace(/REF\s*:?\s*\w+/gi, '');
  return s.trim().replace(/\s+/g, ' ');
}

export function categorize(
  merchant: string,
  label: string,
  amount: number,
  merchantRules: Record<string, string> = MERCHANT_RULES
): { cat: string; macro: MacroCategory } {
  if (amount > 0) {
    const ul = (label || '').toUpperCase();
    if (INCOME_SIGNALS.some(k => ul.includes(k))) {
      if (ul.includes('CAF') || ul.includes('ALLOC') || ul.includes('APL'))
        return { cat: 'CAF', macro: 'Revenus' };
      return { cat: 'salaires', macro: 'Revenus' };
    }
    if (TRANSFER_SIGNALS.some(k => ul.includes(k))) return { cat: '', macro: 'Non classé' };
    if (ul.includes('REMBOURSEMENT') || ul.includes('REMBOURS'))
      return { cat: 'remboursements', macro: 'Revenus' };
    return { cat: '', macro: 'Non classé' };
  }

  const key = merchant.toUpperCase();
  const lbl = label.toUpperCase();

  for (const [k, v] of Object.entries(merchantRules)) {
    if (key.includes(k.toUpperCase())) {
      return { cat: v, macro: SUB2MACRO[v] || 'Non classé' };
    }
  }

  for (const rule of KW_RULES) {
    for (const kw of rule.kw) {
      if (key.includes(kw) || lbl.includes(kw)) {
        return { cat: rule.cat, macro: SUB2MACRO[rule.cat] || 'Non classé' };
      }
    }
  }

  return { cat: '', macro: 'Non classé' };
}
