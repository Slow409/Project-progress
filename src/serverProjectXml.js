// Microsoft Project XML (MSPDI) -> server plan, no local persistence.
const NS = 'http://schemas.microsoft.com/project'
const MAX_XML_BYTES = 8 * 1024 * 1024
const element = (parent, name) => Array.from(parent?.childNodes || []).find(n => n.nodeType === 1 && n.localName === name)
const children = (parent, name) => Array.from(parent?.childNodes || []).filter(n => n.nodeType === 1 && n.localName === name)
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
    if (level > 1 && (hierarchy[hierarchy.length - 1].level !== level - 1 ||
        !hierarchy[hierarchy.length - 1].summary))
      throw new Error('Ungültige Eltern-Kind-Struktur: übergeordneter Vorgang muss ein Sammelvorgang sein.')
    const parentUid = hierarchy.length ? hierarchy[hierarchy.length - 1].uid : null
    const name = value(t,'Name') || 'Vorgang ' + uid
    const start = dateTime(value(t,'Start')), finish = dateTime(value(t,'Finish'))
    const task = {uid, name, level, parentUid, wbs:value(t,'WBS') || value(t,'OutlineNumber') || null,
      summary: value(t,'Summary') === '1', start, finish}
    hierarchy.push({level,uid,summary:task.summary})
    return task
  })
  if (!tasks.length || tasks.length > 5000) throw new Error('Der Plan muss 1 bis 5000 Vorgänge enthalten.')
  const resourceUids = new Set()
  const resources = children(element(root, 'Resources'), 'Resource')
    .filter(node => value(node,'UID') !== '0' && value(node,'IsNull') !== '1' && value(node,'Name'))
    .map(node => {
      const uid = value(node,'UID')
      if (!/^[1-9][0-9]{0,8}$/.test(uid) || resourceUids.has(uid))
        throw new Error('Ungültige oder doppelte Ressourcen-UID.')
      resourceUids.add(uid)
      return { uid, name:value(node,'Name') }
    })
  const assignmentKeys = new Set()
  const assignments = children(element(root, 'Assignments'), 'Assignment')
    .filter(node => value(node,'TaskUID') !== '0' && value(node,'ResourceUID') !== '0')
    .map(node => {
      const taskUid = value(node,'TaskUID')
      const resourceUid = value(node,'ResourceUID')
      if (!seen.has(taskUid) || !resourceUids.has(resourceUid))
        throw new Error('Ressourcenzuordnung verweist auf eine unbekannte UID.')
      const key = taskUid + ':' + resourceUid
      if (assignmentKeys.has(key)) throw new Error('Doppelte Ressourcenzuordnung.')
      assignmentKeys.add(key)
      return { taskUid, resourceUid }
    })
  return { name:value(root,'Name') || value(root,'Title') || file.name,
    fileName:file.name, tasks, resources, assignments }
}

export function compareServerPlan(tasks, existing, timezone = 'Europe/Berlin') {
  const localTime = value => {
    if (!value) return ''
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone, year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23',
    }).formatToParts(new Date(value))
    const part = type => parts.find(p => p.type === type)?.value || ''
    return part('year') + '-' + part('month') + '-' + part('day') +
      'T' + part('hour') + ':' + part('minute') + ':' + part('second')
  }
  const current = new Map(existing.map(t => [String(t.project_task_uid),t]))
  const ids = new Set(tasks.map(t => t.uid))
  let added=0,changed=0,unchanged=0,inactive=0
  for (const t of tasks) {
    const old=current.get(t.uid)
    if (!old) { added++; continue }
    const iso = d => d?.slice(0,19) || ''
    const changedFields = old.name !== t.name || (old.wbs || '') !== (t.wbs || '') ||
      Number(old.outline_level || 1) !== t.level || String(old.parent_task_uid || '') !== String(t.parentUid || '') ||
      Boolean(old.is_summary) !== t.summary || localTime(old.plan_start) !== iso(t.start) ||
      localTime(old.plan_finish) !== iso(t.finish) || !old.active
    if (changedFields) changed++; else unchanged++
  }
  inactive = existing.filter(t => t.active && !ids.has(String(t.project_task_uid))).length
  return {added,changed,unchanged,inactive}
}
