export function parseProjectXml(xml, fileName) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('XML mit Dokumenttyp- oder Entity-Deklarationen wird nicht unterstützt.')
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagNameNS('*', 'parsererror').length) throw new Error('Die XML-Datei ist beschädigt oder unvollständig.')
  const root = doc.documentElement
  if (!root || root.localName !== 'Project' || root.namespaceURI !== 'http://schemas.microsoft.com/project') throw new Error('Bitte eine XML-Datei aus Microsoft Project auswählen; MPP-Dateien zuerst als XML exportieren.')
  const nodes = (parent, name) => Array.from(parent?.childNodes || []).filter((node) => node.nodeType === 1 && node.localName === name)
  const field = (parent, name) => nodes(parent, name)[0]?.textContent?.trim() || ''
  const group = (name, item) => nodes(nodes(root, name)[0], item)
  const date = (value) => /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : ''
  const resources = group('Resources', 'Resource').filter((node) => field(node, 'UID') !== '0' && field(node, 'Name') && field(node, 'IsNull') !== '1').map((node) => ({ uid: field(node, 'UID'), name: field(node, 'Name') }))
  const assignments = group('Assignments', 'Assignment').map((node) => ({ taskUid: field(node, 'TaskUID'), resourceUid: field(node, 'ResourceUID'), units: field(node, 'Units'), work: field(node, 'Work') }))
  const seen = new Set()
  const tasks = group('Tasks', 'Task').filter((node) => field(node, 'UID') !== '0' && field(node, 'IsNull') !== '1').map((node) => {
    const uid = field(node, 'UID')
    if (!uid || seen.has(uid)) throw new Error('Fehlende oder doppelte Vorgangs-UID. Bitte den Plan erneut aus MS Project exportieren.')
    seen.add(uid)
    const percent = Number(field(node, 'PercentComplete') || '0')
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error('Ungültiger Fortschrittswert im Projektplan.')
    return { msProjectUid: uid, text: field(node, 'Name') || `Vorgang ${uid}`, wbs: field(node, 'WBS') || field(node, 'OutlineNumber'), outlineLevel: Number(field(node, 'OutlineLevel')) || 1,
      isSummary: field(node, 'Summary') === '1', isMilestone: field(node, 'Milestone') === '1', planStart: date(field(node, 'Start')), planFinish: date(field(node, 'Finish')), planDuration: field(node, 'Duration'),
      dueDate: date(field(node, 'Finish')), importedProgress: percent, resourceNames: resources.filter((resource) => assignments.some((assignment) => assignment.taskUid === uid && assignment.resourceUid === resource.uid)).map((resource) => resource.name),
      predecessorUids: nodes(node, 'PredecessorLink').map((link) => field(link, 'PredecessorUID')) }
  })
  if (!tasks.length) throw new Error('Die Datei enthält keine importierbaren Vorgänge.')
  const starts = tasks.map((task) => task.planStart).filter(Boolean).sort()
  const finishes = tasks.map((task) => task.planFinish).filter(Boolean).sort()
  return { name: field(root, 'Title') || field(root, 'Name') || fileName.replace(/\.xml$/i, ''), sourceGuid: field(root, 'GUID').replace(/[{}]/g, '').toLowerCase(), fileName, resources, assignments, tasks,
    startDate: starts[0] || date(field(root, 'StartDate')), endDate: finishes[finishes.length - 1] || date(field(root, 'FinishDate')) }
}

