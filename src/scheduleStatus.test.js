import test from 'node:test'
import assert from 'node:assert/strict'
import { scheduleStatus, latestReport } from './scheduleStatus.js'
const task = { active: true, plan_start: '2026-11-01T00:00:00', plan_finish: '2026-11-10T00:00:00' }
const report = percent_complete => ({ percent_complete, created_at: '2026-11-06T00:00:00+01:00' })
const now = new Date('2026-11-06T00:00:00+01:00')
test('ten calendar days include exactly one day reserve', () => {
  const result = scheduleStatus(task, report(60), now)
  assert.equal(result.duration, 10)
  assert.equal(result.reserveDays, 1)
  assert.equal(result.state, 'green')
  assert.equal(result.hue, 120)
})
test('consuming reserve progressively changes green through amber to red', () => {
  const a = scheduleStatus(task, report(54), now)
  const b = scheduleStatus(task, report(52), now)
  const c = scheduleStatus(task, report(40), now)
  assert.equal(a.state, 'yellow')
  assert.equal(b.state, 'yellow')
  assert.ok(a.hue > b.hue && a.hue < 120 && b.hue > 0)
  assert.equal(c.state, 'red')
  assert.equal(c.hue, 0)
  assert.equal(scheduleStatus(task, report(50), now).state, 'yellow')
})
test('unconfirmed work is never extrapolated forward as completed work', () => {
  assert.equal(scheduleStatus(task, report(60), new Date('2026-11-08T00:00:00+01:00')).state, 'red')
  assert.equal(scheduleStatus(task, report(0), now).state, 'red')
  assert.equal(scheduleStatus(task, null, now).state, 'unknown')
})
test('future, completed, inactive and summary tasks have explicit states', () => {
  assert.equal(scheduleStatus(task, report(0), new Date('2026-10-31T12:00:00+01:00')).state, 'unknown')
  assert.equal(scheduleStatus(task, report(100), now).state, 'complete')
  assert.equal(scheduleStatus({ ...task, active: false }, report(100), now).state, 'unknown')
  assert.equal(scheduleStatus({ ...task, is_summary: true }, report(50), now).state, 'unknown')
})
test('invalid or missing dates and percentages cannot produce a green signal', () => {
  for (const value of [null, 'invalid', '2026-02-30']) {
    assert.equal(scheduleStatus({ ...task, plan_start: value }, report(50), now).state, 'unknown')
  }
  assert.equal(scheduleStatus({ ...task, plan_finish: '2026-10-20' }, report(50), now).state, 'unknown')
  assert.equal(scheduleStatus(task, report(null), now).state, 'unknown')
  assert.equal(scheduleStatus(task, report(150), now).state, 'unknown')
})
test('one-day tasks and daylight saving use calendar duration consistently', () => {
  assert.equal(scheduleStatus({ ...task, plan_finish: task.plan_start }, report(50), now).reserveDays, .1)
  const dst = { ...task, plan_start: '2026-10-24', plan_finish: '2026-11-02' }
  assert.equal(scheduleStatus(dst, report(60), new Date('2026-10-29T00:00:00+01:00')).state, 'green')
})
test('latest report uses timestamp with deterministic ID tie break, not array order', () => {
  const reports = [{ id: 'b', created_at: '2026-11-05T12:00:00Z' }, { id: 'a', created_at: '2026-11-04T12:00:00Z' }, { id: 'c', created_at: '2026-11-05T12:00:00Z' }]
  assert.equal(latestReport(reports).id, 'c')
  assert.equal(latestReport([]), null)
})
