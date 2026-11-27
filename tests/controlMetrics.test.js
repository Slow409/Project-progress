import test from 'node:test'
import assert from 'node:assert/strict'
import { metrics, managementSummary } from '../src/controlMetrics.js'
const clock=new Date('2026-11-27T12:00:00Z')
const tasks=[
  {id:'a',project_task_uid:1,active:true,is_summary:false,plan_start:'2026-11-01',plan_finish:'2026-11-10',planned_work_hours:20},
  {id:'b',project_task_uid:2,active:true,is_summary:false,plan_start:'2026-11-01',plan_finish:'2026-12-10',planned_work_hours:80},
  {id:'s',project_task_uid:3,active:true,is_summary:true,planned_work_hours:100},
  {id:'old',project_task_uid:4,active:false,is_summary:false}
]
const reports=[{id:'1',task_id:'a',percent_complete:100,created_at:'2026-11-09T10:00:00Z'},{id:'2',task_id:'b',percent_complete:50,created_at:'2026-11-18T10:00:00Z'}]
test('count and work metrics exclude summaries and retired tasks',()=>{const m=metrics(tasks,reports,clock);assert.equal(m.actual,75);assert.equal(m.weighted,60);assert.equal(m.target,50);assert.equal(m.done,1);assert.equal(m.stale.length,1)})
test('incomplete work basis shows no weighted score',()=>{assert.equal(metrics(tasks.map(t=>t.id==='b'?{...t,planned_work_hours:null}:t),reports,clock).weighted,null)})
test('empty project has no artificial percentage',()=>{const m=metrics([],[],clock);assert.equal(m.actual,null);assert.equal(m.weighted,null);assert.equal(m.target,null)})
test('week comparison is independent of newer reports',()=>{const m=metrics(tasks,[...reports,{id:'3',task_id:'b',percent_complete:70,created_at:'2026-11-26T10:00:00Z'}],clock);assert.equal(m.previous,75);assert.equal(m.actual,85)})

test('management extract is bounded, groups critical areas and excludes financial fields',()=>{
  const many=Array.from({length:8},(_,i)=>({id:'risk'+i,name:'Vorgang '+i,wbs:'1.'+i,project_task_uid:10+i,active:true,is_summary:false,project_area:'Bereich '+i,plan_start:'2026-11-01',plan_finish:'2026-11-10',budget:999}))
  const summary=managementSummary(many,[],clock)
  assert.equal(summary.risks,8);assert.equal(summary.stale,8);assert.equal(summary.topRisks.length,5);assert.equal(summary.criticalAreas.length,5);assert.equal(summary.forecast,null);assert.equal(summary.deviation,null);assert.equal(summary.topRisks.some(r=>'budget' in r),false)
})
