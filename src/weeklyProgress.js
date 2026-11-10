import { latestReport } from './scheduleStatus.js'
import { taskOutline } from './taskOutline.js'

const DAY = 86400000
const berlin = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' })
export function civilDay(value) {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value || '')
  if (!match) return NaN
  const stamp = Date.parse(match[1] + 'T00:00:00Z')
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === match[1] ? stamp / DAY : NaN
}
function localDay(value) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return NaN
  const parts = Object.fromEntries(berlin.formatToParts(date).map(p => [p.type, p.value]))
  return civilDay(`${parts.year}-${parts.month}-${parts.day}`)
}
export function weekStart(day) {
  return day - (new Date(day * DAY).getUTCDay() + 6) % 7
}
function weekLabel(day) {
  const thursday = new Date((day + 3) * DAY)
  const year = thursday.getUTCFullYear()
  const first = weekStart(civilDay(`${year}-01-04`))
  return `KW ${String(Math.round((day - first) / 7) + 1).padStart(2, '0')} / ${year}`
}
export function progressScopes(tasks, project, owner) {
  const leaves = tasks.filter(t => t.active !== false && !t.is_summary)
  const scopes = [{ id: 'all', label: owner ? `Gesamtprojekt · ${project?.name || 'Projekt'}` : 'Meine freigegebenen Aufgaben', tasks: leaves }]
  const byUid = new Map(tasks.map(t => [String(t.project_task_uid), t]))
  const descendants = summary => leaves.filter(leaf => {
    const visited = new Set([leaf.id])
    let row = leaf
    while (row.parent_task_uid != null) {
      const parent = byUid.get(String(row.parent_task_uid))
      if (!parent || visited.has(parent.id)) return false
      if (parent.id === summary.id) return true
      visited.add(parent.id); row = parent
    }
    return false
  })
  for (const { task, depth } of taskOutline(tasks, Object.fromEntries(tasks.map(t => [t.id, true])))) {
    if (task.is_summary && task.active !== false) scopes.push({ id: task.id, label: `${'— '.repeat(depth)}${task.wbs || ''} ${task.name}`.trim(), tasks: descendants(task) })
  }
  // Resource roles receive ancestor names, never the protected ancestor records.
  if (!owner && !tasks.some(t => t.is_summary)) {
    const paths = [...new Set(leaves.map(t => t.project_area).filter(Boolean))]
    paths.forEach(path => scopes.push({ id: `path:${path}`, label: path, tasks: leaves.filter(t => t.project_area === path) }))
  }
  return scopes
}
export function weeklyProgress(tasks, reports, now = new Date()) {
  const today = localDay(now)
  const leaves = tasks.filter(t => t.active !== false && !t.is_summary)
  const dated = leaves.map(task => ({ task, finish: civilDay(task.plan_finish) })).filter(row => Number.isFinite(row.finish))
  const omitted = leaves.length - dated.length
  if (!dated.length || !Number.isFinite(today)) return { weeks: [], total: leaves.length, dated: dated.length, omitted }
  const taskIds = new Set(dated.map(row => row.task.id))
  const history = new Map()
  for (const report of reports) {
    const day = localDay(report.created_at)
    const percent = Number(report.percent_complete)
    if (!taskIds.has(report.task_id) || !Number.isFinite(day) || report.percent_complete == null || !Number.isFinite(percent) || percent < 0 || percent > 100) continue
    if (new Date(report.created_at).getTime() > new Date(now).getTime()) continue
    if (!history.has(report.task_id)) history.set(report.task_id, [])
    history.get(report.task_id).push({ ...report, day })
  }
  const dates = dated.flatMap(({ task, finish }) => {
    const start = civilDay(task.plan_start)
    return Number.isFinite(start) && start <= finish ? [start, finish] : [finish]
  })
  const reportDays = [...history.values()].flatMap(rows => rows.map(r => r.day))
  const first = weekStart(Math.min(...dates, ...reportDays))
  const last = weekStart(Math.max(...dates, today))
  // A corrupt plan spanning centuries must not allocate an unbounded chart.
  if ((last - first) / 7 > 5200) return { weeks: [], total: leaves.length, dated: dated.length, omitted, error: 'Der Planzeitraum ist größer als 100 Jahre. Bitte die Plantermine prüfen.' }
  const weeks = []
  for (let start = first; start <= last; start += 7) {
    const end = start + 6
    const row = { start, end, key: new Date(start * DAY).toISOString().slice(0, 10), label: weekLabel(start), done: 0, active: 0, late: 0, pending: 0, plan: 0, actual: start <= today ? 0 : null, current: start === weekStart(today) }
    for (const { task, finish } of dated) {
      const updates = history.get(task.id) || []
      const latest = latestReport(updates)
      const percent = Number(latest?.percent_complete || 0)
      if (finish >= start && finish <= end) {
        if (percent === 100) row.done++
        else if (finish < today) row.late++
        else if (percent > 0) row.active++
        else row.pending++
      }
      if (finish <= end) row.plan += 100 / dated.length
      if (row.actual !== null) {
        const historical = latestReport(updates.filter(r => r.day <= Math.min(end, today)))
        row.actual += Number(historical?.percent_complete || 0) / dated.length
      }
    }
    row.plan = Math.min(100, row.plan)
    if (row.actual !== null) row.actual = Math.min(100, row.actual)
    weeks.push(row)
  }
  return { weeks, total: leaves.length, dated: dated.length, omitted }
}
