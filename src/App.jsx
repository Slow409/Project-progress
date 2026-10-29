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

            dueDate: '',

          },

          {

            id: 2,

            text: 'Material beschaffen',

            done: false,

            dueDate: '',

          },

          {

            id: 3,

            text: 'Montage durchführen',

            done: false,

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

  useEffect(() => {

    localStorage.setItem('projects', JSON.stringify(projects))

  }, [projects])

  const selectedProject = projects.find(

    (project) => project.id === selectedProjectId

  )

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

                  dueDate: newDueDate,

                },

              ],

            }

          : project

      )

    )

    setNewTask('')

    setNewDueDate('')

  }

  const toggleTask = (taskId) => {

    setProjects((current) =>

      current.map((project) =>

        project.id === selectedProjectId

          ? {

              ...project,

              tasks: project.tasks.map((task) =>

                task.id === taskId

                  ? { ...task, done: !task.done }

                  : task

              ),

            }

          : project

      )

    )

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

  const isOverdue = (task) => {

    if (!task.dueDate || task.done) return false

    const today = new Date()

    today.setHours(0, 0, 0, 0)

    const due = new Date(`${task.dueDate}T00:00:00`)

    return due < today

  }

  const formatDate = (date) => {

    if (!date) return 'Kein Termin'

    return new Date(`${date}T00:00:00`).toLocaleDateString(

      'de-DE'

    )

  }

  const completedTasks =

    selectedProject?.tasks.filter((task) => task.done).length ?? 0

  const totalTasks = selectedProject?.tasks.length ?? 0

  const progress =

    totalTasks === 0

      ? 0

      : Math.round((completedTasks / totalTasks) * 100)

  return (

    <main

      style={{

        fontFamily: 'Arial, sans-serif',

        maxWidth: '850px',

        margin: '40px auto',

        padding: '30px',

      }}

    >

      <h1>Project Progress</h1>

      <p>Projekte, Fortschritt und Termine einfach verfolgen.</p>

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

              gridTemplateColumns: '1fr auto auto',

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

            <button onClick={addTask}>

              Hinzufügen

            </button>

          </div>

          <h2>Arbeitsschritte</h2>

          {selectedProject.tasks.length === 0 && (

            <p>Noch keine Arbeitsschritte vorhanden.</p>

          )}

          {selectedProject.tasks.map((task) => {

            const overdue = isOverdue(task)

            return (

              <div

                key={task.id}

                style={{

                  display: 'flex',

                  alignItems: 'center',

                  gap: '15px',

                  padding: '14px',

                  marginBottom: '10px',

                  border: overdue

                    ? '2px solid #dc2626'

                    : '1px solid #ddd',

                  borderRadius: '8px',

                }}

              >

                <input

                  type="checkbox"

                  checked={task.done}

                  onChange={() => toggleTask(task.id)}

                />

                <div style={{ flex: 1 }}>

                  <div

                    style={{

                      textDecoration: task.done

                        ? 'line-through'

                        : 'none',

                    }}

                  >

                    {task.text}

                  </div>

                  <small>

                    Termin: {formatDate(task.dueDate)}

                  </small>

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

                <button onClick={() => deleteTask(task.id)}>

                  Löschen

                </button>

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