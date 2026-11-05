import test from 'node:test'
import assert from 'node:assert/strict'
import { taskOutline } from './taskOutline.js'

const tasks = [
  { id: 'project', project_task_uid: 1, parent_task_uid: null },
  { id: 'level1', project_task_uid: 5, parent_task_uid: 1 },
  { id: 'level2', project_task_uid: 6, parent_task_uid: 1 },
  { id: 'level3', project_task_uid: 7, parent_task_uid: 1 },
  { id: 'steel1', project_task_uid: 8, parent_task_uid: 5 },
  { id: 'hvac1', project_task_uid: 9, parent_task_uid: 5 },
  { id: 'steel2', project_task_uid: 14, parent_task_uid: 6 },
]
const ids = expanded => taskOutline(tasks, expanded).map(row => row.task.id)
test('initial view contains project and its immediate levels', () => {
  assert.deepEqual(ids({}), ['project','level1','level2','level3'])
})
test('opening a level places its children immediately below it', () => {
  assert.deepEqual(ids({level1: true}), ['project','level1','steel1','hvac1','level2','level3'])
})
test('closing project hides all descendants even if a level remains open', () => {
  assert.deepEqual(ids({project: false,level1: true}), ['project'])
})
test('resource view works when parent summaries are not accessible', () => {
  const rows = taskOutline(tasks.filter(t => t.id.startsWith('steel')))
  assert.deepEqual(rows.map(r => [r.task.id,r.depth]), [['steel1',0],['steel2',0]])
})
test('rapid toggle result respects the supplied latest state', () => {
  assert.deepEqual(ids({level1: false,level2: true}), ['project','level1','level2','steel2','level3'])
})
