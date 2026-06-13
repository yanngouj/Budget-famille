'use client';

import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { useBudgetStore } from '@/store/useBudgetStore';
import { MACROS, ACCOUNT_COLORS } from '@/lib/constants';
import { fmtAbs, fmt } from '@/lib/format';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Title, Tooltip, Legend, Filler,
);

const TICK_COLOR = '#94A3B8';
const GRID_COLOR = '#2D3F5555';
const LEGEND_OPTS = {
  position: 'bottom' as const,
  labels: { color: TICK_COLOR, font: { size: 10 }, boxWidth: 12, padding: 10 },
};
const baseOpts = { responsive: true, maintainAspectRatio: false, animation: { duration: 150 } };

function shortMonth(ym: string) {
  const [y, m] = ym.split('-');
  return `${'jan fév mar avr mai jun jul aoû sep oct nov déc'.split(' ')[+m - 1]} ${y.slice(2)}`;
}

function getMonthlyData(txs: ReturnType<typeof useBudgetStore.getState>['filtered']) {
  const months: Record<string, Record<string, number>> = {};
  for (const t of txs) {
    if (t.macro === 'Virements internes') continue;
    const mo = t.date.slice(0, 7);
    if (!months[mo]) months[mo] = { Besoins: 0, Envies: 0, Épargne: 0, Revenus: 0 };
    if (t.macro in months[mo]) months[mo][t.macro] += Math.abs(t.amount);
  }
  const labels = Object.keys(months).sort();
  return { labels, months };
}

export default function Charts() {
  const { filtered: txs, setFilters, chartMonthFilter, setChartMonthFilter } = useBudgetStore();

  if (!txs.length) return null;

  const expenses = txs.filter(t => t.amount < 0);
  const { labels, months } = getMonthlyData(txs);
  const shortLabels = labels.map(shortMonth);

  // Chart 1: monthly stacked
  const macros = ['Besoins', 'Envies', 'Épargne'];
  const c1 = {
    labels: shortLabels,
    datasets: macros.map(m => ({
      label: m,
      data: labels.map(l => +(months[l]?.[m] || 0).toFixed(2)),
      backgroundColor: MACROS[m as keyof typeof MACROS].color + 'CC',
      borderColor: MACROS[m as keyof typeof MACROS].color,
      borderWidth: 1,
      stack: 'stack',
    })),
  };

  function onClickMonth(idx: number) {
    const ym = labels[idx];
    const [y, mo] = ym.split('-');
    const lastDay = new Date(+y, +mo, 0).getDate();
    setFilters({ start: `${ym}-01`, end: `${ym}-${String(lastDay).padStart(2, '0')}` });
    setChartMonthFilter(ym);
  }

  // Chart 2: revenues + balance
  const revByMonth = labels.map(l => +(months[l]?.Revenus || 0).toFixed(2));
  const depByMonth = labels.map(l => +((months[l]?.Besoins || 0) + (months[l]?.Envies || 0)).toFixed(2));
  const balByMonth = labels.map((_, i) => +(revByMonth[i] - depByMonth[i]).toFixed(2));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c2: any = {
    labels: shortLabels,
    datasets: [
      { type: 'bar', label: 'Revenus', data: revByMonth, backgroundColor: '#8B5CF6AA', borderColor: '#8B5CF6', borderWidth: 1 },
      { type: 'bar', label: 'Dépenses', data: depByMonth, backgroundColor: '#EF4444AA', borderColor: '#EF4444', borderWidth: 1 },
      { type: 'line', label: 'Balance', data: balByMonth, borderColor: '#10B981', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 3, tension: 0.4 },
    ],
  };

  // Chart 3: donut macro
  const macroTotals: Record<string, number> = {};
  for (const t of expenses) {
    const m = t.macro || 'Non classé';
    macroTotals[m] = (macroTotals[m] || 0) + Math.abs(t.amount);
  }
  const dk = Object.keys(macroTotals).filter(k => macroTotals[k] > 0);
  const c3 = {
    labels: dk,
    datasets: [{ data: dk.map(k => +macroTotals[k].toFixed(2)), backgroundColor: dk.map(k => (MACROS[k as keyof typeof MACROS]?.color || '#6B7280') + 'CC'), borderColor: dk.map(k => MACROS[k as keyof typeof MACROS]?.color || '#6B7280'), borderWidth: 2 }],
  };

  // Chart 4: besoins detail
  const bTotals: Record<string, number> = {};
  for (const t of expenses.filter(t => t.macro === 'Besoins')) {
    const c = t.cat || 'autre';
    bTotals[c] = (bTotals[c] || 0) + Math.abs(t.amount);
  }
  const bk = Object.keys(bTotals).sort((a, b) => bTotals[b] - bTotals[a]);
  const c4 = { labels: bk, datasets: [{ data: bk.map(k => +bTotals[k].toFixed(2)), backgroundColor: '#3B82F6AA', borderColor: '#3B82F6', borderWidth: 1 }] };

  // Chart 5: envies detail
  const eTotals: Record<string, number> = {};
  for (const t of expenses.filter(t => t.macro === 'Envies')) {
    const c = t.cat || 'autre';
    eTotals[c] = (eTotals[c] || 0) + Math.abs(t.amount);
  }
  const ek = Object.keys(eTotals).sort((a, b) => eTotals[b] - eTotals[a]);
  const c5 = { labels: ek, datasets: [{ data: ek.map(k => +eTotals[k].toFixed(2)), backgroundColor: '#F59E0BAA', borderColor: '#F59E0B', borderWidth: 1 }] };

  // Chart 6: savings
  const savByMonth = labels.map(l => +(months[l]?.Épargne || 0).toFixed(2));
  let cumSav = 0;
  const cumSavByMonth = savByMonth.map(v => +(cumSav += v).toFixed(2));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c6: any = {
    labels: shortLabels,
    datasets: [
      { type: 'bar', label: 'Épargne mensuelle', data: savByMonth, backgroundColor: '#10B981AA', borderColor: '#10B981', borderWidth: 1, yAxisID: 'y' },
      { type: 'line', label: 'Cumul', data: cumSavByMonth, borderColor: '#34D399', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 2, tension: 0.4, yAxisID: 'y2' },
    ],
  };

  // Chart 7: evolution
  const c7 = {
    labels: shortLabels,
    datasets: [
      { label: 'Besoins', data: labels.map(l => +(months[l]?.Besoins || 0).toFixed(2)), borderColor: '#3B82F6', backgroundColor: '#3B82F622', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 2 },
      { label: 'Envies', data: labels.map(l => +(months[l]?.Envies || 0).toFixed(2)), borderColor: '#F59E0B', backgroundColor: '#F59E0B22', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 2 },
    ],
  };

  // Chart 8: by account
  const accTotals: Record<string, number> = {};
  for (const t of expenses) accTotals[t.account] = (accTotals[t.account] || 0) + Math.abs(t.amount);
  const ak = Object.keys(accTotals).filter(k => accTotals[k] > 0);
  const c8 = {
    labels: ak,
    datasets: [{ data: ak.map(k => +accTotals[k].toFixed(2)), backgroundColor: ak.map(k => (ACCOUNT_COLORS[k] || '#6B7280') + 'CC'), borderColor: ak.map(k => ACCOUNT_COLORS[k] || '#6B7280'), borderWidth: 2 }],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cb = (v: any) => fmtAbs(+v);
  const axisOpts = {
    x: { grid: { color: GRID_COLOR }, ticks: { color: TICK_COLOR, maxRotation: 45 } },
    y: { grid: { color: GRID_COLOR }, ticks: { color: TICK_COLOR, callback: cb } },
  };

  const card = (title: string, children: React.ReactNode) => (
    <div className="bg-[#1E293B] border border-[#2D3F55] rounded-xl p-3.5">
      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2.5">{title}</div>
      {children}
    </div>
  );

  return (
    <div className="mb-5 space-y-3.5">
      {chartMonthFilter && (
        <div className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-700/30 rounded-lg px-3 py-2">
          📅 Filtré sur {shortMonth(chartMonthFilter)} — <button onClick={() => { setChartMonthFilter(null); setFilters({ start: '', end: '' }); }} className="underline">Réinitialiser</button>
        </div>
      )}

      {card('📊 Dépenses par mois',
        <div style={{ height: 220 }}>
          <Bar data={c1} options={{
            ...baseOpts, plugins: { legend: LEGEND_OPTS, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmtAbs(ctx.raw as number)}` } } },
            scales: { x: { ...axisOpts.x, stacked: true }, y: { ...axisOpts.y, stacked: true } },
            onClick: (_, els) => { if (els.length) onClickMonth(els[0].index); },
          }} />
        </div>
      )}

      {card('📈 Revenus & Balance mensuelle',
        <div style={{ height: 200 }}>
          <Bar data={c2} options={{
            ...baseOpts, plugins: { legend: LEGEND_OPTS, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.raw as number)}` } } },
            scales: axisOpts,
          }} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {card('🍩 Répartition macro',
          <div style={{ height: 180 }}>
            <Doughnut data={c3} options={{ ...baseOpts, cutout: '65%', plugins: { legend: LEGEND_OPTS, tooltip: { callbacks: { label: ctx => `${ctx.label}: ${fmtAbs(ctx.raw as number)}` } } } }} />
          </div>
        )}
        {card('🏠 Détail Besoins',
          <div style={{ height: 180 }}>
            <Bar data={c4} options={{ ...baseOpts, indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => fmtAbs(ctx.raw as number) } } }, scales: { x: { ...axisOpts.x }, y: { grid: { display: false }, ticks: { color: TICK_COLOR, font: { size: 10 } } } } }} />
          </div>
        )}
        {card('🛍 Détail Envies',
          <div style={{ height: 180 }}>
            <Bar data={c5} options={{ ...baseOpts, indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => fmtAbs(ctx.raw as number) } } }, scales: { x: { ...axisOpts.x }, y: { grid: { display: false }, ticks: { color: TICK_COLOR, font: { size: 10 } } } } }} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {card('💚 Épargne mensuelle',
          <div style={{ height: 180 }}>
            <Bar data={c6} options={{ ...baseOpts, plugins: { legend: LEGEND_OPTS, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmtAbs(ctx.raw as number)}` } } }, scales: { x: axisOpts.x, y: { ...axisOpts.y, position: 'left' }, y2: { position: 'right', grid: { display: false }, ticks: { color: '#34D399', callback: cb } } } }} />
          </div>
        )}
        {card('📉 Évolution Besoins / Envies',
          <div style={{ height: 180 }}>
            <Line data={c7} options={{ ...baseOpts, plugins: { legend: LEGEND_OPTS, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmtAbs(ctx.raw as number)}` } } }, scales: axisOpts }} />
          </div>
        )}
        {card('🏦 Par compte',
          <div style={{ height: 180 }}>
            <Doughnut data={c8} options={{ ...baseOpts, cutout: '60%', plugins: { legend: LEGEND_OPTS, tooltip: { callbacks: { label: ctx => `${ctx.label}: ${fmtAbs(ctx.raw as number)}` } } } }} />
          </div>
        )}
      </div>
    </div>
  );
}
