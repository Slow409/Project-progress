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
  const label = state === 'green' ? 'Im Plan · Buffer gesichert' : state === 'yellow' ? 'Buffer wird benötigt' : 'Termin gefährdet'
  return {
    ...base, state, label, hue,
    forecastDate: Number.isFinite(forecastDuration)
      ? new Date((start + forecastDuration) * DAY - 1).toISOString().slice(0, 10) : null,
    reserveRemaining: Number.isFinite(forecastDuration) ? duration - forecastDuration : null,
  }
}
