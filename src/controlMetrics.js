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

/** A compact, finance-free extract of the operational project data. */
export function managementSummary(tasks, reports, now) {
  const m = metrics(tasks, reports, now)
  const risks = new Set(m.risk.map(r=>r.task.id))
  const stale = new Set(m.stale.map(r=>r.task.id))
  const areas = new Map()
  for (const {task,report} of m.rows) {
    const area = task.project_area || task.wbs?.split('.')[0] || 'Ohne Gliederungsbereich'
    const a = areas.get(area) || {name:area,count:0,progress:0,risks:0,stale:0}
    a.count++; a.progress += Number(report?.percent_complete || 0)
    if(risks.has(task.id))a.risks++
    if(stale.has(task.id))a.stale++
    areas.set(area,a)
  }
  const criticalAreas = [...areas.values()].filter(a=>a.risks||a.stale)
    .sort((a,b)=>b.risks-a.risks||b.stale-a.stale||a.name.localeCompare(b.name))
    .slice(0,5).map(a=>({...a,progress:a.progress/a.count}))
  const planDates = m.rows.map(r=>r.task.plan_finish).filter(v=>v&&Number.isFinite(Date.parse(v))).sort((a,b)=>Date.parse(a)-Date.parse(b))
  const plannedFinish=planDates.at(-1)||null
  const deviation = plannedFinish&&m.forecast ? Math.round((Date.parse(m.forecast.slice(0,10))-Date.parse(plannedFinish.slice(0,10)))/DAY) : null
  const topRisks=[...m.risk].sort((a,b)=>(Date.parse(a.task.plan_finish)||Infinity)-(Date.parse(b.task.plan_finish)||Infinity)||a.task.name.localeCompare(b.task.name)).slice(0,5).map(r=>({id:r.task.id,name:r.task.name,wbs:r.task.wbs,finish:r.task.plan_finish,status:r.status?.label}))
  return { actual:m.actual,target:m.target,weeklyDelta:m.actual==null||m.previous==null?null:m.actual-m.previous,done:m.done,total:m.rows.length,risks:m.risk.length,stale:m.stale.length,forecast:m.forecast,plannedFinish,deviation,criticalAreas,topRisks }
}
