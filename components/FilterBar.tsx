'use client';

import { useBudgetStore } from '@/store/useBudgetStore';
import { SUBS, SUB2MACRO } from '@/lib/constants';

export default function FilterBar() {
  const { filters, setFilters, resetFilters, setPageSize, pageSize } = useBudgetStore();

  function onMacroChange(macro: string) {
    setFilters({ macro, subcat: 'all' });
  }

  const subcatOptions = () => {
    const m = filters.macro;
    if (m === 'all' || m === 'Non classé') {
      return (
        <>
          <option value="all">Toutes</option>
          {Object.entries(SUBS).map(([macro, subs]) => (
            <optgroup key={macro} label={macro}>
              {subs.map(s => <option key={s} value={s}>{s}</option>)}
            </optgroup>
          ))}
          <optgroup label="Non classé"><option value="">— vide —</option></optgroup>
        </>
      );
    }
    if (SUBS[m]) {
      return (
        <>
          <option value="all">Toutes</option>
          {SUBS[m].map(s => <option key={s} value={s}>{s}</option>)}
          <option value="">— non classé —</option>
        </>
      );
    }
    return <option value="all">Toutes</option>;
  };

  return (
    <div className="bg-[#243347] border-b border-[#2D3F55] px-5 py-2 flex gap-2.5 items-center flex-wrap text-sm">
      <label className="flex items-center gap-1.5">
        <span className="text-xs text-slate-400">Du</span>
        <input type="date" value={filters.start} onChange={e => setFilters({ start: e.target.value })} className="input-sm" />
      </label>
      <label className="flex items-center gap-1.5">
        <span className="text-xs text-slate-400">Au</span>
        <input type="date" value={filters.end} onChange={e => setFilters({ end: e.target.value })} className="input-sm" />
      </label>
      <label className="flex items-center gap-1.5">
        <span className="text-xs text-slate-400">Compte</span>
        <select value={filters.account} onChange={e => setFilters({ account: e.target.value })} className="input-sm">
          <option value="all">Tous les comptes</option>
          <option value="CB Yann">CB Yann</option>
          <option value="CB Chloé">CB Chloé</option>
          <option value="Compte commun Fortuneo">Commun Fortuneo</option>
          <option value="Compte SG">Compte SG</option>
        </select>
      </label>
      <label className="flex items-center gap-1.5">
        <span className="text-xs text-slate-400">Macro</span>
        <select value={filters.macro} onChange={e => onMacroChange(e.target.value)} className="input-sm">
          <option value="all">Toutes catégories</option>
          <option value="Besoins">Besoins</option>
          <option value="Envies">Envies</option>
          <option value="Épargne">Épargne</option>
          <option value="Revenus">Revenus</option>
          <option value="Non classé">Non classé</option>
          <option value="Virements internes">Virements internes</option>
        </select>
      </label>
      <label className="flex items-center gap-1.5">
        <span className="text-xs text-slate-400">Sous-cat.</span>
        <select value={filters.subcat} onChange={e => setFilters({ subcat: e.target.value })} className="input-sm min-w-[180px]">
          {subcatOptions()}
        </select>
      </label>
      <input
        type="text" placeholder="🔍 Rechercher…"
        value={filters.search} onChange={e => setFilters({ search: e.target.value })}
        className="input-sm w-44"
      />
      <button onClick={resetFilters} className="btn-secondary text-xs py-1 px-2">✕ Réinitialiser</button>
      <label className="flex items-center gap-1.5 ml-auto">
        <span className="text-xs text-slate-400">Afficher</span>
        <select value={pageSize} onChange={e => setPageSize(+e.target.value)} className="input-sm">
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
          <option value={500}>500</option>
        </select>
      </label>
    </div>
  );
}
