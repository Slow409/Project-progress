import test from 'node:test'
import assert from 'node:assert/strict'
import { projectArea } from './projectArea.js'

const tasks = [
  { id: 'root', project_task_uid: 1, name: 'Project' },
  { id: 'level', project_task_uid: 5, parent_task_uid: 1, name: 'Level1' },
  { id: 'steel', project_task_uid: 8, parent_task_uid: 5, name: 'Steel' },
]
test('uses ancestor names in order and keeps the task in its own column', () => {
  assert.equal(projectArea(tasks[2], tasks), 'Project / Level1')
})
test('resource view uses server path when parent tasks are inaccessible', () => {
  const steel = { ...tasks[2], project_area: 'Project / Level1' }
  assert.equal(projectArea(steel, [steel]), 'Project / Level1')
})
test('top-level task uses the project name', () => {
  assert.equal(projectArea(tasks[0], tasks, { name: 'Project Progress' }), 'Project Progress')
})
test('cycles terminate without including the reported task in its ancestor path', () => {
  const cyclic = tasks.map(t => ({ ...t }))
  cyclic[0].parent_task_uid = 8
  assert.equal(projectArea(cyclic[2], cyclic), 'Project / Level1')
})
