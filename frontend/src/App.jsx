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
      <h1>My Todo List</h1>

      <form className="todo-form" onSubmit={handleAdd}>
        <div className="field">
          <label htmlFor="note">Note</label>
          <input
            id="note"
            type="text"
            placeholder="Type a task..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="field-row">
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
        </div>

        <button type="submit" className="add-btn">
          Add
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      <div className="todo-list">
        <div className="list-header">
          <span>Note</span>
          <span>Date and Time and Priority</span>
          <span></span>
        </div>

        {todos.length === 0 && (
          <p className="empty">No tasks yet. Add one above!</p>
        )}

        {todos.map((todo) => (
          <div className="todo-item" key={todo.id}>
            <span className="todo-note">{todo.note}</span>
            <span className="todo-meta">
              {formatDateTime(todo.time)} · {todo.priority}
            </span>
            <button
              type="button"
              className="delete-btn"
              onClick={() => handleDelete(todo.id)}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
