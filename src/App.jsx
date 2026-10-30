import { useEffect, useState } from 'react'

import './App.css'

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

  const totalTasks = selectedProject?.tasks.length ?? 0

  const completedTasks =

    selectedProject?.tasks.filter(

      (task) => getTaskStatus(task) === 'done'

    ).length ?? 0

  const openTasks =

    selectedProject?.tasks.filter(

      (task) => getTaskStatus(task) === 'open'

    ).length ?? 0

  const progressTasks =

    selectedProject?.tasks.filter(

      (task) => getTaskStatus(task) === 'progress'

    ).length ?? 0

  const overdueTasks =

    selectedProject?.tasks.filter(isOverdue).length ?? 0

  const progress =

    totalTasks === 0

      ? 0

      : Math.round(selectedProject.tasks.reduce((sum, task) => sum + getTaskProgress(task), 0) / totalTasks)

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

                      <strong>{task.text}</strong>

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
