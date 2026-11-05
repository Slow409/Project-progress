// UIDs identify tasks, but do not define their display order. Render the parent tree.
export function taskOutline(tasks, expanded = {}) {
  const byUid = new Map(tasks.map(task => [task.project_task_uid, task]))
  const children = new Map()
  const roots = []
  for (const task of tasks) {
    const parent = byUid.get(task.parent_task_uid)
    if (!parent || parent.id === task.id) roots.push(task)
    else {
      if (!children.has(parent.id)) children.set(parent.id, [])
      children.get(parent.id).push(task)
    }
  }
  const rows = []
  const visited = new Set()
  function visit(task, depth, visible) {
    if (visited.has(task.id)) return
    visited.add(task.id)
    const nested = children.get(task.id) || []
    const open = expanded[task.id] ?? depth === 0
    if (visible) rows.push({ task, depth, hasChildren: nested.length > 0, open })
    for (const child of nested) visit(child, depth + 1, visible && open)
  }
  for (const root of roots) visit(root, 0, true)
  // Malformed cyclic input cannot recurse forever or prevent other tasks rendering.
  for (const task of tasks) if (!visited.has(task.id)) visit(task, 0, true)
  return rows
}
