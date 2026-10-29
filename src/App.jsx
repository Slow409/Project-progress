import { useEffect, useState } from 'react'

import './App.css'

function App() {

  const [projects, setProjects] = useState(() => {

    const saved = localStorage.getItem('projects')

    if (saved) {

      return JSON.parse(saved)

    }

    return [

      {

        id: 1,

        name: 'Mein erstes Projekt',

        tasks: [

          { id: 1, text: 'Projektplanung', done: true },

          { id: 2, text: 'Material beschaffen', done: false },

          { id: 3, text: 'Montage durchführen', done: false },

        ],

      },

    ]

  })

  const [selectedProjectId, setSelectedProjectId] = useState(

    projects[0]?.id ?? null

  )

  const [newProjectName, setNewProjectName] = useState('')

  const [newTask, setNewTask] = useState('')

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

    setProjects((currentProjects) => [

      ...currentProjects,

      newProject,

    ])

    setSelectedProjectId(newProject.id)

    setNewProjectName('')

  }

  const deleteProject = (projectId) => {

    const remainingProjects = projects.filter(

      (project) => project.id !== projectId

    )

    setProjects(remainingProjects)

    if (selectedProjectId === projectId) {

      setSelectedProjectId(remainingProjects[0]?.id ?? null)

    }

  }

  const addTask = () => {

    const text = newTask.trim()

    if (!text || !selectedProject) return

    setProjects((currentProjects) =>

      currentProjects.map((project) =>

        project.id === selectedProjectId

          ? {

              ...project,

              tasks: [

                ...project.tasks,

                {

                  id: Date.now(),

                  text,

                  done: false,

                },

              ],

            }

          : project

      )

    )

    setNewTask('')

  }

  const toggleTask = (taskId) => {

    setProjects((currentProjects) =>

      currentProjects.map((project) =>

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

    setProjects((currentProjects) =>

      currentProjects.map((project) =>

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

        maxWidth: '800px',

        margin: '40px auto',

        padding: '30px',

      }}

    >

      <h1>Project Progress</h1>

      <p>Mehrere Projekte einfach erfassen und verfolgen.</p>

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

        <button

          onClick={addProject}

          style={{

            padding: '12px 20px',

            cursor: 'pointer',

          }}

        >

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

              cursor: 'pointer',

              fontWeight:

                project.id === selectedProjectId

                  ? 'bold'

                  : 'normal',

            }}

          >

            {project.name}

          </button>

          <button

            onClick={() => deleteProject(project.id)}

            style={{

              padding: '12px',

              cursor: 'pointer',

            }}

          >

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

          <div style={{ display: 'flex', gap: '10px' }}>

            <input

              type="text"

              value={newTask}

              onChange={(event) =>

                setNewTask(event.target.value)

              }

              onKeyDown={(event) => {

                if (event.key === 'Enter') addTask()

              }}

              placeholder="Arbeitsschritt eingeben"

              style={{

                flex: 1,

                padding: '12px',

                fontSize: '16px',

              }}

            />

            <button

              onClick={addTask}

              style={{

                padding: '12px 20px',

                cursor: 'pointer',

              }}

            >

              Hinzufügen

            </button>

          </div>

          <h2>Arbeitsschritte</h2>

          {selectedProject.tasks.length === 0 && (

            <p>Noch keine Arbeitsschritte vorhanden.</p>

          )}

          {selectedProject.tasks.map((task) => (

            <div

              key={task.id}

              style={{

                display: 'flex',

                alignItems: 'center',

                gap: '15px',

                padding: '12px 0',

                borderBottom: '1px solid #ddd',

              }}

            >

              <input

                type="checkbox"

                checked={task.done}

                onChange={() => toggleTask(task.id)}

              />

              <span

                style={{

                  flex: 1,

                  textDecoration: task.done

                    ? 'line-through'

                    : 'none',

                }}

              >

                {task.text}

              </span>

              <button

                onClick={() => deleteTask(task.id)}

                style={{

                  padding: '8px 14px',

                  cursor: 'pointer',

                }}

              >

                Löschen

              </button>

            </div>

          ))}

          <p style={{ fontWeight: 'bold' }}>

            {completedTasks} von {totalTasks} Arbeitsschritten

            abgeschlossen

          </p>

        </>

      )}

    </main>

  )

}

export default App
