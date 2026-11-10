import { useMemo, useState } from 'react'
import { progressScopes, weeklyProgress } from './weeklyProgress.js'

const segments = [
  { key: 'done', label: 'Erledigt', color: '#329961' },
  { key: 'active', label: 'In Bearbeitung', color: '#e7bc32' },
  { key: 'late', label: 'Überfällig', color: '#d45850' },
  { key: 'pending', label: 'Noch nicht begonnen / keine Meldung', color: '#b7c1cb' },
]
const percent = value => value == null ? '–' : `${Math.round(value)} %`
export default function WeeklyProgress({ data, project, owner, now }) {
  const [scopeId, setScopeId] = useState('all')
  const [selected, setSelected] = useState(null)
  const scopes = useMemo(() => progressScopes(data.tasks, project, owner), [data.tasks, project, owner])
  const scope = scopes.find(s => s.id === scopeId) || scopes[0]
  const chart = useMemo(() => weeklyProgress(scope.tasks, data.reports, now), [scope, data.reports, now])
  const weeks = chart.weeks
  const width = Math.max(680, weeks.length * 46 + 120), height = 380
  const left = 58, right = width - 58, top = 44, bottom = 302
  const maxCount = Math.max(4, ...weeks.map(w => w.done + w.active + w.late + w.pending))
  const ceiling = Math.ceil(maxCount / 4) * 4
  const x = i => left + (i + .5) * (right - left) / Math.max(1, weeks.length)
  const y = value => bottom - value / ceiling * (bottom - top)
  const py = value => bottom - value / 100 * (bottom - top)
  const points = key => weeks.map((w, i) => w[key] == null ? null : `${x(i)},${py(w[key])}`).filter(Boolean).join(' ')
  const detail = weeks.find(w => w.key === selected) || weeks.find(w => w.current) || weeks[0]
  return <section className="weekly-progress" aria-labelledby="weekly-title">
    <h3 id="weekly-title">Grafische Auswertung · Wochen und S-Kurve</h3>
    <label>Auswertung für<select value={scope.id} onChange={e => { setScopeId(e.target.value); setSelected(null) }}>{scopes.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
    <p>{chart.total} aktive Einzelvorgänge · Stand: {now.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })} (Berlin)</p>
    {!owner && <p>Diese Auswertung umfasst ausschließlich deine freigegebenen Aufgaben.</p>}
    {chart.omitted > 0 && <p role="status">{chart.omitted} Vorgänge ohne gültiges Planende sind nicht im Diagramm enthalten.</p>}
    {chart.error && <p role="alert">{chart.error}</p>}
    {!weeks.length ? <p>Für diesen Bereich sind noch keine auswertbaren Einzelvorgänge mit gültigem Planende vorhanden.</p> : <>
      <div className="weekly-legend">{segments.map(s => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}<span><i className="weekly-plan" />Soll kumuliert</span><span><i className="weekly-actual" />Ist kumuliert</span></div>
      <div className="weekly-scroll" tabIndex="0" role="region" aria-label="Wochenübersicht, bei Bedarf horizontal verschieben">
        <svg className="weekly-chart" viewBox={`0 0 ${width} ${height}`} style={{ minWidth: width }} role="img" aria-label={`${scope.label}: Aufgaben nach geplanter Fertigstellungswoche. Gestapelte Säulen mit aktuellem Status und kumulierte Soll-/Ist-Fortschrittskurven.`}>
          <text x={left} y="18">Aufgaben / Woche</text><text x={right} y="18" textAnchor="end">Kumuliert (%)</text>
          {[0, 1, 2, 3, 4].map(i => <g key={i}><line x1={left} x2={right} y1={y(i * ceiling / 4)} y2={y(i * ceiling / 4)} className="weekly-grid" /><text x={left - 10} y={y(i * ceiling / 4) + 4} textAnchor="end">{i * ceiling / 4}</text><text x={right + 8} y={py(i * 25) + 4}>{i * 25} %</text></g>)}
          {weeks.map((week, i) => {
            let sum = 0
            return <g key={week.key}>
              {week.current && <rect x={x(i) - (right - left) / weeks.length / 2} y={top} width={(right - left) / weeks.length} height={bottom - top} fill="#edf2f7" />}
              {segments.map(s => { const base = sum; sum += week[s.key]; return <rect key={s.key} x={x(i) - 13} y={y(sum)} width="26" height={y(base) - y(sum)} fill={s.color} /> })}
              {(i % Math.max(1, Math.ceil(weeks.length / 16)) === 0 || i === weeks.length - 1) && <text x={x(i)} y={bottom + 22} textAnchor="middle"><tspan x={x(i)}>{week.label.split(' / ')[0]}</tspan><tspan x={x(i)} dy="15">{week.label.split(' / ')[1]}</tspan></text>}
            </g>
          })}
          <polyline points={points('plan')} fill="none" stroke="#2874b2" strokeWidth="3" strokeDasharray="7 4" />
          <polyline points={points('actual')} fill="none" stroke="#754ab4" strokeWidth="3" />
          {weeks.map((week, i) => <g key={week.key}>{week.actual !== null && <circle cx={x(i)} cy={py(week.actual)} r="3" fill="#754ab4" />}<rect x={x(i) - (right - left) / weeks.length / 2} y={top} width={(right - left) / weeks.length} height={bottom - top} fill="transparent" className="weekly-hit" role="button" tabIndex="0" aria-label={`${week.label}: ${week.done} erledigt, ${week.active} in Bearbeitung, ${week.late} überfällig, ${week.pending} offen, Soll ${percent(week.plan)}, Ist ${percent(week.actual)}`} onClick={() => setSelected(week.key)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(week.key) } }}><title>{`${week.label}: ${week.done} erledigt · ${week.active} in Bearbeitung · ${week.late} überfällig · Soll ${percent(week.plan)} · Ist ${percent(week.actual)}`}</title></rect></g>)}
          <text x={(left + right) / 2} y={height - 8} textAnchor="middle">Geplante Fertigstellung · Kalenderwoche / Jahr</text>
        </svg>
      </div>
      {detail && <p className="weekly-detail" aria-live="polite"><strong>{detail.label}{detail.current ? ' · laufende Woche' : ''}</strong>: {detail.done} erledigt · {detail.active} in Bearbeitung · {detail.late} überfällig · {detail.pending} offen | Soll {percent(detail.plan)} · Ist {percent(detail.actual)}</p>}
      <details><summary>Wochenwerte als Tabelle</summary><div className="dashboard-scroll"><table><thead><tr><th>Woche</th><th>Erledigt</th><th>In Bearbeitung</th><th>Überfällig</th><th>Offen / keine Meldung</th><th>Soll kumuliert</th><th>Ist kumuliert</th></tr></thead><tbody>{weeks.map(w => <tr key={w.key}><td>{w.label}</td><td>{w.done}</td><td>{w.active}</td><td>{w.late}</td><td>{w.pending}</td><td>{percent(w.plan)}</td><td>{percent(w.actual)}</td></tr>)}</tbody></table></div></details>
      <details className="schedule-help"><summary>So wird die grafische Auswertung berechnet</summary><p>Jede Säule enthält die Einzelvorgänge mit geplantem Ende in dieser Woche. Die Farben zeigen deren heutigen Status: Grün bei 100 %, Rot bei überschrittenem Planende und weniger als 100 %, Gelb bei gemeldetem Teilfortschritt ohne Überschreitung, Grau ohne gemeldeten Beginn. Ein überfälliger Vorgang bleibt rot, auch wenn er in Bearbeitung ist.</p><p>Die Soll-Kurve zählt die bis zum jeweiligen Wochenende geplanten Abschlüsse. Die Ist-Kurve nutzt je Vorgang die letzte bis dahin gespeicherte Fortschrittsmeldung, einschließlich Teilfortschritt. Die laufende Woche zeigt den Ist-Stand bis jetzt; für die Zukunft wird kein Ist-Fortschritt erfunden. Ohne historische Meldung wird 0 % angesetzt.</p><p>Alle Einzelvorgänge zählen gleich; Sammelvorgänge werden nicht zusätzlich gezählt. Die Kurven beziehen sich auf Vorgänge mit gültigem Planende und den aktuell gespeicherten Plan. Frühere Planversionen und eine Gewichtung nach Arbeitsstunden sind nicht enthalten. Die Terminampel bewertet zusätzlich das prognostizierte Terminrisiko; Rot in dieser Wochenübersicht bedeutet bereits überfällig.</p></details>
    </>}
  </section>
}
