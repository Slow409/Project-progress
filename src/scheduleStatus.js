const DAY = 86400000
const RESERVE = 0.1
const berlin = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})

// Civil calendar days avoid a one-hour distortion when daylight saving changes.
function calendarTime(value) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return NaN
  const parts = Object.fromEntries(berlin.formatToParts(date).map(p => [p.type, p.value]))
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day) / DAY
    + (+parts.hour * 3600 + +parts.minute * 60 + +parts.second) / 86400
}
function planDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '')
  if (!match) return NaN
  const stamp = Date.UTC(+match[1], +match[2] - 1, +match[3])
  return new Date(stamp).toISOString().slice(0, 10) === match[0] ? stamp / DAY : NaN
}
const neutral = label => ({ state: 'unknown', label, hue: null })

export function latestReport(reports) {
  return reports.reduce((latest, report) => {
    if (!latest) return report
    const delta = new Date(report.created_at) - new Date(latest.created_at)
    return delta > 0 || (delta === 0 && String(report.id) > String(latest.id)) ? report : latest
  }, null)
}

export function scheduleStatus(task, report, now = new Date()) {
  if (!task) return neutral('Vorgang nicht verfügbar')
  if (task.active === false) return neutral('Nicht mehr im Plan')
  if (task.is_summary) return neutral('Sammelvorgang · Einzelvorgänge prüfen')
  const start = planDay(task.plan_start)
  const end = planDay(task.plan_finish)
  const current = calendarTime(now)
  if (![start, end, current].every(Number.isFinite) || end < start) return neutral('Plantermine fehlen oder sind ungültig')
  // Imported plans contain dates without working calendars; include the finish day.
  const duration = end - start + 1
  const reserveDays = duration * RESERVE
  const base = { duration, reserveDays }
  if (!report) return { ...base, ...neutral('Keine Fortschrittsmeldung') }
  const percent = Number(report.percent_complete)
  if (report.percent_complete == null || !Number.isFinite(percent) || percent < 0 || percent > 100) return { ...base, ...neutral('Fortschrittsgrad ungültig') }
  if (percent === 100) return { ...base, state: 'complete', label: 'Abgeschlossen', hue: 120 }
  if (current < start) return { ...base, ...neutral('Planstart noch nicht erreicht') }
  const elapsed = Math.max(0, current - start)
  if (elapsed === 0) return { ...base, ...neutral('Prognose ab Planstart möglich') }
  // Conservative forecast: only confirmed progress counts. Missing updates never
  // become assumed progress. Recalculate as time passes, even without a new report.
  const forecastDuration = percent > 0 ? elapsed / (percent / 100) : Infinity
  const reserveStart = duration - reserveDays
  const usedReserve = (forecastDuration - reserveStart) / reserveDays
  const hue = Math.max(0, Math.min(120, 120 * (1 - usedReserve)))
  const state = forecastDuration <= reserveStart ? 'green' : forecastDuration <= duration ? 'yellow' : 'red'
  const label = state === 'green' ? 'Im Zeitplan' : state === 'yellow' ? 'Termin knapp' : 'Termin gefährdet'
  return {
    ...base, state, label, hue,
    forecastDate: Number.isFinite(forecastDuration)
      ? new Date((start + forecastDuration) * DAY - 1).toISOString().slice(0, 10) : null,
    reserveRemaining: Number.isFinite(forecastDuration) ? duration - forecastDuration : null,
  }
}

// Roll up the most critical active descendant without counting summaries twice.
export function scheduleStatuses(tasks, reports, now = new Date()) {
  const latest = new Map()
  for (const report of reports) latest.set(report.task_id, latestReport([latest.get(report.task_id), report].filter(Boolean)))
  const byUid = new Map(tasks.map(task => [task.project_task_uid, task]))
  const children = new Map()
  for (const task of tasks) {
    const parent = byUid.get(task.parent_task_uid)
    if (parent && parent.id !== task.id && task.active !== false) {
      if (!children.has(parent.id)) children.set(parent.id, [])
      children.get(parent.id).push(task)
    }
  }
  const result = new Map()
  const visiting = new Set()
  function visit(task) {
    if (result.has(task.id)) return result.get(task.id)
    if (visiting.has(task.id)) return neutral('Gliederung prüfen')
    visiting.add(task.id)
    const nested = children.get(task.id) || []
    let status
    if (!nested.length || task.active === false) status = scheduleStatus(task, latest.get(task.id), now)
    else {
      const states = nested.map(visit)
      const critical = states.find(s => s.state === 'red')
        || states.filter(s => s.state === 'yellow').sort((a, b) => a.hue - b.hue)[0]
        || states.find(s => s.state === 'unknown')
        || states.find(s => s.state === 'green') || states[0]
      const allComplete = states.every(s => s.state === 'complete')
      const dates = states.map(s => s.forecastDate).filter(Boolean).sort()
      status = { ...critical, label: allComplete ? 'Abgeschlossen' : critical.label,
        state: allComplete ? 'complete' : critical.state,
        forecastDate: states.some(s => s.state === 'unknown' || (s.state === 'red' && !s.forecastDate)) ? null : dates.at(-1),
        childCount: nested.length }
    }
    visiting.delete(task.id)
    result.set(task.id, status)
    return status
  }
  tasks.forEach(visit)
  return result
}
