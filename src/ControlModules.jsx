import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { metrics } from './controlMetrics.js'

const DAY = 86400000
const date = value => value ? new Date(value).toLocaleDateString('de-DE') : '–'
const pct = value => value == null ? '–' : Math.round(value) + ' %'
export const roles = { pm: 'Projektmanager', controlling: 'Controlling', observer: 'Observer', managing: 'Managing Level', resource: 'Ressource' }
export const canFinance = role => role === 'pm' || role === 'controlling'
export const canReport = role => role === 'pm' || role === 'resource'
const money = value => value == null ? '–' : Number(value).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
const checked = result => { if (result.error) throw result.error; return result.data || [] }

export function ManagementDashboard({ data, now }) {
  const m = metrics(data.tasks,data.reports,now)
  return <section className="module-panel"><h2>Management-Dashboard</h2><p>Einzelvorgänge gleich gewichtet · zusätzlich Stundenkennzahl bei vollständiger MS-Project-Aufwandsbasis.</p><div className="kpi-grid">
    {[['Soll (fällige Vorgänge)',pct(m.target)],['Ist (gemeldeter Fortschritt)',pct(m.actual)],['Ist (arbeitsstunden-gewichtet)',pct(m.weighted)],['Veränderung zur Vorwoche',m.actual == null ? '–' : (m.actual-m.previous).toFixed(1)+' %-Punkte'],['Abgeschlossen',m.done+' / '+m.rows.length],['Terminrisiken',m.risk.length],['Prognose (nicht kritischpfadbasiert)',date(m.forecast)]].map(([label,value])=><div className="kpi" key={label}><small>{label}</small><strong>{value}</strong></div>)}
  </div><h3>Frühwarnungen</h3><p>{m.stale.length} laufende Vorgänge ohne aktuelle Meldung (7 Tage).</p><ul>{m.risk.slice(0,5).map(r=><li key={r.task.id}>{r.task.wbs} {r.task.name} · {r.status?.label || 'Überfällig'}</li>)}</ul><details><summary>Fehlende Fortschrittsmeldungen</summary><ul>{m.stale.map(r=><li key={r.task.id}>{r.task.wbs} {r.task.name} · letzte Meldung {date(r.report?.created_at)}</li>)}</ul></details></section>
}
export function ScheduleHistory({ data }) {
  return <section className="module-panel"><h2>Baseline und Terminänderungen</h2><p>Baseline-Werte aus MS Project; ein fehlender Basisplan wird nicht geschätzt.</p><div className="dashboard-scroll"><table><thead><tr><th>Vorgang</th><th>Baseline Ende</th><th>Plan Ende</th><th>Abweichung</th><th>Änderungshistorie</th></tr></thead><tbody>{data.tasks.filter(t=>!t.is_summary).map(t=><tr key={t.id}><td>{t.wbs} {t.name}</td><td>{date(t.baseline_finish)}</td><td>{date(t.plan_finish)}</td><td>{t.baseline_finish && t.plan_finish ? Math.round((Date.parse(t.plan_finish)-Date.parse(t.baseline_finish))/DAY)+' Tage' : '–'}</td><td><details><summary>{(t.plan_change_comments || []).length} Änderungen</summary>{(t.plan_change_comments || []).map((c,i)=><p key={i}>{date(c.changed_at)}: Start {date(c.previous_start)} → {date(c.new_start)} · Dauer {c.previous_duration || '–'} → {c.new_duration || '–'} · Ende {date(c.previous_finish)} → {date(c.new_finish)}</p>)}</details></td></tr>)}</tbody></table></div></section>
}
export function Portfolio({ projects, now, selectProject }) {
  const [rows,setRows]=useState([]),[error,setError]=useState('')
  useEffect(()=>{let active=true;setRows([]);setError('');Promise.all(projects.map(async p=>{
    const [tasks,reports]=await Promise.all(['tasks','progress_updates'].map(async table=>{
      const out=[];for(let offset=0;;offset+=500){const items=checked(await supabase.from(table).select('*').eq('project_id',p.id).order('id').range(offset,offset+499));out.push(...items);if(items.length<500)return out}
    }));return {project:p, tasks,reports}
  })).then(r=>{if(active)setRows(r)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[projects])
  return <section className="module-panel"><h2>Managing Level · Projektportfolio</h2><p>Nur ausdrücklich freigegebene Projekte. Keine Finanzdaten.</p>{error&&<p role="alert">{error}</p>}<div className="dashboard-scroll"><table><thead><tr><th>Projekt</th><th>Soll</th><th>Ist</th><th>Risiken</th><th>Prognose</th></tr></thead><tbody>{rows.map(({project,tasks,reports})=>{const m=metrics(tasks,reports,now);return <tr key={project.id}><td><button onClick={()=>selectProject(project.id)}>{project.name}</button></td><td>{pct(m.target)}</td><td>{pct(m.actual)}</td><td>{m.risk.length}</td><td>{date(m.forecast)}</td></tr>})}</tbody></table></div></section>
}
export function Finance({ project, role }) {
  const [rows,setRows]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const [form,setForm]=useState({snapshot_date:new Date().toISOString().slice(0,10),budget:'',planned_value:'',earned_value:'',actual_cost:''})
  async function load(){setRows(checked(await supabase.from('project_financials').select('*').eq('project_id',project.id).order('snapshot_date',{ascending:false})))}
  useEffect(()=>{setRows([]);setError('');if(canFinance(role))load().catch(e=>setError(e.message))},[project.id,role])
  async function save(e){e.preventDefault();setBusy(true);setError('');try{const values=Object.fromEntries(Object.entries(form).map(([k,v])=>[k,k==='snapshot_date'?v:Number(v)]));if(Object.entries(values).some(([k,v])=>k!=='snapshot_date'&&(!Number.isFinite(v)||v<0)))throw new Error('Ungültiger Finanzwert');checked(await supabase.from('project_financials').upsert({project_id:project.id,...values},{onConflict:'project_id,snapshot_date'}));await load()}catch(e){setError(e.message)}finally{setBusy(false)}}
  if(!canFinance(role))return null
  const row=rows[0],ratio=(a,b)=>Number(b)>0?(Number(a)/Number(b)).toFixed(2):'–'
  return <section className="module-panel"><h2>Controlling · Earned Value</h2><p>Vertrauliche Projektdaten · nur PM und Controlling. Werte in EUR, manuell zum Stichtag eingetragen.</p>{error&&<p role="alert">{error}</p>}{row&&<div className="kpi-grid">{[['Budget (BAC)',money(row.budget)],['Planwert (PV)',money(row.planned_value)],['Erarbeiteter Wert (EV)',money(row.earned_value)],['Istkosten (AC)',money(row.actual_cost)],['SPI',ratio(row.earned_value,row.planned_value)],['CPI',ratio(row.earned_value,row.actual_cost)]].map(([k,v])=><div className="kpi" key={k}><small>{k}</small><strong>{v}</strong></div>)}</div>}<form onSubmit={save}><label>Stichtag<input type="date" required value={form.snapshot_date} onChange={e=>setForm({...form,snapshot_date:e.target.value})}/></label>{[['budget','Budget (BAC)'],['planned_value','Planwert (PV)'],['earned_value','Erarbeiteter Wert (EV)'],['actual_cost','Istkosten (AC)']].map(([key,label])=><label key={key}>{label}<input type="number" min="0" step=".01" required value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}<button disabled={busy}>Stichtag speichern</button></form><h3>Historie</h3><div className="dashboard-scroll"><table><thead><tr><th>Stichtag</th><th>BAC</th><th>PV</th><th>EV</th><th>AC</th><th>SPI</th><th>CPI</th></tr></thead><tbody>{rows.map(r=><tr key={r.snapshot_date}><td>{date(r.snapshot_date)}</td><td>{money(r.budget)}</td><td>{money(r.planned_value)}</td><td>{money(r.earned_value)}</td><td>{money(r.actual_cost)}</td><td>{ratio(r.earned_value,r.planned_value)}</td><td>{ratio(r.earned_value,r.actual_cost)}</td></tr>)}</tbody></table></div></section>
}
export function RoleAdmin({ project }) {
  const [rows,setRows]=useState([]),[email,setEmail]=useState(''),[role,setRole]=useState('observer'),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  async function load(){setRows(checked(await supabase.from('project_memberships').select('*').eq('project_id',project.id)))}
  useEffect(()=>{setRows([]);setError('');load().catch(e=>setError(e.message))},[project.id])
  async function grant(e){e.preventDefault();setBusy(true);setError('');try{checked(await supabase.rpc('assign_project_role',{p_project_id:project.id,p_email:email.trim().toLowerCase(),p_role:role}));setEmail('');await load()}catch(e){setError(e.message)}finally{setBusy(false)}}
  async function revoke(userId){setBusy(true);try{checked(await supabase.from('project_memberships').delete().eq('project_id',project.id).eq('user_id',userId));await load()}catch(e){setError(e.message)}finally{setBusy(false)}}
  return <section className="module-panel"><h2>Projektrollen verwalten</h2><p>Nur vorhandene E-Mail-Konten. Beim Entzug einer Rolle gelten wieder ggf. bestehende Ressourcenzuordnungen. Leserollen erhalten Zugriff auf dieses Projekt, nicht auf andere Projekte. Managing Level aggregiert nur explizit freigegebene Projekte.</p>{error&&<p role="alert">{error}</p>}<form onSubmit={grant}><label>E-Mail<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Rolle<select value={role} onChange={e=>setRole(e.target.value)}>{['observer','managing','controlling'].map(r=><option key={r} value={r}>{roles[r]}</option>)}</select></label><button disabled={busy}>Rolle zuweisen</button></form><ul>{rows.map(r=><li key={r.user_id}>{r.email} · {roles[r.role]} <button disabled={busy} onClick={()=>revoke(r.user_id)}>Rolle entziehen</button></li>)}</ul></section>
}
export function WeeklyReport({project,data,now}) {
  const m=metrics(data.tasks,data.reports,now)
  const latest=data.reports.filter(r=>Date.parse(r.created_at)>=+now-7*DAY).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))
  return <section className="module-panel weekly-print"><h2>Wochenbericht · {project.name}</h2><p>Stand: {date(now)} · Zeitraum: letzte sieben Tage</p><p>Gemeldeter Fortschritt {pct(m.actual)}, fällige Vorgänge {pct(m.target)}. {m.done} von {m.rows.length} Einzelvorgängen abgeschlossen. {m.risk.length} Terminrisiken, {m.stale.length} fehlende aktuelle Meldungen.</p><h3>Risiken</h3><ul>{m.risk.map(r=><li key={r.task.id}>{r.task.wbs} {r.task.name}</li>)}</ul><h3>Fortschrittsmeldungen</h3><ul>{latest.map(r=><li key={r.id}>{date(r.created_at)} · {data.tasks.find(t=>t.id===r.task_id)?.name} · {r.percent_complete}% · {r.comment}</li>)}</ul><button className="no-print" onClick={()=>window.print()}>Bericht drucken / als PDF speichern</button></section>
}

export function Quality({project,data,role}) {
  const [issues,setIssues]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const [form,setForm]=useState({task_id:'',title:'',description:'',due_date:''})
  const tasks=data.tasks.filter(t=>t.active!==false&&!t.is_summary)
  const statusLabel={open:'Offen',in_progress:'In Bearbeitung',closed:'Erledigt'}
  async function load(){setIssues(checked(await supabase.from('project_issues').select('*').eq('project_id',project.id).order('created_at',{ascending:false})))}
  useEffect(()=>{load().catch(e=>setError(e.message))},[project.id])
  async function add(e){e.preventDefault();setBusy(true);setError('');try{checked(await supabase.from('project_issues').insert({...form,project_id:project.id,due_date:form.due_date||null}));setForm({task_id:'',title:'',description:'',due_date:''});await load()}catch(e){setError(e.message)}finally{setBusy(false)}}
  async function update(id,status){setBusy(true);try{checked(await supabase.from('project_issues').update({status}).eq('id',id));await load()}catch(e){setError(e.message)}finally{setBusy(false)}}
  return <section className="module-panel"><h2>Qualität · Mängel und Maßnahmen</h2>{error&&<p role="alert">{error}</p>}<p>{issues.filter(i=>i.status!=='closed').length} offene Maßnahmen · {issues.filter(i=>i.status==='closed').length} erledigt</p>{canReport(role)&&<form onSubmit={add}><label>Vorgang<select required value={form.task_id} onChange={e=>setForm({...form,task_id:e.target.value})}><option value="">Vorgang auswählen</option>{tasks.map(t=><option key={t.id} value={t.id}>{t.wbs} {t.name}</option>)}</select></label><label>Mangel<input required maxLength={200} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>Beschreibung<textarea maxLength={5000} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><label>Fällig bis<input type="date" value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})}/></label><button disabled={busy}>Mangel erfassen</button></form>}<div className="dashboard-scroll"><table><thead><tr><th>Vorgang</th><th>Mangel</th><th>Fällig</th><th>Status / Maßnahme</th></tr></thead><tbody>{issues.map(i=><tr key={i.id}><td>{data.tasks.find(t=>t.id===i.task_id)?.name||'–'}</td><td><strong>{i.title}</strong><p>{i.description}</p></td><td>{date(i.due_date)}</td><td>{role==='pm'?<select aria-label="Status" disabled={busy} value={i.status} onChange={e=>update(i.id,e.target.value)}>{Object.entries(statusLabel).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>:statusLabel[i.status]}</td></tr>)}</tbody></table></div></section>
}
