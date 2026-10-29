import { useEffect, useState } from 'react'

const startTasks = [

  { id: 1, name: 'Projektplanung', done: true },

  { id: 2, name: 'Material beschaffen', done: false },

  { id: 3, name: 'Montage durchführen', done: false },

]

function App() {

  const [tasks, setTasks] = useState(() => {

    const savedTasks = localStorage.getItem('project-progress-tasks')

    return savedTasks ? JSON.parse(savedTasks) : startTasks

  })

  const [newTask, setNewTask] = useState('')

  useEffect(() => {

    localStorage.setItem(

      'project-progress-tasks',

      JSON.stringify(tasks)

    )

  }, [tasks])

  const toggleTask = (id) => {

    setTasks(

      tasks.map((task) =>

        task.id === id ? { ...task, done: !task.done } : task

      )

    )

  }

  const addTask = () => {

    const name = newTask.trim()

    if (!name) return

    setTasks([

      ...tasks,

      {

        id: Date.now(),

        name,

        done: false,

      },

    ])

    setNewTask('')

  }

  const deleteTask = (id) => {

    setTasks(tasks.filter((task) => task.id !== id))

  }

  const completed = tasks.filter((task) => task.done).length

  const progress =

    tasks.length === 0

      ? 0

      : Math.round((completed / tasks.length) * 100)

  return (

    <main

      style={{

        fontFamily: 'Arial, sans-serif',

        maxWidth: '700px',

        margin: '50px auto',

        padding: '30px',

      }}

    >

      <h1>Project Progress</h1>

      <p>Projektfortschritt einfach erfassen und verfolgen.</p>

      <h2>Gesamtfortschritt: {progress} %</h2>

      <div

        style={{

          width: '100%',

          height: '28px',

          background: '#e5e7eb',

          borderRadius: '14px',

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

          display: 'flex',

          gap: '10px',

          marginBottom: '30px',

        }}

      >

        <input

          type="text"

          value={newTask}

          onChange={(event) => setNewTask(event.target.value)}

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

            padding: '12px 18px',

            fontSize: '16px',

            cursor: 'pointer',

          }}

        >

          Hinzufügen

        </button>

      </div>

      <h2>Arbeitsschritte</h2>

      {tasks.map((task) => (

        <div

          key={task.id}

          style={{

            display: 'flex',

            alignItems: 'center',

            gap: '12px',

            padding: '14px',

            marginBottom: '10px',

            border: '1px solid #ddd',

            borderRadius: '8px',

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

              textDecoration: task.done ? 'line-through' : 'none',

            }}

          >

            {task.name}

          </span>

          <button

            onClick={() => deleteTask(task.id)}

            style={{

              padding: '7px 12px',

              cursor: 'pointer',

            }}

          >

            Löschen

          </button>

        </div>

      ))}

      <p>

        <strong>

          {completed} von {tasks.length} Arbeitsschritten abgeschlossen

        </strong>

      </p>

    </main>

  )

}

export default App
