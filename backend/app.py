import os
import sqlite3
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Allows the React frontend to talk to this backend during local development

BASE_DIR = Path(__file__).resolve().parent
DIST_DIR = BASE_DIR.parent / "frontend" / "dist"
DATABASE_PATH = Path(os.environ.get("DATABASE_PATH", BASE_DIR / "todos.db"))


def get_db():
    """Open a connection to the SQLite database."""
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create the todos table if it does not exist yet."""
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS todos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                note TEXT NOT NULL,
                time TEXT NOT NULL DEFAULT '',
                priority TEXT NOT NULL DEFAULT 'Medium'
            )
            """
        )


init_db()


@app.get("/todos")
def get_todos():
    """Return all todos."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, note, time, priority FROM todos ORDER BY id"
        ).fetchall()
    return jsonify([dict(row) for row in rows])


@app.post("/todos")
def add_todo():
    """Add a new todo with note, time, and priority."""
    data = request.get_json() or {}

    note = (data.get("note") or "").strip()
    time = (data.get("time") or "").strip()
    priority = (data.get("priority") or "").strip() or "Medium"

    if not note:
        return jsonify({"error": "Note is required"}), 400

    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO todos (note, time, priority) VALUES (?, ?, ?)",
            (note, time, priority),
        )
        todo_id = cursor.lastrowid

    return jsonify(
        {"id": todo_id, "note": note, "time": time, "priority": priority}
    ), 201


@app.delete("/todos/<int:todo_id>")
def delete_todo(todo_id):
    """Delete a todo by its id."""
    with get_db() as conn:
        cursor = conn.execute("DELETE FROM todos WHERE id = ?", (todo_id,))
        if cursor.rowcount == 0:
            return jsonify({"error": "Todo not found"}), 404
    return jsonify({"ok": True})


@app.get("/")
def serve_index():
    """Serve the React app homepage when the built frontend exists."""
    index = DIST_DIR / "index.html"
    if index.exists():
        return send_from_directory(DIST_DIR, "index.html")
    return jsonify(
        {
            "message": "API is running. Build the frontend (npm run build) "
            "or use the Vite dev server at http://localhost:5173"
        }
    )


@app.get("/<path:path>")
def serve_frontend(path):
    """Serve built React static files (JS, CSS, images)."""
    file_path = DIST_DIR / path
    if file_path.is_file():
        return send_from_directory(DIST_DIR, path)
    index = DIST_DIR / "index.html"
    if index.exists():
        return send_from_directory(DIST_DIR, "index.html")
    return jsonify({"error": "Not found"}), 404


if __name__ == "__main__":
    # Runs at http://127.0.0.1:5000
    app.run(debug=True, port=5000)
