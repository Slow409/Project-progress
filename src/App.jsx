import { useEffect, useState } from 'react'

import './App.css'

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

  const changeTaskProgress = (taskId, value) => {
    const progress = Math.max(0, Math.min(100, Number(value)))
    if (!Number.isFinite(progress)) return
    setProjects((current) => current.map((project) =>
      project.id === selectedProjectId
        ? { ...project, tasks: project.tasks.map((task) =>
            task.id === taskId
              ? { ...task, progress, done: progress === 100,
                  status: progress === 100 ? 'done' : progress === 0 ? 'open' : 'progress' }
              : task) }
        : project))
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
                      <strong>Fortschritt: {getTaskProgress(task)} %</strong>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={getTaskProgress(task)}
                        aria-label={`Fortschritt für ${task.text}`}
                        onChange={(event) => changeTaskProgress(task.id, event.target.value)}
                        style={{ display: 'block', width: '100%', minHeight: '44px', margin: '4px 0', accentColor: '#22c55e' }}
                      />
                      <span>{status === 'done' ? 'Erledigt' : status === 'progress' ? 'In Arbeit' : 'Offen'}</span>
                    </label>

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
