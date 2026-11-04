import test from 'node:test'
import assert from 'node:assert/strict'
import { DOMParser } from '@xmldom/xmldom'
import { parseServerProjectXml, compareServerPlan } from '../src/serverProjectXml.js'

globalThis.DOMParser = DOMParser

const ns = 'http://schemas.microsoft.com/project'
const task = (uid, name, level, summary = 0) =>
  `<Task><UID>${uid}</UID><Name>${name}</Name><OutlineLevel>${level}</OutlineLevel><WBS>1.${uid}</WBS><Summary>${summary}</Summary><Start>2026-10-27T08:00:00</Start><Finish>2026-10-27T17:00:00</Finish></Task>`
const makeFile = xml => ({
  name: 'project.xml', size: Buffer.byteLength(xml), text: async () => xml,
})
const xml = tasks => `<?xml version="1.0"?><Project xmlns="${ns}"><Name>Project1.xml</Name><Title>Projekt1</Title><Tasks><Task><UID>0</UID><Name>Root</Name></Task>${tasks}</Tasks></Project>`

test('MS Project XML parser keeps UID and parent hierarchy', async () => {
  const result = await parseServerProjectXml(makeFile(xml(
    task(1,'Project',1,1) + task(5,'Level 1',2,1) + task(9,'HVAC Piping',3)
  )))
  assert.equal(result.tasks.length,3)
  assert.equal(result.tasks[0].parentUid,null)
  assert.equal(result.tasks[1].parentUid,'1')
  assert.equal(result.tasks[2].parentUid,'5')
  assert.equal(result.tasks[2].name,'HVAC Piping')
  assert.equal(result.tasks[2].start,'2026-10-27T08:00:00')
})

test('MS Project XML parser rejects duplicate task UIDs', async () => {
  await assert.rejects(parseServerProjectXml(makeFile(xml(task(1,'A',1,1)+task(1,'B',2)))),/Doppelte/)
})

test('MS Project XML parser rejects orphan nested levels', async () => {
  await assert.rejects(parseServerProjectXml(makeFile(xml(task(1,'Orphan',3)))),/übergeordnete/)
})

test('XML rejects DTD and entities before parsing', async () => {
  await assert.rejects(parseServerProjectXml(makeFile(`<!DOCTYPE foo><Project xmlns="${ns}"></Project>`)),/DOCTYPE/)
})

test('XML size guard rejects empty uploads', async () => {
  await assert.rejects(parseServerProjectXml({name:'a.xml',size:0,text:async()=>''}),/8 MB/)
})

test('plan preview classifies added, modified, unchanged, and inactive without mutating old data', () => {
  const old = [
    {project_task_uid:1,name:'Project',wbs:'1',outline_level:1,parent_task_uid:null,is_summary:true,plan_start:null,plan_finish:null,active:true},
    {project_task_uid:2,name:'Old',wbs:'1.1',outline_level:2,parent_task_uid:1,is_summary:false,plan_start:null,plan_finish:null,active:true},
    {project_task_uid:3,name:'Removed',wbs:'1.2',outline_level:2,parent_task_uid:1,is_summary:false,plan_start:null,plan_finish:null,active:true},
  ]
  const incoming = [
    {uid:'1',name:'Project',wbs:'1',level:1,parentUid:null,summary:true,start:null,finish:null},
    {uid:'2',name:'Changed',wbs:'1.1',level:2,parentUid:'1',summary:false,start:null,finish:null},
    {uid:'4',name:'Added',wbs:'1.3',level:2,parentUid:'1',summary:false,start:null,finish:null},
  ]
  assert.deepEqual(compareServerPlan(incoming,old),{added:1,changed:1,unchanged:1,inactive:1})
  assert.equal(old[1].name,'Old')
})

test('plan preview compares UTC database timestamps against Berlin MS Project wall clock', () => {
  const existing=[{project_task_uid:1,name:'Project',wbs:'1',outline_level:1,parent_task_uid:null,
    is_summary:true,plan_start:'2026-10-27T07:00:00+00:00',plan_finish:'2026-10-27T16:00:00+00:00',active:true}]
  const plan=[{uid:'1',name:'Project',wbs:'1',level:1,parentUid:null,summary:true,
    start:'2026-10-27T08:00:00',finish:'2026-10-27T17:00:00'}]
  assert.deepEqual(compareServerPlan(plan,existing,'Europe/Berlin'),
    {added:0,changed:0,unchanged:1,inactive:0})
})

test('MS Project XML parser rejects non-summary parents', async () => {
  const invalid = xml(task(1,'Not summary',1,0) + task(2,'Child',2,0))
  await assert.rejects(parseServerProjectXml(makeFile(invalid)),/Eltern-Kind-Struktur/)
})

test('MS Project XML parser rejects skipped outline levels', async () => {
  const invalid = xml(task(1,'Summary',1,1) + task(2,'Level jump',3,0))
  await assert.rejects(parseServerProjectXml(makeFile(invalid)),/Eltern-Kind-Struktur/)
})

test('MS Project resource and assignment UIDs are imported independently of names', async () => {
  const file = makeFile(`<?xml version="1.0"?><Project xmlns="${ns}">
    <Tasks>${task(1,'Project',1,1)}${task(2,'Work',2)}</Tasks>
    <Resources>
      <Resource><UID>4</UID><Name>FlooingCompany</Name></Resource>
      <Resource><UID>5</UID><Name>FlooringCompany</Name></Resource>
    </Resources>
    <Assignments><Assignment><TaskUID>2</TaskUID><ResourceUID>5</ResourceUID></Assignment></Assignments>
  </Project>`)
  const parsed = await parseServerProjectXml(file)
  assert.equal(parsed.resources.length,2)
  assert.deepEqual(parsed.resources.map(r => r.uid),['4','5'])
  assert.deepEqual(parsed.assignments,[{taskUid:'2',resourceUid:'5'}])
})

test('Import rejects unknown or duplicate resource assignment identifiers', async () => {
  const base = `<Tasks>${task(1,'Work',1)}</Tasks><Resources><Resource><UID>1</UID><Name>Supplier</Name></Resource></Resources>`
  const bad = `<Assignments><Assignment><TaskUID>1</TaskUID><ResourceUID>999</ResourceUID></Assignment></Assignments>`
  await assert.rejects(parseServerProjectXml(makeFile(`<Project xmlns="${ns}">${base}${bad}</Project>`)),/unbekannte UID/)
  const duplicate = `<Assignments><Assignment><TaskUID>1</TaskUID><ResourceUID>1</ResourceUID></Assignment><Assignment><TaskUID>1</TaskUID><ResourceUID>1</ResourceUID></Assignment></Assignments>`
  await assert.rejects(parseServerProjectXml(makeFile(`<Project xmlns="${ns}">${base}${duplicate}</Project>`)),/Doppelte Ressourcenzuordnung/)
})
