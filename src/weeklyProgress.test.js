import test from 'node:test'
import assert from 'node:assert/strict'
import { civilDay, progressScopes, weeklyProgress } from './weeklyProgress.js'

const task = (id, end, extra = {}) => ({ id, project_task_uid: id, plan_start: '2026-10-26', plan_finish: end, ...extra })
const report = (task_id, percent_complete, created_at, id = task_id + created_at) => ({ id, task_id, percent_complete, created_at })
const now = new Date('2026-11-10T12:00:00Z')
test('counts only active leaves once, with mutually exclusive status and inclusive finish day', () => {
  const tasks = [task('done','2026-11-04'), task('late','2026-11-05'), task('active','2026-11-10'), task('pending','2026-11-11'), task('summary','2026-11-05',{is_summary:true}),task('old','2026-11-05',{active:false})]
  const reports = [report('done',100,'2026-11-04T12:00:00Z'),report('late',40,'2026-11-04T12:00:00Z'),report('active',20,'2026-11-10T10:00:00Z')]
  const chart=weeklyProgress(tasks,reports,now)
  const sum=key=>chart.weeks.reduce((n,w)=>n+w[key],0)
  assert.deepEqual([chart.total,sum('done'),sum('late'),sum('active'),sum('pending')],[4,1,1,1,1])
  assert.equal(chart.weeks.at(-1).actual,40)
})
test('history uses the last report at that time, partial credit, and no future reports', () => {
  const tasks=[task('a','2026-11-05'),task('b','2026-11-20')]
  const reports=[report('a',20,'2026-10-30T10:00:00Z'),report('a',60,'2026-11-06T10:00:00Z'),report('a',100,'2026-11-12T10:00:00Z'),report('b',40,'2026-11-10T10:00:00Z'),report('b',90,'2026-11-10T15:00:00Z')]
  const chart=weeklyProgress(tasks,reports,now)
  assert.deepEqual(chart.weeks.map(w=>w.actual),[10,30,50,null])
  assert.deepEqual(chart.weeks.map(w=>w.plan),[0,50,50,100])
})
test('weeks follow Berlin midnight and ISO week-year boundaries', () => {
  const chart=weeklyProgress([task('a','2027-01-04',{plan_start:'2026-12-28'})],[report('a',100,'2027-01-03T23:30:00Z')],new Date('2027-01-04T00:00:00Z'))
  assert.deepEqual(chart.weeks.map(w=>w.label),['KW 53 / 2026','KW 01 / 2027'])
  assert.deepEqual(chart.weeks.map(w=>w.actual),[0,100])
})
test('empty and invalid dates do not become plausible chart values', () => {
  assert.ok(Number.isNaN(civilDay('2026-02-30')))
  const chart=weeklyProgress([task('a',null)],[],now)
  assert.deepEqual([chart.weeks.length,chart.total,chart.omitted],[0,1,1])
})
test('current week stops at now and overdue work remains visible after the plan ends', () => {
  const chart=weeklyProgress([task('a','2026-10-27')],[],now)
  assert.equal(chart.weeks.at(-1).current,true)
  assert.equal(chart.weeks[0].late,1)
  assert.equal(chart.weeks.at(-1).plan,100)
  assert.equal(chart.weeks.at(-1).actual,0)
})
test('all summary levels contain only their own descendants without double counting', () => {
  const tasks=[task('root','2026-11-20',{is_summary:true,name:'Project'}),task('level','2026-11-20',{parent_task_uid:'root',is_summary:true,name:'Level1'}),task('sub','2026-11-20',{parent_task_uid:'level',is_summary:true,name:'Area'}),task('a','2026-11-20',{parent_task_uid:'sub'}),task('b','2026-11-20',{parent_task_uid:'root'})]
  const scopes=progressScopes(tasks,{name:'Test'},true)
  assert.deepEqual(scopes.map(s=>[s.id,s.tasks.map(t=>t.id)]),[['all',['a','b']],['root',['a','b']],['level',['a']],['sub',['a']]])
})
test('resource scopes contain only supplied tasks and available ancestor names', () => {
  const tasks=[task('a','2026-11-20',{project_area:'Project / Level1'}),task('b','2026-11-20',{project_area:'Project / Level2'})]
  const scopes=progressScopes(tasks,{name:'Test'},false)
  assert.equal(scopes[0].label,'Meine freigegebenen Aufgaben')
  assert.deepEqual(scopes.slice(1).map(s=>s.tasks.map(t=>t.id)),[['a'],['b']])
})
test('cyclic structures terminate and cannot count a summary as a leaf', () => {
  const scopes=progressScopes([task('root','2026-11-20',{is_summary:true,parent_task_uid:'root'}),task('a','2026-11-20',{parent_task_uid:'root'})],{},true)
  assert.equal(scopes[0].tasks.length,1)
  assert.equal(scopes[1].tasks.length,1)
})
