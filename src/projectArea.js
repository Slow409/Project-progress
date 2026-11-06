// The server supplies ancestor names even when the ancestor tasks are not readable.
export function projectArea(task, tasks, project) {
  if (!task) return project?.name || 'Nicht hinterlegt'
  if (task.project_area) return task.project_area
  const byUid = new Map(tasks.map(row => [String(row.project_task_uid), row]))
  const names = [], seen = new Set([task.id])
  let parent = byUid.get(String(task.parent_task_uid))
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id)
    names.unshift(parent.name)
    parent = byUid.get(String(parent.parent_task_uid))
  }
  return names.filter(Boolean).join(' / ') || project?.name || 'Nicht hinterlegt'
}
