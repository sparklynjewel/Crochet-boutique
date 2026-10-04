import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))
import app

with app.get_db() as conn:
    with conn.cursor() as cur:
        cur.execute("UPDATE users SET name = 'Odofin Moronke' WHERE email = 'kiah4u2c@gmail.com';")
    conn.commit()
print("Updated user name to Odofin Moronke in Supabase!")
