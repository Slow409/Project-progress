import { useEffect, useState } from 'react'

import './App.css'

// MS Project import helpers: kept pure so updates can be checked before saving.
function parseProjectXml(xml, fileName) {
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

function mergeProjectPlan(plan, existing, projectId, importedAt) {
  if (existing?.sourceGuid && plan.sourceGuid && existing.sourceGuid !== plan.sourceGuid) throw new Error('Dieser Plan gehört zu einem anderen Projekt. Bitte als neues Projekt importieren.')
  const previous = new Map((existing?.tasks || []).filter((task) => task.msProjectUid).map((task) => [task.msProjectUid, task]))
  const incoming = new Set(plan.tasks.map((task) => task.msProjectUid))
  const tasks = plan.tasks.map((task) => {
    const old = previous.get(task.msProjectUid)
    const progress = old ? (old.progress ?? (old.status === 'done' || old.done ? 100 : 0)) : task.importedProgress
    return { ...old, ...task, id: old?.id ?? `${projectId}:ms:${task.msProjectUid}`, priority: old?.priority || 'medium', progress,
      done: old ? old.done : progress === 100, status: old?.status || (progress === 100 ? 'done' : progress === 0 ? 'open' : 'progress'),
      progressHistory: old?.progressHistory || [], removedFromPlan: false }
  })
  // Missing tasks stay available with their reports; manually added tasks also survive.
  for (const old of existing?.tasks || []) {
    if (!old.msProjectUid) tasks.push(old)
    else if (!incoming.has(old.msProjectUid)) tasks.push({ ...old, removedFromPlan: true })
  }
  return { ...existing, id: projectId, name: plan.name, startDate: plan.startDate, endDate: plan.endDate, status: existing?.status || 'planned',
    importSource: 'ms-project', sourceGuid: plan.sourceGuid || existing?.sourceGuid || '', sourceFileName: plan.fileName, importedAt,
    resources: plan.resources, assignments: plan.assignments, tasks }
}
// End MS Project import helpers.

function ProgressHistory({ task }) {
  const history = task.progressHistory || []
  if (!history.length) {
    return <p style={{ fontSize: '14px', color: '#555' }}>Noch keine datierte Fortschrittsmeldung. Stelle den Slider ein und tippe auf „Fortschritt melden“.</p>
  }
  const firstTime = new Date(history[0].recordedAt).getTime()
  const lastTime = new Date(history[history.length - 1].recordedAt).getTime()
  const x = (entry) => lastTime === firstTime ? 316 : 52 + (new Date(entry.recordedAt).getTime() - firstTime) / (lastTime - firstTime) * 528
  const y = (entry) => 174 - entry.progress * 1.5
  const dateLabel = (entry) => new Date(entry.recordedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return (
    <section aria-label={`Fortschrittsverlauf für ${task.text}`} style={{ marginTop: '16px', borderTop: '1px solid #ddd', paddingTop: '12px' }}>
      <h3 style={{ margin: '0 0 8px', fontSize: '17px' }}>Fortschrittsverlauf</h3>
      <p style={{ fontSize: '14px', margin: '0 0 8px' }}>Zuletzt gemeldet: {history[history.length - 1].progress} % · <time dateTime={history[history.length - 1].recordedAt}>{dateLabel(history[history.length - 1])}</time></p>
      <svg viewBox="0 0 620 230" role="img" aria-label={`Fortschrittsgrad nach Datum für ${task.text}: ${history.length} Meldungen`} style={{ width: '100%', maxWidth: '720px', display: 'block', background: '#f8fafc', borderRadius: '8px' }}>
        {[0, 25, 50, 75, 100].map((value) => <g key={value}>
          <line x1="52" x2="580" y1={174 - value * 1.5} y2={174 - value * 1.5} stroke="#cbd5e1" />
          <text x="44" y={179 - value * 1.5} textAnchor="end" fontSize="13" fill="#334155">{value} %</text>
        </g>)}
        <text x="52" y="15" fontSize="12" fill="#334155">Fortschrittsgrad</text>
        <polyline points={history.map((entry) => `${x(entry)},${y(entry)}`).join(' ')} fill="none" stroke="#15803d" strokeWidth="3" />
        {history.map((entry, index) => <circle key={index} cx={x(entry)} cy={y(entry)} r="4" fill="#15803d"><title>{dateLabel(entry)}: {entry.progress} %</title></circle>)}
        <text x={history.length === 1 ? '316' : '52'} y="198" textAnchor={history.length === 1 ? 'middle' : 'start'} fontSize="12" fill="#334155">{dateLabel(history[0])}</text>
        {history.length > 1 && <text x="580" y="215" textAnchor="end" fontSize="12" fill="#334155">{dateLabel(history[history.length - 1])}</text>}
        <text x="580" y="228" textAnchor="end" fontSize="11" fill="#475569">Datum / Uhrzeit</text>
      </svg>
      <details style={{ marginTop: '8px' }}>
        <summary style={{ cursor: 'pointer', padding: '8px 0' }}>Meldungen anzeigen ({history.length})</summary>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead><tr><th scope="col">Datum / Uhrzeit</th><th scope="col">Fortschritt</th></tr></thead>
            <tbody>{history.map((entry, index) => <tr key={index}><td style={{ padding: '6px 8px 6px 0' }}><time dateTime={entry.recordedAt}>{dateLabel(entry)}</time></td><td>{entry.progress} %</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </section>
  )
}

function App() {

  const [projects, setProjects] = useState(() => {

    const saved = localStorage.getItem('projects')

    if (saved) {

      try {

        return JSON.parse(saved)

      } catch {

        return []

      }

    }

    return [

      {

        id: 1,

        name: 'Mein erstes Projekt',

        startDate: '',

        endDate: '',

        status: 'planned',

        tasks: [],

      },

    ]

  })

  const [selectedProjectId, setSelectedProjectId] = useState(

    projects[0]?.id ?? null

  )

  const [progressDrafts, setProgressDrafts] = useState({})
  const [importPreview, setImportPreview] = useState(null)
  const [importTarget, setImportTarget] = useState('new')
  const [importError, setImportError] = useState('')
  const [importNotice, setImportNotice] = useState('')
  const [importBusy, setImportBusy] = useState(false)

  const [newProjectName, setNewProjectName] = useState('')

  const [newTask, setNewTask] = useState('')

  const [newDueDate, setNewDueDate] = useState('')

  const [newPriority, setNewPriority] = useState('medium')

  const [editingTaskId, setEditingTaskId] = useState(null)

  const [editText, setEditText] = useState('')

  const [editDueDate, setEditDueDate] = useState('')

  const [editPriority, setEditPriority] = useState('medium')

  useEffect(() => {

    localStorage.setItem('projects', JSON.stringify(projects))

  }, [projects])

  const selectedProject = projects.find(

    (project) => project.id === selectedProjectId

  )

  const getTaskProgress = (task) => {
    if (typeof task.progress === 'number' && Number.isFinite(task.progress)) {
      return Math.max(0, Math.min(100, task.progress))
    }
    return task.status === 'done' || task.done ? 100 : 0
  }

  const getTaskStatus = (task) => {
    if (typeof task.progress !== 'number') {
      return task.status || (task.done ? 'done' : 'open')
    }
    const percent = getTaskProgress(task)
    return percent === 100 ? 'done' : percent === 0 ? 'open' : 'progress'
  }

  const getTaskPriority = (task) =>

    task.priority || 'medium'

  const getProjectStatus = (project) =>

    project.status || 'planned'

  const formatDate = (date) => {

    if (!date) return 'Nicht festgelegt'

    return new Date(`${date}T00:00:00`).toLocaleDateString(

      'de-DE'

    )

  }

  const priorityLabel = (priority) => {

    if (priority === 'high') return 'Hoch'

    if (priority === 'low') return 'Niedrig'

    return 'Mittel'

  }

  const projectStatusLabel = (status) => {

    if (status === 'progress') return 'In Arbeit'

    if (status === 'done') return 'Abgeschlossen'

    return 'Geplant'

  }

  const isOverdue = (task) => {

    if (!task.dueDate || getTaskStatus(task) === 'done') {

      return false

    }

    const today = new Date()

    today.setHours(0, 0, 0, 0)

    const due = new Date(`${task.dueDate}T00:00:00`)

    return due < today

  }

  const addProject = () => {

    const name = newProjectName.trim()

    if (!name) return

    const newProject = {

      id: Date.now(),

      name,

      startDate: '',

      endDate: '',

      status: 'planned',

      tasks: [],

    }

    setProjects((current) => [...current, newProject])

    setSelectedProjectId(newProject.id)

    setNewProjectName('')

  }

  const deleteProject = (projectId) => {

    const remaining = projects.filter(

      (project) => project.id !== projectId

    )

    setProjects(remaining)

    if (selectedProjectId === projectId) {

      setSelectedProjectId(remaining[0]?.id ?? null)

    }

  }

  const updateProjectField = (field, value) => {

    setProjects((current) =>

      current.map((project) =>

        project.id === selectedProjectId

          ? { ...project, [field]: value }

          : project

      )

    )

  }

  const addTask = () => {

    const text = newTask.trim()

    if (!text || !selectedProject) return

    setProjects((current) =>

      current.map((project) =>

        project.id === selectedProjectId

          ? {

              ...project,

              tasks: [

                ...project.tasks,

                {

                  id: Date.now(),

                  text,

                  done: false,

                  status: 'open',

                  progress: 0,

                  priority: newPriority,

                  dueDate: newDueDate,

                },

              ],

            }

          : project

      )

    )

    setNewTask('')

    setNewDueDate('')

    setNewPriority('medium')

  }

  const setTaskProgressDraft = (taskId, value) => {
    const progress = Math.max(0, Math.min(100, Number(value)))
    if (!Number.isFinite(progress)) return
    setProgressDrafts((current) => ({ ...current, [`${selectedProjectId}:${taskId}`]: progress }))
  }

  const reportTaskProgress = (task) => {
    const key = `${selectedProjectId}:${task.id}`
    const progress = progressDrafts[key] ?? getTaskProgress(task)
    const history = task.progressHistory || []
    if (history.length && progress === getTaskProgress(task)) return
    const recordedAt = new Date().toISOString()
    setProjects((current) => current.map((project) =>
      project.id === selectedProjectId
        ? { ...project, tasks: project.tasks.map((item) =>
            item.id === task.id
              ? { ...item, progress, done: progress === 100,
                  status: progress === 100 ? 'done' : progress === 0 ? 'open' : 'progress',
                  progressHistory: [...(item.progressHistory || []), { progress, recordedAt }] }
              : item) }
        : project))
    setProgressDrafts((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const changeTaskPriority = (taskId, priority) => {

    setProjects((current) =>

      current.map((project) =>

        project.id === selectedProjectId

          ? {

              ...project,

              tasks: project.tasks.map((task) =>

                task.id === taskId

                  ? { ...task, priority }

                  : task

              ),

            }

          : project

      )

    )

  }

  const startEditingTask = (task) => {

    setEditingTaskId(task.id)

    setEditText(task.text)

    setEditDueDate(task.dueDate || '')

    setEditPriority(getTaskPriority(task))

  }

  const cancelEditingTask = () => {

    setEditingTaskId(null)

    setEditText('')

    setEditDueDate('')

    setEditPriority('medium')

  }

  const saveEditedTask = (taskId) => {

    const text = editText.trim()

    if (!text) return

    setProjects((current) =>

      current.map((project) =>

        project.id === selectedProjectId

          ? {

              ...project,

              tasks: project.tasks.map((task) =>

                task.id === taskId

                  ? {

                      ...task,

                      text,

                      dueDate: editDueDate,

                      priority: editPriority,

                    }

                  : task

              ),

            }

          : project

      )

    )

    cancelEditingTask()

  }

  const deleteTask = (taskId) => {

    setProjects((current) =>

      current.map((project) =>

        project.id === selectedProjectId

          ? {

              ...project,

              tasks: project.tasks.filter(

                (task) => task.id !== taskId

              ),

            }

          : project

      )

    )

  }

  const readProjectPlan = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImportError('')
    setImportNotice('')
    setImportPreview(null)
    setImportBusy(true)
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Bitte eine XML-Datei unter 10 MB auswählen.')
      const plan = parseProjectXml(await file.text(), file.name)
      const matching = projects.filter((project) => project.importSource === 'ms-project' && plan.sourceGuid && project.sourceGuid === plan.sourceGuid)
      setImportTarget(matching.length === 1 ? String(matching[0].id) : 'new')
      setImportPreview(plan)
    } catch (error) {
      setImportError(error.message || 'Der Projektplan konnte nicht gelesen werden.')
    } finally {
      setImportBusy(false)
    }
  }

  const importExisting = importTarget === 'new' ? null : projects.find((project) => String(project.id) === importTarget)
  const importMatches = importPreview?.tasks.filter((task) => importExisting?.tasks.some((old) => old.msProjectUid === task.msProjectUid)).length || 0
  const importMissing = importExisting?.tasks.filter((old) => old.msProjectUid && !old.removedFromPlan && !importPreview?.tasks.some((task) => task.msProjectUid === old.msProjectUid)).length || 0

  const confirmProjectPlan = () => {
    if (!importPreview) return
    try {
      const id = importExisting?.id ?? `project:${crypto.randomUUID()}`
      const project = mergeProjectPlan(importPreview, importExisting, id, new Date().toISOString())
      const next = importExisting ? projects.map((old) => old.id === id ? project : old) : [...projects, project]
      // Verify persistent storage before claiming a successful import.
      localStorage.setItem('projects', JSON.stringify(next))
      setProjects(next)
      setSelectedProjectId(id)
      setImportNotice(`${importExisting ? 'Projektplan aktualisiert' : 'Projektplan importiert'}: ${importPreview.tasks.length} Vorgänge, ${importPreview.resources.length} Ressourcen. Bestehende Fortschrittsmeldungen bleiben erhalten.`)
      setImportPreview(null)
      setImportError('')
    } catch (error) {
      setImportError(error.name === 'QuotaExceededError' ? 'Nicht genügend Browserspeicher. Der Import wurde nicht gespeichert.' : error.message)
    }
  }

  const activeTasks = (selectedProject?.tasks || []).filter((task) => !task.isSummary && !task.removedFromPlan)
  const totalTasks = activeTasks.length
  const completedTasks = activeTasks.filter((task) => getTaskStatus(task) === 'done').length
  const openTasks = activeTasks.filter((task) => getTaskStatus(task) === 'open').length
  const progressTasks = activeTasks.filter((task) => getTaskStatus(task) === 'progress').length
  const overdueTasks = activeTasks.filter(isOverdue).length
  const progress = totalTasks === 0 ? 0 : Math.round(activeTasks.reduce((sum, task) => sum + getTaskProgress(task), 0) / totalTasks)

  const dashboardCard = {

    padding: '18px',

    border: '1px solid #ddd',

    borderRadius: '10px',

    textAlign: 'center',

    background: '#fff',

  }

  return (

    <main

      style={{

        fontFamily: 'Arial, sans-serif',

        maxWidth: '950px',

        margin: '40px auto',

        padding: '30px',

      }}

    >

      <h1>Project Progress</h1>

      <p>

        Projekte, Fortschritt, Status, Prioritäten und Termine

        einfach verfolgen.

      </p>

      <section aria-labelledby="plan-import-title" style={{ border: '1px solid #ddd', borderRadius: '10px', padding: '16px', margin: '24px 0', textAlign: 'left' }}>
        <h2 id="plan-import-title">Projektplan importieren / aktualisieren</h2>
        <p>MS-Project-XML auswählen, Vorschau prüfen und Import bestätigen. Der Plan wird in diesem Browser gespeichert.</p>
        <label htmlFor="project-plan-file"><strong>MS-Project-XML auswählen</strong></label>
        <input id="project-plan-file" type="file" accept=".xml,text/xml,application/xml" onChange={readProjectPlan} disabled={importBusy} style={{ display: 'block', maxWidth: '100%', margin: '12px 0' }} />
        {importBusy && <p role="status">Projektplan wird gelesen …</p>}
        {importError && <p role="alert" style={{ color: '#b91c1c' }}>{importError}</p>}
        {importNotice && <p role="status" style={{ color: '#166534' }}>{importNotice}</p>}
        {importPreview && <div>
          <h3>Importvorschau: {importPreview.name}</h3>
          <p>{importPreview.tasks.length} Vorgänge, davon {importPreview.tasks.filter((task) => task.isSummary).length} Sammelvorgänge · {importPreview.resources.length} Ressourcen · {importPreview.assignments.length} Zuordnungen</p>
          <label htmlFor="project-import-target">Importziel</label>{' '}
          <select id="project-import-target" value={importTarget} onChange={(event) => setImportTarget(event.target.value)} style={{ maxWidth: '100%', padding: '8px' }}>
            <option value="new">Als neues Projekt importieren</option>
            {projects.filter((project) => project.importSource === 'ms-project' && (!project.sourceGuid || !importPreview.sourceGuid || project.sourceGuid === importPreview.sourceGuid)).map((project) => <option key={project.id} value={String(project.id)}>Aktualisieren: {project.name}</option>)}
          </select>
          {importExisting && <p>{importMatches} Vorgänge wiedererkannt · {importPreview.tasks.length - importMatches} neue Vorgänge · {importMissing} nicht mehr im Plan. Deren bisherige Meldungen bleiben unter „Nicht mehr im aktuellen Plan“ erhalten.</p>}
          <p>Beim Aktualisieren bleiben gemeldete Prozentwerte und Verläufe erhalten. Zuordnung erfolgt über die Vorgangs-UID. Sammelvorgänge werden im Gesamtfortschritt nicht doppelt gezählt.</p>
          <div style={{ overflowX: 'auto', maxHeight: '340px', marginBottom: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead><tr><th>PSP / UID</th><th>Vorgang</th><th>Anfang</th><th>Ende</th><th>Ressourcen</th><th>XML-Fortschritt</th></tr></thead>
              <tbody>{importPreview.tasks.map((task) => <tr key={task.msProjectUid} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '8px' }}>{task.wbs} / {task.msProjectUid}</td><td style={{ padding: '8px', fontWeight: task.isSummary ? 'bold' : 'normal' }}>{task.text}{task.isSummary ? ' (Sammelvorgang)' : ''}</td>
                <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{formatDate(task.planStart)}</td><td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{formatDate(task.planFinish)}</td><td style={{ padding: '8px' }}>{task.resourceNames.join(', ') || '–'}</td><td style={{ padding: '8px' }}>{task.importedProgress} %</td>
              </tr>)}</tbody>
            </table>
          </div>
          <button onClick={confirmProjectPlan} style={{ minHeight: '44px', marginRight: '10px' }}>{importExisting ? 'Projektplan aktualisieren' : 'Projektplan importieren'}</button>
          <button onClick={() => { setImportPreview(null); setImportError('') }} style={{ minHeight: '44px' }}>Import abbrechen</button>
        </div>}
      </section>

      <h2>Neues Projekt</h2>

      <div style={{ display: 'flex', gap: '10px' }}>

        <input

          type="text"

          value={newProjectName}

          onChange={(event) =>

            setNewProjectName(event.target.value)

          }

          onKeyDown={(event) => {

            if (event.key === 'Enter') addProject()

          }}

          placeholder="Projektname eingeben"

          style={{

            flex: 1,

            padding: '12px',

            fontSize: '16px',

          }}

        />

        <button onClick={addProject}>

          Projekt hinzufügen

        </button>

      </div>

      <h2>Meine Projekte</h2>

      {projects.map((project) => (

        <div

          key={project.id}

          style={{

            display: 'flex',

            gap: '10px',

            marginBottom: '10px',

          }}

        >

          <button

            onClick={() => setSelectedProjectId(project.id)}

            style={{

              flex: 1,

              padding: '12px',

              fontWeight:

                project.id === selectedProjectId

                  ? 'bold'

                  : 'normal',

            }}

          >

            {project.name}

          </button>

          <button onClick={() => deleteProject(project.id)}>

            Löschen

          </button>

        </div>

      ))}

      {selectedProject && (

        <>

          <hr style={{ margin: '30px 0' }} />

          <h2>{selectedProject.name}</h2>

          <h3>Projektdaten</h3>

          <div

            style={{

              display: 'grid',

              gridTemplateColumns:

                'repeat(auto-fit, minmax(180px, 1fr))',

              gap: '12px',

              marginBottom: '30px',

            }}

          >

            <div>

              <strong>Startdatum</strong>

              <input

                type="date"

                value={selectedProject.startDate || ''}

                onChange={(event) =>

                  updateProjectField(

                    'startDate',

                    event.target.value

                  )

                }

                style={{

                  display: 'block',

                  width: '100%',

                  padding: '10px',

                  marginTop: '6px',

                  boxSizing: 'border-box',

                }}

              />

            </div>

            <div>

              <strong>Enddatum</strong>

              <input

                type="date"

                value={selectedProject.endDate || ''}

                onChange={(event) =>

                  updateProjectField(

                    'endDate',

                    event.target.value

                  )

                }

                style={{

                  display: 'block',

                  width: '100%',

                  padding: '10px',

                  marginTop: '6px',

                  boxSizing: 'border-box',

                }}

              />

            </div>

            <div>

              <strong>Projektstatus</strong>

              <select

                value={getProjectStatus(selectedProject)}

                onChange={(event) =>

                  updateProjectField(

                    'status',

                    event.target.value

                  )

                }

                style={{

                  display: 'block',

                  width: '100%',

                  padding: '10px',

                  marginTop: '6px',

                  boxSizing: 'border-box',

                }}

              >

                <option value="planned">Geplant</option>

                <option value="progress">In Arbeit</option>

                <option value="done">Abgeschlossen</option>

              </select>

            </div>

          </div>

          <p>

            <strong>Status:</strong>{' '}

            {projectStatusLabel(

              getProjectStatus(selectedProject)

            )}

            {' · '}

            <strong>Zeitraum:</strong>{' '}

            {formatDate(selectedProject.startDate)}

            {' – '}

            {formatDate(selectedProject.endDate)}

          </p>

          <h3>Dashboard</h3>

          <div

            style={{

              display: 'grid',

              gridTemplateColumns:

                'repeat(auto-fit, minmax(140px, 1fr))',

              gap: '12px',

              marginBottom: '25px',

            }}

          >

            <div style={dashboardCard}>

              <strong style={{ fontSize: '30px' }}>

                {totalTasks}

              </strong>

              <div>Gesamt</div>

            </div>

            <div style={dashboardCard}>

              <strong style={{ fontSize: '30px' }}>

                {openTasks}

              </strong>

              <div>Offen</div>

            </div>

            <div style={dashboardCard}>

              <strong style={{ fontSize: '30px' }}>

                {progressTasks}

              </strong>

              <div>In Arbeit</div>

            </div>

            <div style={dashboardCard}>

              <strong style={{ fontSize: '30px' }}>

                {overdueTasks}

              </strong>

              <div>Überfällig</div>

            </div>

          </div>

          <h3>Gesamtfortschritt: {progress} %</h3>

          <div

            style={{

              width: '100%',

              height: '28px',

              background: '#e5e7eb',

              borderRadius: '20px',

              overflow: 'hidden',

              marginBottom: '30px',

            }}

          >

            <div

              style={{

                width: `${progress}%`,

                height: '100%',

                background: '#22c55e',

              }}

            />

          </div>

          <h2>Neuen Arbeitsschritt hinzufügen</h2>

          <div

            style={{

              display: 'grid',

              gridTemplateColumns: '1fr auto auto auto',

              gap: '10px',

              marginBottom: '30px',

            }}

          >

            <input

              type="text"

              value={newTask}

              onChange={(event) =>

                setNewTask(event.target.value)

              }

              placeholder="Arbeitsschritt eingeben"

              style={{ padding: '12px' }}

            />

            <input

              type="date"

              value={newDueDate}

              onChange={(event) =>

                setNewDueDate(event.target.value)

              }

              style={{ padding: '12px' }}

            />

            <select

              value={newPriority}

              onChange={(event) =>

                setNewPriority(event.target.value)

              }

              style={{ padding: '12px' }}

            >

              <option value="low">Niedrig</option>

              <option value="medium">Mittel</option>

              <option value="high">Hoch</option>

            </select>

            <button onClick={addTask}>

              Hinzufügen

            </button>

          </div>

          <h2>Arbeitsschritte</h2>

          {selectedProject.tasks.map((task) => {
            if (task.isSummary || task.removedFromPlan) return (
              <section key={task.id} style={{ margin: '12px 0', padding: '14px', background: '#f1f5f9', borderRadius: '8px', textAlign: 'left', borderLeft: '4px solid #64748b' }}>
                <strong>{task.wbs ? `${task.wbs} · ` : ''}{task.text}</strong>
                <p style={{ margin: '6px 0' }}>{task.removedFromPlan ? 'Nicht mehr im aktuellen Plan' : 'Sammelvorgang'} · {formatDate(task.planStart)} – {formatDate(task.planFinish)}</p>
                {task.removedFromPlan && <ProgressHistory task={task} />}
              </section>
            )

            const status = getTaskStatus(task)

            const priority = getTaskPriority(task)

            const overdue = isOverdue(task)

            const editing = editingTaskId === task.id
            const draftProgress = progressDrafts[`${selectedProjectId}:${task.id}`] ?? getTaskProgress(task)
            const canReportProgress = !(task.progressHistory || []).length || draftProgress !== getTaskProgress(task)

            return (

              <div

                key={task.id}

                style={{

                  padding: '14px',

                  marginBottom: '10px',

                  border: overdue

                    ? '2px solid #dc2626'

                    : '1px solid #ddd',

                  borderRadius: '8px',

                }}

              >

                {editing ? (

                  <div

                    style={{

                      display: 'flex',

                      gap: '10px',

                      flexWrap: 'wrap',

                    }}

                  >

                    <input

                      value={editText}

                      onChange={(event) =>

                        setEditText(event.target.value)

                      }

                    />

                    <input

                      type="date"

                      value={editDueDate}

                      onChange={(event) =>

                        setEditDueDate(event.target.value)

                      }

                    />

                    <select

                      value={editPriority}

                      onChange={(event) =>

                        setEditPriority(event.target.value)

                      }

                    >

                      <option value="low">Niedrig</option>

                      <option value="medium">Mittel</option>

                      <option value="high">Hoch</option>

                    </select>

                    <button

                      onClick={() => saveEditedTask(task.id)}

                    >

                      Speichern

                    </button>

                    <button onClick={cancelEditingTask}>

                      Abbrechen

                    </button>

                  </div>

                ) : (

                  <div

                    style={{

                      display: 'flex',

                      alignItems: 'center',

                      gap: '12px',

                      flexWrap: 'wrap',

                    }}

                  >

                    <div style={{ flex: '1 1 250px' }}>

                      <strong>{task.wbs ? `${task.wbs} · ` : ''}{task.text}</strong>
                      {task.msProjectUid && <p style={{ fontSize: '14px', margin: '6px 0' }}>Plan: {formatDate(task.planStart)} – {formatDate(task.planFinish)}<br />Ressourcen: {task.resourceNames?.join(', ') || 'Nicht zugeordnet'}{task.isMilestone ? ' · Meilenstein' : ''}</p>}

                      <div>

                        <small>

                          Termin: {formatDate(task.dueDate)}

                        </small>

                      </div>

                      <div>

                        <small>

                          Priorität: {priorityLabel(priority)}

                        </small>

                      </div>

                      {overdue && (

                        <strong style={{ color: '#dc2626' }}>

                          Überfällig

                        </strong>

                      )}

                    </div>

                    <select

                      value={priority}

                      onChange={(event) =>

                        changeTaskPriority(

                          task.id,

                          event.target.value

                        )

                      }

                    >

                      <option value="low">Niedrig</option>

                      <option value="medium">Mittel</option>

                      <option value="high">Hoch</option>

                    </select>

                    <label style={{ flex: '1 1 220px', minWidth: 0 }}>
                      <strong>Fortschritt einstellen: {draftProgress} %</strong>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={draftProgress}
                        aria-label={`Fortschritt für ${task.text}`}
                        onChange={(event) => setTaskProgressDraft(task.id, event.target.value)}
                        style={{ display: 'block', width: '100%', minHeight: '44px', margin: '4px 0', accentColor: '#22c55e' }}
                      />
                      <span>Gespeichert: {getTaskProgress(task)} % · {status === 'done' ? 'Erledigt' : status === 'progress' ? 'In Arbeit' : 'Offen'}</span>
                    </label>
                    <div style={{ flex: '1 1 180px' }}>
                      <button onClick={() => reportTaskProgress(task)} disabled={!canReportProgress} aria-label={`Fortschritt melden für ${task.text}`} style={{ minHeight: '44px' }}>Fortschritt melden</button>
                      {draftProgress !== getTaskProgress(task) && <p role="status" style={{ fontSize: '14px', margin: '6px 0' }}>Noch nicht gemeldet</p>}
                    </div>

                    <button

                      onClick={() => startEditingTask(task)}

                    >

                      Bearbeiten

                    </button>

                    <button

                      onClick={() => deleteTask(task.id)}

                    >

                      Löschen

                    </button>

                  </div>

                )}
                <ProgressHistory task={task} />

              </div>

            )

          })}

          <p>

            <strong>

              {completedTasks} von {totalTasks} Arbeitsschritten

              abgeschlossen

            </strong>

          </p>

        </>

      )}

    </main>

  )

}

export default App
