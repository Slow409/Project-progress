// Microsoft Project XML (MSPDI) -> server plan, no local persistence.
const NS = 'http://schemas.microsoft.com/project'
const MAX_XML_BYTES = 8 * 1024 * 1024
const element = (parent, name) => Array.from(parent?.children || []).find(n => n.localName === name)
const children = (parent, name) => Array.from(parent?.children || []).filter(n => n.localName === name)
const value = (parent, name) => element(parent, name)?.textContent?.trim() || ''
const dateTime = text => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(text) ? text : null

export async function parseServerProjectXml(file) {
  if (!/\.xml$/i.test(file.name) || file.size > MAX_XML_BYTES || !file.size)
    throw new Error('Bitte eine MS-Project-XML-Datei bis 8 MB auswählen.')
  const xml = await file.text()
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('DOCTYPE und Entities sind nicht erlaubt.')
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length || doc.getElementsByTagNameNS('*', 'parsererror').length)
    throw new Error('Ungültiges XML.')
  const root = doc.documentElement
  if (!root || root.localName !== 'Project' || root.namespaceURI !== NS)
    throw new Error('Keine Microsoft-Project-XML-Datei.')
  const tasksNode = element(root, 'Tasks')
  const raw = children(tasksNode, 'Task')
    .filter(t => value(t,'UID') !== '0' && value(t,'IsNull') !== '1')
  const seen = new Set(), hierarchy = []
  const tasks = raw.map(t => {
    const uid = value(t,'UID')
    if (!/^[1-9]\d{0,8}$/.test(uid) || seen.has(uid)) throw new Error('Doppelte oder ungültige Vorgangs-UID.')
    seen.add(uid)
    const level = Number(value(t,'OutlineLevel') || 1)
    if (!Number.isInteger(level) || level < 1 || level > 99) throw new Error('Ungültige Gliederungsebene.')
    while (hierarchy.length && hierarchy[hierarchy.length - 1].level >= level) hierarchy.pop()
    if (level > 1 && !hierarchy.length) throw new Error('Gliederung enthält einen Vorgang ohne übergeordnete Ebene.')
    const parentUid = hierarchy.length ? hierarchy[hierarchy.length - 1].uid : null
    const name = value(t,'Name') || 'Vorgang ' + uid
    const start = dateTime(value(t,'Start')), finish = dateTime(value(t,'Finish'))
    const task = {uid, name, level, parentUid, wbs:value(t,'WBS') || value(t,'OutlineNumber') || null,
      summary: value(t,'Summary') === '1', start, finish}
    hierarchy.push({level,uid})
    return task
  })
  if (!tasks.length || tasks.length > 5000) throw new Error('Der Plan muss 1 bis 5000 Vorgänge enthalten.')
  return { name:value(root,'Name') || value(root,'Title') || file.name, fileName:file.name, tasks }
}

export function compareServerPlan(tasks, existing) {
  const current = new Map(existing.map(t => [String(t.project_task_uid),t]))
  const ids = new Set(tasks.map(t => t.uid))
  let added=0,changed=0,unchanged=0,inactive=0
  for (const t of tasks) {
    const old=current.get(t.uid)
    if (!old) { added++; continue }
    const iso = d => d?.slice(0,19) || ''
    const changedFields = old.name !== t.name || (old.wbs || '') !== (t.wbs || '') ||
      Number(old.outline_level || 1) !== t.level || String(old.parent_task_uid || '') !== String(t.parentUid || '') ||
      Boolean(old.is_summary) !== t.summary || iso(old.plan_start) !== iso(t.start) ||
      iso(old.plan_finish) !== iso(t.finish) || !old.active
    if (changedFields) changed++; else unchanged++
  }
  inactive = existing.filter(t => t.active && !ids.has(String(t.project_task_uid))).length
  return {added,changed,unchanged,inactive}
}
