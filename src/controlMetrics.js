import { latestReport, scheduleStatuses } from './scheduleStatus.js'
const DAY=86400000
export function metrics(tasks, reports, now) {
  const leaves = tasks.filter(t => t.active !== false && !t.is_summary)
  const states = scheduleStatuses(tasks, reports, now)
  const current = +now
  const latest = new Map(), previousReports = new Map()
  for(const report of reports) {
    latest.set(report.task_id,latestReport([latest.get(report.task_id),report].filter(Boolean)))
    if(Date.parse(report.created_at)<=current-7*DAY)previousReports.set(report.task_id,latestReport([previousReports.get(report.task_id),report].filter(Boolean)))
  }
  const rows = leaves.map(t => ({ task: t, report: latest.get(t.id), status: states.get(t.id) }))
  const actual = rows.length ? rows.reduce((sum, r) => sum + Number(r.report?.percent_complete || 0), 0) / rows.length : null
  const planned = rows.filter(r => r.task.plan_finish && Number.isFinite(Date.parse(r.task.plan_finish)))
  const target = planned.length ? 100 * planned.filter(r => Date.parse(r.task.plan_finish) <= current).length / planned.length : null
  const validWeights = rows.length > 0 && rows.every(r => r.task.planned_work_hours != null && Number(r.task.planned_work_hours)>=0)
  const sumWeight=validWeights ? rows.reduce((sum,r)=>sum+Number(r.task.planned_work_hours),0) : 0
  const weighted=sumWeight>0 ? rows.reduce((sum,r)=>sum+Number(r.task.planned_work_hours)*Number(r.report?.percent_complete||0),0)/sumWeight : null
  const previous = rows.length ? rows.reduce((sum,r) => sum + Number(previousReports.get(r.task.id)?.percent_complete || 0),0)/rows.length : null
  const risk = rows.filter(r => r.status?.state === 'red' || (r.task.plan_finish && Date.parse(r.task.plan_finish) < current && Number(r.report?.percent_complete || 0) < 100))
  const stale = rows.filter(r => r.task.plan_start && Date.parse(r.task.plan_start) <= current && Number(r.report?.percent_complete || 0) < 100 && (!r.report || current-Date.parse(r.report.created_at) >= 7*DAY))
  const incomplete = rows.filter(r => Number(r.report?.percent_complete || 0) < 100)
  const forecast = incomplete.length && incomplete.every(r => r.status?.forecastDate) ? incomplete.map(r=>r.status.forecastDate).sort().at(-1) : null
  return { rows, actual, target, weighted, previous, risk, stale, forecast, done: rows.filter(r=>Number(r.report?.percent_complete)===100).length }
}
