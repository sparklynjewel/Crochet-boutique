import { useEffect, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL ?? ''

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function App() {
  const [todos, setTodos] = useState([])
  const [note, setNote] = useState('')
  const [time, setTime] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [error, setError] = useState('')

  // Load todos from the Python backend when the page opens
  useEffect(() => {
    fetchTodos()
  }, [])

  async function fetchTodos() {
    try {
      const response = await fetch(`${API_URL}/todos`)
      const data = await response.json()
      setTodos(data)
      setError('')
    } catch {
      setError('Cannot connect to the backend. Make sure the Python server is running.')
    }
  }

  async function handleAdd(event) {
    event.preventDefault()
    if (!note.trim()) {
      setError('Please type a note before adding.')
      return
    }

    try {
      const response = await fetch(`${API_URL}/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, time, priority }),
      })
      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Could not add todo.')
        return
      }
      setNote('')
      setTime('')
      setPriority('Medium')
      setError('')
      fetchTodos()
    } catch {
      setError('Cannot connect to the backend. Make sure the Python server is running.')
    }
  }

  async function handleDelete(id) {
    try {
      await fetch(`${API_URL}/todos/${id}`, { method: 'DELETE' })
      fetchTodos()
    } catch {
      setError('Cannot connect to the backend. Make sure the Python server is running.')
    }
  }

  return (
    <div className="app">
      <h1>Todo List</h1>

      <form className="todo-form" onSubmit={handleAdd}>
        <div className="field">
          <label htmlFor="note">Note</label>
          <input
            id="note"
            type="text"
            placeholder="Type a note..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="time">Date and Time</label>
          <input
            id="time"
            type="datetime-local"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="priority">Priority</label>
          <select
            id="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </div>

        <div className="options">
          <span className="options-label">Options</span>
          <button type="submit" className="add-btn">
            Add
          </button>
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      <div className="todo-list">
        {todos.length === 0 && (
          <p className="empty">No todos yet. Add one above!</p>
        )}

        {todos.map((todo) => (
          <div className="todo-item" key={todo.id}>
            <div className="todo-body">
              <p className="todo-note">{todo.note}</p>
              <p className="todo-details">
                {formatDateTime(todo.time)} · {todo.priority}
              </p>
            </div>
            <div className="options">
              <span className="options-label">Options</span>
              <button
                type="button"
                className="delete-btn"
                onClick={() => handleDelete(todo.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
