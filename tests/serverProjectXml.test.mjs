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
