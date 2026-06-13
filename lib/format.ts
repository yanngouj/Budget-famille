const eurFmt = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export function fmt(n: number | null | undefined): string {
  if (n === undefined || n === null) return '—';
  return eurFmt.format(n);
}

export function fmtAbs(n: number): string {
  return eurFmt.format(Math.abs(n));
}
