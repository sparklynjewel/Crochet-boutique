import requests

API_URL = "https://crochet-boutique-0si4.onrender.com"

# Test direct login with correct email
res = requests.post(f"{API_URL}/api/auth/google", json={"credential": "kiah4u2c@gmail.com"})
print("Login Response:", res.json())
user_id = res.json()["user"]["id"]

# Test syncing cart
cart_items = [{"id": 10, "quantity": 2}]
sync_res = requests.post(f"{API_URL}/api/cart", json={"user_id": user_id, "items": cart_items})
print("Sync Cart Response:", sync_res.json())

# Test fetching cart
get_res = requests.get(f"{API_URL}/api/cart?user_id={user_id}")
print("Fetched Cart Response:", get_res.json())
