import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Transaction, AccountName } from './types';
import { ALL_SUBS, SUB2MACRO } from './constants';
import { normalizeMerchant, categorize } from './categorize';

export type FileFormat = 'sg_new' | 'sg_old' | 'fortuneo' | 'generic' | 'unknown';

export function parseAmount(s: unknown): number {
  if (!s) return 0;
  return parseFloat(String(s).replace(/\s/g, '').replace(',', '.')) || 0;
}

export function parseDate(s: unknown): string | null {
  if (!s) return null;
  const m = String(s).match(/(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(String(s))) return String(s).slice(0, 10);
  return null;
}

export function buildTxHash(date: string, label: string, amount: number): string {
  return `${date}|${label.slice(0, 30)}|${amount}`;
}

export function detectFormat(headers: string[]): FileFormat {
  const all = headers
    .map(x => (x || '').toLowerCase().replace(/[^a-zàâéèêîôùûç ]/g, ''))
    .join('|');
  if (all.includes('montant de l') || all.includes('dtail de l') || all.includes('detail de l')) return 'sg_new';
  if (all.includes('date de comptabilisation')) return 'sg_old';
  if (all.includes('bit euros') || all.includes('dit euros')) return 'fortuneo';
  if (all.includes('bit') || all.includes('dit')) return 'generic';
  return 'unknown';
}

function extractSGMerchant(detail: string, shortLabel: string): string {
  const d = detail.trim();
  if (/^ECHEANCE PRET/i.test(d)) return 'PRÊT IMMO';
  if (/^COMMISSION /i.test(d)) {
    const m = d.match(/^COMMISSION (.+?)(?:\s{2,}|$)/);
    return m ? m[1].trim() : shortLabel;
  }
  let m = d.match(/\bDE:\s*(.+?)\s+(ID:|MOTIF:|DATE:|REF:)/i);
  if (m) return m[1].trim();
  m = d.match(/POUR CPTE DE:\s*(.+?)\s+(ID:|MOTIF:)/i);
  if (m) return m[1].trim();
  m = d.match(/POUR:\s*(.+?)\s+\d{2}\s+\d{2}\s+BQ/i);
  if (m) return m[1].trim();
  m = d.match(/\bDE:\s*(.+)$/i);
  if (m) return m[1].trim().split(/\s+/).slice(0, 3).join(' ');
  return normalizeMerchant(shortLabel);
}

function applyCatFromRow(
  merchant: string,
  label: string,
  amount: number,
  row: string[],
  idxCat: number,
  idxMacro: number,
  idxConf: number,
  merchantRules: Record<string, string>
): { cat: string; macro: string; confirmed: boolean } {
  const importedCat = idxCat >= 0 ? (row[idxCat] || '').trim() : '';
  const importedMacro = idxMacro >= 0 ? (row[idxMacro] || '').trim() : '';
  if (importedCat && ALL_SUBS.includes(importedCat)) {
    const macro = importedMacro || SUB2MACRO[importedCat] || 'Non classé';
    const confirmed =
      idxConf >= 0
        ? ['true', '1', 'oui', 'yes'].includes((row[idxConf] || '').toLowerCase())
        : true;
    if (merchant) merchantRules[merchant] = importedCat;
    return { cat: importedCat, macro, confirmed };
  }
  if (importedCat) return { cat: importedCat, macro: importedMacro || 'Non classé', confirmed: false };
  const { cat, macro } = categorize(merchant, label, amount, merchantRules);
  return { cat, macro, confirmed: !!cat };
}

export function parseSGNew(text: string, accountName: string, merchantRules: Record<string, string>): Transaction[] {
  const lines = text.split(/\r?\n/);
  let startLine = 0;
  if (lines[0].startsWith('=') || lines[0].startsWith('"=')) startLine = 1;
  while (startLine < lines.length && !lines[startLine].trim()) startLine++;
  const cleanText = lines.slice(startLine).join('\n');
  const result = Papa.parse<string[]>(cleanText, { delimiter: ';', skipEmptyLines: true });
  const rows = result.data;
  if (rows.length < 2) return [];
  const headers = rows[0].map(x => (x || '').trim());
  const idxDate = headers.findIndex(h => /date/i.test(h));
  const idxLabel = headers.findIndex(h => /libell/i.test(h));
  const idxDetail = headers.findIndex(h => /d.tail|detail/i.test(h));
  const idxAmount = headers.findIndex(h => /montant/i.test(h));
  const idxCat = headers.findIndex(h => /cat.gorie|categorie|sous.cat/i.test(h));
  const idxMacro = headers.findIndex(h => /^macro$/i.test(h));
  const idxConf = headers.findIndex(h => /confirm/i.test(h));
  if (idxDate < 0 || idxAmount < 0) return [];
  const txs: Transaction[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;
    const dateStr = parseDate(row[idxDate]);
    if (!dateStr) continue;
    const shortLabel = (row[idxLabel] || '').trim();
    const detail = idxDetail >= 0 ? (row[idxDetail] || '').trim() : '';
    const fullLabel = detail || shortLabel;
    const amount = parseAmount(row[idxAmount]);
    if (amount === 0 && !fullLabel) continue;
    const merchant = detail
      ? extractSGMerchant(detail, shortLabel).toUpperCase().slice(0, 60)
      : normalizeMerchant(shortLabel);
    const { cat, macro, confirmed } = applyCatFromRow(merchant, fullLabel, amount, row, idxCat, idxMacro, idxConf, merchantRules);
    txs.push({ id: buildTxHash(dateStr, fullLabel, amount), date: dateStr, label: fullLabel, merchant, amount, account: accountName as AccountName, macro, cat, confirmed });
  }
  return txs;
}

export function parseSGOld(text: string, accountName: string, merchantRules: Record<string, string>): Transaction[] {
  const result = Papa.parse<string[]>(text, { delimiter: ';', skipEmptyLines: true });
  const rows = result.data;
  if (rows.length < 2) return parseFortuneoCSV(text, accountName, merchantRules);
  const headers = rows[0].map(x => (x || '').trim());
  const idxDate = headers.findIndex(h => /date/i.test(h));
  const idxLabel = headers.findIndex(h => /libell/i.test(h));
  const idxDebit = headers.findIndex(h => /d.bit/i.test(h));
  const idxCredit = headers.findIndex(h => /cr.dit/i.test(h));
  const idxCat = headers.findIndex(h => /cat.gorie|categorie|sous.cat/i.test(h));
  const idxMacro = headers.findIndex(h => /^macro$/i.test(h));
  const idxConf = headers.findIndex(h => /confirm/i.test(h));
  if (idxDate < 0 || idxLabel < 0) return parseFortuneoCSV(text, accountName, merchantRules);
  const txs: Transaction[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    const dateStr = parseDate(row[idxDate]);
    if (!dateStr) continue;
    const label = (row[idxLabel] || '').trim();
    const debit = idxDebit >= 0 ? parseAmount(row[idxDebit]) : 0;
    const credit = idxCredit >= 0 ? parseAmount(row[idxCredit]) : 0;
    const amount = credit - Math.abs(debit);
    if (amount === 0 && !label) continue;
    const merchant = normalizeMerchant(label);
    const { cat, macro, confirmed } = applyCatFromRow(merchant, label, amount, row, idxCat, idxMacro, idxConf, merchantRules);
    txs.push({ id: buildTxHash(dateStr, label, amount), date: dateStr, label, merchant, amount, account: accountName as AccountName, macro, cat, confirmed });
  }
  return txs;
}

export function parseFortuneoCSV(text: string, accountName: string, merchantRules: Record<string, string>): Transaction[] {
  const firstLine = text.split('\n')[0];
  const sep = firstLine.includes(';') ? ';' : ',';
  const result = Papa.parse<string[]>(text, { delimiter: sep, skipEmptyLines: true });
  const rows = result.data;
  if (rows.length < 2) return [];
  const headers = rows[0].map(x => (x || '').trim());
  const idxDate = headers.findIndex(h => /date/i.test(h));
  const idxLabel = headers.findIndex(h => /libell/i.test(h));
  const idxDebit = headers.findIndex(h => /d.bit/i.test(h));
  const idxCredit = headers.findIndex(h => /cr.dit/i.test(h));
  const idxCat = headers.findIndex(h => /cat.gorie|categorie|sous.cat/i.test(h));
  const idxMacro = headers.findIndex(h => /^macro$/i.test(h));
  const idxConf = headers.findIndex(h => /confirm/i.test(h));
  if (idxDate < 0 || idxLabel < 0) return [];
  const txs: Transaction[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    const dateStr = parseDate(row[idxDate]);
    if (!dateStr) continue;
    const label = (row[idxLabel] || '').trim();
    const debit = idxDebit >= 0 ? parseAmount(row[idxDebit]) : 0;
    const credit = idxCredit >= 0 ? parseAmount(row[idxCredit]) : 0;
    const amount = credit - Math.abs(debit);
    if (amount === 0 && !label) continue;
    const merchant = normalizeMerchant(label);
    const { cat, macro, confirmed } = applyCatFromRow(merchant, label, amount, row, idxCat, idxMacro, idxConf, merchantRules);
    txs.push({ id: buildTxHash(dateStr, label, amount), date: dateStr, label, merchant, amount, account: accountName as AccountName, macro, cat, confirmed });
  }
  return txs;
}

export function parseByFormat(text: string, format: FileFormat, account: string, merchantRules: Record<string, string>): Transaction[] {
  if (format === 'sg_new') return parseSGNew(text, account, merchantRules);
  if (format === 'sg_old') return parseSGOld(text, account, merchantRules);
  if (format === 'fortuneo') return parseFortuneoCSV(text, account, merchantRules);
  return parseFortuneoCSV(text, account, merchantRules);
}

export function guessAccountFromFilename(name: string): string | null {
  const n = name.toLowerCase();
  if (n.includes('yann')) return 'CB Yann';
  if (n.includes('chloe') || n.includes('chloé')) return 'CB Chloé';
  if (n.includes('fortuneo') && n.includes('commun')) return 'Compte commun Fortuneo';
  if (n.includes('sg') || n.includes('societe') || n.includes('soc.gen')) return 'Compte SG';
  return null;
}

export function parseXLSXtoCSV(arrayBuffer: ArrayBuffer): string {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_csv(sheet, { FS: ';' });
}

export function getFormatLabel(fmt: FileFormat): string {
  if (fmt === 'sg_new') return 'SG (nouveau format)';
  if (fmt === 'sg_old') return 'SG (ancien format)';
  if (fmt === 'fortuneo') return 'Fortuneo';
  return 'Générique';
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsText(file, 'windows-1252');
  });
}

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
