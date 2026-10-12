'use client';

import { memo, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, ChartNoAxesCombined, Download, Grid2X2, Maximize, Minimize, Table2, X } from 'lucide-react';
import { batteryBands, compareGeneration, energyBuckets, energySeries, series, summarize, withGaps, type EnergyBucket, type MonitoringPeriod, type MonitorPoint, type PowerKey } from '@/domain/station-monitoring';
import styles from './station-dashboard.module.css';

export type ChartView = 'power' | 'energy' | 'generation' | 'ev' | 'heatmap';
export const chartViews: { id: ChartView; label: string }[] = [
  { id: 'power', label: 'Curva de potência' }, { id: 'energy', label: 'Monitoramento de energia' },
  { id: 'generation', label: 'Comparação de geração' }, { id: 'ev', label: 'Carregadores' }, { id: 'heatmap', label: 'Mapa de calor' },
];
const decimals = (value: number | null) => value === null ? '--' : value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tooltipStyle = { background: 'var(--monitor-popover)', border: '1px solid var(--monitor-border)', borderRadius: 8, color: 'var(--monitor-text)', fontSize: 12 };

function exportReadings(headers: string[], data: (string | number | null)[][], example: boolean, view: ChartView) {
  const rows = [['Origem', ...headers], ...data.map(row => [example ? 'EXEMPLO FICTICIO' : 'Historico selecionado', ...row])];
  const blob = new Blob(['\uFEFF' + rows.map(row => row.map(cell => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `emps-${view}-${example ? 'exemplo' : 'historico'}.csv`; link.click(); URL.revokeObjectURL(url);
}

export const MonitoringChart = memo(function MonitoringChart({ points, previousPoints, previousRange, comparisonLoading, comparisonError, comparisonTruncated, period, view, onView, controls, loading, error, example, onExample, periodLabel, range, timezone }: {
  points: MonitorPoint[]; view: ChartView; onView: (view: ChartView) => void; controls: React.ReactNode;
  loading: boolean; error: string; example: boolean; onExample: () => void; periodLabel: string;
  range: { from: number; to: number }; timezone: string;
  period: MonitoringPeriod; previousPoints: MonitorPoint[]; previousRange: { from: number; to: number };
  comparisonLoading: boolean; comparisonError: string; comparisonTruncated: boolean;
}) {
  const [hidden, setHidden] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [table, setTable] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const wrapper = useRef<HTMLElement>(null);
  const toggle = (key: string) => setHidden(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key]);
  const chartPoints = useMemo(() => withGaps(points), [points]);
  const bands = useMemo(() => batteryBands(points), [points]);
  const energy = useMemo(() => energyBuckets(points, range, period, timezone), [points, range, period, timezone]);
  const previousEnergy = useMemo(() => view === 'generation' ? energyBuckets(previousPoints, previousRange, period, timezone) : [], [previousPoints, previousRange, period, timezone, view]);
  const comparison = useMemo(() => compareGeneration(energy, previousEnergy), [energy, previousEnergy]);
  const calendar = useMemo(() => view === 'heatmap' ? energyBuckets(points, range, 'month', timezone) : [], [points, range, timezone, view]);
  const totals = useMemo(() => summarize(points), [points]);
  const visible = (key: string) => !hidden.includes(key);
  const peak = (key: PowerKey, minimum = false) => {
    const values = points.map(point => point[key]).filter((n): n is number => n !== null);
    return values.length ? (minimum ? Math.min(...values) : Math.max(...values)) : null;
  };
  const minutes = (range.to - range.from) / 60_000;
  const hasDay = minutes <= 1500;
  const tick = (x: number) => new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, ...(hasDay ? { hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit' }) }).format(range.from + x * 60_000);
  const domain: [number, number] = [0, minutes];
  const grid = <CartesianGrid vertical={false} stroke="var(--monitor-grid)" />;
  const axis = { axisLine: false, tickLine: false, tick: { fill: 'var(--monitor-muted)', fontSize: 11 }, width: 46 };
  const shade = bands.map((band, i) => <ReferenceArea key={i} x1={band.start} x2={band.end} fill={band.charging ? '#bd7c4b' : '#398c69'} fillOpacity={.12} strokeOpacity={0} />);
  const legend = (items: { key: string; label: string; color: string }[]) => <div className={styles.legend}>{items.map(item => <button type="button" aria-pressed={visible(item.key)} key={item.key} onClick={() => toggle(item.key)} style={{ opacity: visible(item.key) ? 1 : .4 }}><i style={{ background: item.color }} />{item.label}</button>)}</div>;
  const chartTooltip = <Tooltip contentStyle={tooltipStyle} labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ''} formatter={(value, name) => [decimals(Number(value)), name]} />;
  const hasData = points.some(point => series.some(item => point[item.key] !== null) || point.soc !== null) || (view === 'generation' && previousPoints.some(point => point.solar !== null));
  const energyView = view === 'energy' || view === 'generation' || view === 'heatmap' || (view === 'ev' && period !== 'day');
  const periodName = (at: number) => new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, year: 'numeric', ...(period !== 'year' ? { month: '2-digit' } : {}), ...(period === 'day' || period === 'week' ? { day: '2-digit' } : {}) }).format(at);
  const generationSeries = [{ key: 'previous', label: periodName(previousRange.from), color: '#c4a01c' }, { key: 'current', label: periodName(range.from), color: '#8350b5' }];
  const tableHeaders = view === 'generation' ? ['Posição no período', ...generationSeries.map(item => `${item.label} (kWh)`)] : energyView ? ['Data', ...energySeries.map(item => `${item.label} (kWh)`)] : ['Data', ...series.map(item => `${item.label} (kW)`), 'SOC (%)'];
  const tableRows = useMemo<(string | number | null)[][]>(() => view === 'generation' ? comparison.map(row => [row.label, row.previous, row.current]) : energyView ? (view === 'heatmap' ? calendar : energy).map(row => [row.fullLabel, ...energySeries.map(item => row[item.key])]) : points.map(point => [new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, dateStyle: 'short', timeStyle: 'short' }).format(point.at), ...series.map(item => point[item.key]), point.soc]), [view, comparison, energyView, calendar, energy, points, timezone]);
  const busy = !example && (loading || (view === 'generation' && comparisonLoading));
  const failure = !example && (error || (view === 'generation' && comparisonError));

  return <section ref={wrapper} tabIndex={-1} className={`${styles.panel} ${styles.chartPanel} ${expanded ? styles.expanded : ''}`} aria-label="Histórico de energia" onKeyDown={event => { if (event.key === 'Escape') setExpanded(false); }}>
    <div className={styles.chartToolbar}>
      <div className={styles.segments} role="group" aria-label="Visualização do histórico">{chartViews.map(item => <button type="button" key={item.id} aria-pressed={view === item.id} onClick={() => onView(item.id)}>{view === item.id && (item.id === 'heatmap' ? <Grid2X2 size={14} /> : item.id === 'power' || item.id === 'ev' ? <Activity size={14} /> : <ChartNoAxesCombined size={14} />)}{item.label}</button>)}</div>
      <div className={styles.actions}>
        <button className={styles.iconButton} title="Tabela de dados" aria-label="Tabela de dados" type="button" onClick={() => { setTable(true); dialog.current?.showModal(); }}><Table2 size={17} /></button>
        <button className={styles.iconButton} title="Exportar dados CSV" aria-label="Exportar dados CSV" disabled={!hasData || busy || Boolean(failure)} type="button" onClick={() => exportReadings(tableHeaders, tableRows, example, view)}><Download size={17} /></button>
        <button className={styles.iconButton} title={expanded ? 'Recolher gráfico' : 'Ampliar gráfico'} aria-label={expanded ? 'Recolher gráfico' : 'Ampliar gráfico'} aria-pressed={expanded} type="button" onClick={() => { setExpanded(!expanded); wrapper.current?.focus(); }}>{expanded ? <Minimize size={18} /> : <Maximize size={18} />}</button>
      </div>
    </div>
    <div className={styles.chartControls}><span className={styles.provenance}>{example ? 'Exemplo fictício' : periodLabel}</span>{controls}</div>
    {view === 'power' && <div className={styles.peakStrip}>
      {([['Pico solar', peak('solar')], ['Pico do prédio', peak('load')], ['Carga / descarga da bateria', `${decimals(peak('battery', true))} / ${decimals(peak('battery'))}`], ['Importação / exportação da rede', `${decimals(peak('grid'))} / ${decimals(peak('grid', true))}`], ['Pico dos carregadores', peak('charger')]] as const).map(([label, value]) => <div key={label}><strong>{typeof value === 'string' ? value : decimals(value)} <small>kW</small></strong><span>{label}</span></div>)}
    </div>}
    {view === 'energy' && <div className={styles.peakStrip}>{energySeries.map(item => <div key={item.key}><strong>{decimals(totals[item.key])} <small>kWh</small></strong><span>{item.label}</span></div>)}</div>}
    {view === 'generation' && comparisonTruncated && !example && <p className={styles.footnote} role="status">Comparação parcial: reduza o período para consultar todas as leituras.</p>}
    {busy ? <div className={styles.empty} role="status">Carregando histórico...</div> : failure ? <div className={styles.empty} role="alert">{failure}</div> : !hasData ? <div className={styles.empty}><Table2 size={30} /><strong>Sem leituras neste período</strong><span>Histórico de energia indisponível para a fonte selecionada.</span><button className={styles.softButton} type="button" onClick={onExample}>Ver exemplo de gráfico</button></div> : <>
      {view === 'power' && <>
        <div className={styles.axisCaption}><span>R$/kWh {example ? '' : '· tarifa de energia não informada'}</span><span>SOC (%)</span></div>
        <div className={styles.upperChart}><ResponsiveContainer width="100%" height="100%"><LineChart data={chartPoints} syncId="station-energy" margin={{ left: 4, right: 4, top: 12, bottom: 2 }}>
          {grid}<XAxis dataKey="x" type="number" domain={domain} hide /><YAxis {...axis} yAxisId="left" domain={[0, 'auto']} /><YAxis {...axis} yAxisId="right" orientation="right" domain={[0, 100]} />
          {bands.map((band, i) => <ReferenceArea yAxisId="left" key={i} x1={band.start} x2={band.end} fill={band.charging ? '#bd7c4b' : '#398c69'} fillOpacity={.12} strokeOpacity={0} />)}
          {chartTooltip}
          <Line yAxisId="left" hide={!visible('importTariff')} dataKey="importTariff" name="Tarifa de importação (R$/kWh)" stroke="#ed9d54" dot={false} strokeWidth={1.8} isAnimationActive={false} />
          <Line yAxisId="left" hide={!visible('exportTariff')} dataKey="exportTariff" name="Tarifa de exportação (R$/kWh)" stroke="#45bf91" dot={false} strokeWidth={1.8} isAnimationActive={false} />
          <Line yAxisId="right" hide={!visible('soc')} dataKey="soc" name="SOC (%)" stroke="#49b1bf" dot={false} strokeWidth={1.8} isAnimationActive={false} />
        </LineChart></ResponsiveContainer></div>
        {legend([{ key: 'exportTariff', label: 'Tarifa de exportação', color: '#45bf91' }, { key: 'importTariff', label: 'Tarifa de importação', color: '#ed9d54' }, { key: 'soc', label: 'SOC', color: '#49b1bf' }])}
        <div className={styles.axisCaption}><span>kW</span><span title="Potência da bateria: negativa ao carregar e positiva ao descarregar.">Carga (−) / descarga (+)</span></div>
        <div className={styles.lowerChart}><ResponsiveContainer width="100%" height="100%"><LineChart data={chartPoints} syncId="station-energy" margin={{ left: 4, right: 50, top: 4, bottom: 0 }}>
          {grid}<XAxis {...axis} dataKey="x" type="number" domain={domain} ticks={hasDay ? [0, 240, 480, 720, 960, 1200, 1440] : undefined} tickFormatter={value => value === 1440 && hasDay ? '24:00' : tick(value)} minTickGap={30} /><YAxis {...axis} domain={['auto', 'auto']} />{shade}<ReferenceLine y={0} stroke="var(--monitor-border)" />{chartTooltip}
          {series.map(item => <Line key={item.key} hide={!visible(item.key)} dataKey={item.key} name={item.label} stroke={item.color} strokeWidth={1.6} dot={false} connectNulls={false} isAnimationActive={false} />)}
        </LineChart></ResponsiveContainer></div>
        {legend([...series])}<div className={styles.bandLegend}><span><i style={{ background: '#805a43' }} />Carga</span><span><i style={{ background: '#285e4a' }} />Descarga</span></div>
      </>}
      {(view === 'energy' || view === 'generation' || (view === 'ev' && period !== 'day')) && <>
        <div className={styles.axisCaption}><span>kWh</span></div>
        <div className={styles.barScroll} tabIndex={0} aria-label="Gráfico de energia por período"><div className={styles.largeChart} style={{ minWidth: (view === 'energy' ? energy.length * 48 : energy.length * 24) + 60 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={view === 'generation' ? comparison : energy} barGap={1} barCategoryGap="15%" maxBarSize={8} margin={{ left: 8, right: 16, top: 14, bottom: 8 }}>
          {grid}<XAxis {...axis} dataKey="label" minTickGap={24} height={30} /><YAxis {...axis} domain={[0, 'auto']} tickCount={6} tickFormatter={value => decimals(Number(value))} />
          <Tooltip cursor={{ fill: 'var(--monitor-grid)' }} content={({ active, payload }) => active && payload?.length ? <div className={styles.energyTooltip}><strong>{view === 'generation' ? 'Geração solar' : payload[0].payload.fullLabel}</strong>{payload.map(item => <div key={String(item.dataKey)}><i style={{ background: item.color }} /><span>{view === 'generation' ? item.payload[item.dataKey === 'current' ? 'currentDate' : 'previousDate'] ?? item.name : item.name}</span><b>{decimals(Number(item.value))} <small>kWh</small></b></div>)}</div> : null} />
          {(view === 'generation' ? generationSeries : view === 'ev' ? energySeries.filter(item => item.key === 'charger') : energySeries).map(item => <Bar key={item.key} hide={!visible(`energy-${item.key}`)} dataKey={item.key} name={item.label} fill={item.color} maxBarSize={8} radius={[3, 3, 0, 0]} isAnimationActive={false} />)}
        </BarChart></ResponsiveContainer></div></div>
        {legend((view === 'generation' ? generationSeries : view === 'ev' ? energySeries.filter(item => item.key === 'charger') : energySeries).map(item => ({ ...item, key: `energy-${item.key}` })))}
      </>}
      {view === 'ev' && period === 'day' && <><div className={styles.axisCaption}><span>kW</span></div><div className={styles.largeChart}><ResponsiveContainer width="100%" height="100%"><LineChart data={chartPoints} margin={{ left: 8, right: 16, top: 14, bottom: 8 }}>{grid}<XAxis {...axis} dataKey="x" type="number" domain={domain} ticks={[0, 240, 480, 720, 960, 1200, 1440]} tickFormatter={value => value === 1440 ? '24:00' : tick(value)} minTickGap={24} /><YAxis {...axis} domain={[0, 'auto']} />{chartTooltip}<Line hide={!visible('ev-charger')} dataKey="charger" name="Potência dos carregadores (kW)" stroke="#ce571b" strokeWidth={1.6} dot={false} connectNulls={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>{legend([{ key: 'ev-charger', label: 'Carregadores', color: '#ce571b' }])}</>}
      {view === 'heatmap' && <Heatmap days={calendar} />}
    </>}
    <dialog ref={dialog} className={styles.dialog} aria-label="Tabela de leituras" onClose={() => setTable(false)}>
      <div className={styles.panelHeading}><h2>Leituras · {example ? 'exemplo fictício' : 'fonte selecionada'}</h2><button type="button" className={styles.iconButton} aria-label="Fechar tabela" onClick={() => dialog.current?.close()}><X size={20} /></button></div>
      {table && <div className={styles.tableScroll}><table><thead><tr>{tableHeaders.map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{tableRows.slice(0, 500).map((row, index) => <tr key={index}>{row.map((value, cell) => <td key={cell}>{typeof value === 'string' ? value : decimals(value)}</td>)}</tr>)}</tbody></table>{!hasData && <p className={styles.empty}>Sem leituras.</p>}{tableRows.length > 500 && <p>Exibindo 500 leituras. O CSV contém todas as leituras carregadas.</p>}</div>}
    </dialog>
  </section>;
});

function Heatmap({ days }: { days: EnergyBucket[] }) {
  const values = days.flatMap(day => day.solar === null ? [] : [day.solar]);
  const min = values.length ? Math.min(...values) : 0, max = values.length ? Math.max(...values) : 0;
  const offset = days.length ? (new Date(`${days[0].day}T12:00:00Z`).getUTCDay() + 6) % 7 : 0;
  return <div className={styles.heatmap}>
    <div className={styles.heatScale}><span>Mín. {decimals(min)}</span><i /><span>{decimals(max)} Máx.</span><span>kWh</span></div>
    <div className={styles.calendarGrid}>{['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(label => <span className={styles.calendarHeading} key={label}>{label}</span>)}
      {Array.from({ length: offset }, (_, i) => <span key={`offset-${i}`} />)}
      {days.map(day => <div className={styles.calendarCell} key={day.day} data-empty={day.solar === null} title={`${day.fullLabel}: ${day.solar === null ? 'sem leitura' : decimals(day.solar) + ' kWh'}`}><span>{day.label}</span>{day.solar !== null && <div style={{ background: `hsl(110 48% ${max === min ? 44 : 22 + (day.solar - min) / (max - min) * 30}%)` }}><span>{decimals(day.solar)}</span></div>}</div>)}
    </div>
  </div>;
}
