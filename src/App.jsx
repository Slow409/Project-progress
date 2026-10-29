
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

        tasks: [

          {

            id: 1,

            text: 'Projektplanung',

            done: true,

            status: 'done',

            priority: 'medium',

            dueDate: '',

          },

          {

            id: 2,

            text: 'Material beschaffen',

            done: false,

            status: 'open',

            priority: 'medium',

            dueDate: '',

          },

          {

            id: 3,

            text: 'Montage durchführen',

            done: false,

            status: 'open',

            priority: 'medium',

            dueDate: '',

          },

        ],

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

  const getTaskStatus = (task) => {

    if (task.status) return task.status

    return task.done ? 'done' : 'open'

  }

  const getTaskPriority = (task) => {

    return task.priority || 'medium'

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

  const changeTaskStatus = (taskId, newStatus) => {

    setProjects((current) =>

      current.map((project) =>

        project.id === selectedProjectId

          ? {

              ...project,

              tasks: project.tasks.map((task) =>

                task.id === taskId

                  ? {

                      ...task,

                      status: newStatus,

                      done: newStatus === 'done',

                    }

                  : task

              ),

            }

          : project

      )

    )

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

  const formatDate = (date) => {

    if (!date) return 'Kein Termin'

    return new Date(`${date}T00:00:00`).toLocaleDateString(

      'de-DE'

    )

  }

  const priorityLabel = (priority) => {

    if (priority === 'high') return 'Hoch'

    if (priority === 'low') return 'Niedrig'

    return 'Mittel'

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

    selectedProject?.tasks.filter((task) => isOverdue(task))

      .length ?? 0

  const progress =

    totalTasks === 0

      ? 0

      : Math.round((completedTasks / totalTasks) * 100)

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

      <div

        style={{

          display: 'flex',

          gap: '10px',

          marginBottom: '25px',

        }}

      >

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

      {projects.length === 0 && (

        <p>Noch kein Projekt vorhanden.</p>

      )}

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

              <div style={{ fontSize: '30px', fontWeight: 'bold' }}>

                {totalTasks}

              </div>

              <div>Gesamt</div>

            </div>

            <div style={dashboardCard}>

              <div style={{ fontSize: '30px', fontWeight: 'bold' }}>

                {openTasks}

              </div>

              <div>Offen</div>

            </div>

            <div style={dashboardCard}>

              <div style={{ fontSize: '30px', fontWeight: 'bold' }}>

                {progressTasks}

              </div>

              <div>In Arbeit</div>

            </div>

            <div style={dashboardCard}>

              <div style={{ fontSize: '30px', fontWeight: 'bold' }}>

                {overdueTasks}

              </div>

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

                transition: 'width 0.3s',

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

              style={{

                padding: '12px',

                fontSize: '16px',

              }}

            />

            <input

              type="date"

              value={newDueDate}

              onChange={(event) =>

                setNewDueDate(event.target.value)

              }

              style={{

                padding: '12px',

                fontSize: '16px',

              }}

            />

            <select

              value={newPriority}

              onChange={(event) =>

                setNewPriority(event.target.value)

              }

              style={{

                padding: '12px',

                fontSize: '16px',

              }}

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

          {selectedProject.tasks.length === 0 && (

            <p>Noch keine Arbeitsschritte vorhanden.</p>

          )}

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

                      display: 'grid',

                      gridTemplateColumns:

                        '1fr auto auto auto auto',

                      gap: '10px',

                      alignItems: 'center',

                    }}

                  >

                    <input

                      type="text"

                      value={editText}

                      onChange={(event) =>

                        setEditText(event.target.value)

                      }

                      style={{ padding: '8px' }}

                    />

                    <input

                      type="date"

                      value={editDueDate}

                      onChange={(event) =>

                        setEditDueDate(event.target.value)

                      }

                      style={{ padding: '8px' }}

                    />

                    <select

                      value={editPriority}

                      onChange={(event) =>

                        setEditPriority(event.target.value)

                      }

                      style={{ padding: '8px' }}

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

                      <div

                        style={{

                          fontWeight: 'bold',

                          textDecoration:

                            status === 'done'

                              ? 'line-through'

                              : 'none',

                        }}

                      >

                        {task.text}

                      </div>

                      <small>

                        Termin: {formatDate(task.dueDate)}

                      </small>

                      <div>

                        <small>

                          Priorität: {priorityLabel(priority)}

                        </small>

                      </div>

                      {overdue && (

                        <div

                          style={{

                            color: '#dc2626',

                            fontWeight: 'bold',

                            marginTop: '4px',

                          }}

                        >

                          Überfällig

                        </div>

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

                      style={{

                        padding: '8px',

                        fontSize: '15px',

                      }}

                    >

                      <option value="low">Niedrig</option>

                      <option value="medium">Mittel</option>

                      <option value="high">Hoch</option>

                    </select>

                    <select

                      value={status}

                      onChange={(event) =>

                        changeTaskStatus(

                          task.id,

                          event.target.value

                        )

                      }

                      style={{

                        padding: '8px',

                        fontSize: '15px',

                      }}

                    >

                      <option value="open">Offen</option>

                      <option value="progress">

                        In Arbeit

                      </option>

                      <option value="done">Erledigt</option>

                    </select>

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
