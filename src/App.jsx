import { useState } from 'react'

import './App.css'

function App() {

  const [progress, setProgress] = useState(35)

  const nextStep = () => {

    setProgress((value) => Math.min(value + 10, 100))

  }

  return (

    <main style={{

      fontFamily: 'Arial, sans-serif',

      maxWidth: '700px',

      margin: '60px auto',

      padding: '30px'

    }}>

      <h1>Project Progress</h1>

      <p>Projektfortschritt einfach erfassen und verfolgen.</p>

      <h2>Aktueller Fortschritt</h2>

      <div style={{

        width: '100%',

        height: '28px',

        background: '#e5e7eb',

        borderRadius: '14px',

        overflow: 'hidden'

      }}>

        <div style={{

          width: `${progress}%`,

          height: '100%',

          background: '#2563eb',

          transition: 'width 0.3s'

        }} />

      </div>

      <h2>{progress} %</h2>

      <button

        onClick={nextStep}

        style={{

          padding: '12px 20px',

          fontSize: '16px',

          cursor: 'pointer'

        }}

      >

        Fortschritt +10 %

      </button>

      {progress === 100 && (

        <p><strong>Projekt abgeschlossen ✓</strong></p>

      )}

    </main>

  )

}

export default App

