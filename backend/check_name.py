import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))
import app

with app.get_db() as conn:
    with conn.cursor() as cur:
        cur.execute("SELECT name FROM users WHERE email = 'kiah4u2c@gmail.com';")
        print("DB NAME IS:", cur.fetchone()["name"])
