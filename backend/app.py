from pathlib import Path
from dotenv import load_dotenv

# Load variables from .env file inside backend/ or root
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")

import os
import uuid
from decimal import Decimal
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from mailer import send_order_confirmation
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import stripe

app = Flask(__name__)
CORS(app)

DIST_DIR = BASE_DIR.parent / "frontend" / "dist"
UPLOADS_DIR = BASE_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
DATABASE_URL = os.environ.get("DATABASE_URL")
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "").strip()
STRIPE_PUBLISHABLE_KEY = os.environ.get("STRIPE_PUBLISHABLE_KEY", "").strip()

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


def get_db():
    """Establish and return a connection to the PostgreSQL database."""
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable is missing. Check your backend/.env file.")
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    return conn


def init_db():
    """Create necessary shop tables and seed initial products if empty."""
    if not DATABASE_URL or "[YOUR-PASSWORD]" in DATABASE_URL:
        print("[DB] Warning: DATABASE_URL not fully configured yet.")
        return

    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                # 1. Users table (for Google Auth)
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS users (
                        id SERIAL PRIMARY KEY,
                        google_id TEXT UNIQUE,
                        email TEXT UNIQUE NOT NULL,
                        name TEXT,
                        avatar_url TEXT,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                    """
                )

                # 2. Products table (Shop catalog)
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS products (
                        id SERIAL PRIMARY KEY,
                        title TEXT NOT NULL,
                        description TEXT,
                        price NUMERIC(10, 2) NOT NULL,
                        image_url TEXT,
                        category TEXT DEFAULT 'General',
                        stock INTEGER DEFAULT 100,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                    """
                )

                # 3. Orders table
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS orders (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                        customer_name TEXT NOT NULL,
                        customer_email TEXT NOT NULL,
                        shipping_address TEXT,
                        total_amount NUMERIC(10, 2) NOT NULL,
                        status TEXT DEFAULT 'pending',
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                    """
                )

                # 4. Order items table
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS order_items (
                        id SERIAL PRIMARY KEY,
                        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
                        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
                        title TEXT NOT NULL,
                        price NUMERIC(10, 2) NOT NULL,
                        quantity INTEGER NOT NULL DEFAULT 1
                    );
                    """
                )

                # Schema updates for boutique features
                cur.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';")
                cur.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS care_instructions TEXT DEFAULT '';")
                cur.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS badge TEXT DEFAULT '';")
                cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT DEFAULT '';")
                cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_session_id TEXT DEFAULT '';")

                # Check if products need seeding
                cur.execute("SELECT COUNT(*) AS count FROM products;")
                row = cur.fetchone()
                if row and row["count"] == 0:
                    seed_products = [
                        (
                            "Minimalist Leather Backpack",
                            "Durable, waterproof everyday carry backpack with laptop sleeve.",
                            79.99,
                            "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600",
                            "Bags",
                            25,
                        ),
                        (
                            "Wireless Noise-Canceling Headphones",
                            "Premium audio quality with 30-hour battery life.",
                            129.50,
                            "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600",
                            "Electronics",
                            40,
                        ),
                        (
                            "Organic Cotton Hoodie",
                            "Ultra-soft relaxed fit hoodie made from 100% organic cotton.",
                            49.00,
                            "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600",
                            "Clothing",
                            50,
                        ),
                        (
                            "Mechanical Keyboard RGB",
                            "Compact tenkeyless mechanical keyboard with customizable RGB backlighting.",
                            89.99,
                            "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600",
                            "Electronics",
                            15,
                        ),
                        (
                            "Stainless Steel Water Bottle",
                            "Double-wall vacuum insulated flask that keeps drinks cold 24h.",
                            24.95,
                            "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600",
                            "Accessories",
                            80,
                        ),
                    ]
                    cur.executemany(
                        """
                        INSERT INTO products (title, description, price, image_url, category, stock)
                        VALUES (%s, %s, %s, %s, %s, %s);
                        """,
                        seed_products,
                    )
            conn.commit()
            print("[DB] Tables and seed data initialized successfully.")
    except Exception as e:
        print(f"[DB] Error initializing database: {e}")


# Run DB initialization when app starts
init_db()


def serialize_product(p):
    """Ensure Decimal values and array formats are converted for JSON response."""
    images = p.get("images") or []
    if not images and p.get("image_url"):
        images = [p["image_url"]]

    return {
        "id": p["id"],
        "title": p["title"],
        "description": p["description"],
        "price": float(p["price"]) if isinstance(p["price"], Decimal) else p["price"],
        "image_url": p.get("image_url") or (images[0] if images else ""),
        "images": images,
        "category": p.get("category") or "Crochet Wear",
        "stock": p.get("stock", 0),
        "care_instructions": p.get("care_instructions") or "",
        "badge": p.get("badge") or "",
        "created_at": p["created_at"].isoformat() if p.get("created_at") else None,
    }


# ==========================================
# REST API ENDPOINTS
# ==========================================


@app.get("/api/health")
def health_check():
    """Verify backend and database connectivity."""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 AS ok;")
                row = cur.fetchone()
        return jsonify({"status": "healthy", "database": "connected" if row else "unknown"})
    except Exception as e:
        return jsonify({"status": "error", "database_error": str(e)}), 500


@app.get("/api/products")
def get_products():
    """Retrieve product catalog with optional search & category filter."""
    category = request.args.get("category", "").strip()
    search = request.args.get("search", "").strip()

    query = """
        SELECT id, title, description, price, image_url, images, category, stock, care_instructions, badge, created_at
        FROM products WHERE 1=1
    """
    params = []

    if category and category != "All":
        query += " AND category = %s"
        params.append(category)

    if search:
        query += " AND (title ILIKE %s OR description ILIKE %s)"
        params.append(f"%{search}%")
        params.append(f"%{search}%")

    query += " ORDER BY id DESC"

    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(query, params)
                products = cur.fetchall()
        return jsonify([serialize_product(p) for p in products])
    except Exception as e:
        return jsonify({"error": f"Failed to retrieve products: {str(e)}"}), 500


@app.get("/api/products/<int:product_id>")
def get_product(product_id):
    """Retrieve details for a single product."""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, title, description, price, image_url, images, category, stock, care_instructions, badge, created_at
                    FROM products WHERE id = %s
                    """,
                    (product_id,),
                )
                product = cur.fetchone()
        if not product:
            return jsonify({"error": "Product not found"}), 404
        return jsonify(serialize_product(product))
    except Exception as e:
        return jsonify({"error": f"Failed to retrieve product: {str(e)}"}), 500


@app.post("/api/orders")
def create_order():
    """
    Place an order:
    1. Validates cart items.
    2. Saves order and order_items in a single database transaction.
    3. Decrements inventory.
    4. Triggers Mailgun confirmation email.
    """
    data = request.get_json() or {}

    customer_name = (data.get("customer_name") or "").strip()
    customer_email = (data.get("customer_email") or "").strip()
    shipping_address = (data.get("shipping_address") or "").strip()
    items = data.get("items") or []
    user_id = data.get("user_id")  # Optional if logged in

    if not customer_name:
        return jsonify({"error": "Customer name is required."}), 400
    if not customer_email or "@" not in customer_email:
        return jsonify({"error": "A valid customer email is required."}), 400
    if not shipping_address:
        return jsonify({"error": "Shipping address is required."}), 400
    if not items or not isinstance(items, list):
        return jsonify({"error": "Your order must contain at least one item."}), 400

    # Calculate total amount
    total_amount = sum(float(item["price"]) * int(item["quantity"]) for item in items)

    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                # 1. Insert order record
                cur.execute(
                    """
                    INSERT INTO orders (user_id, customer_name, customer_email, shipping_address, total_amount, status)
                    VALUES (%s, %s, %s, %s, %s, 'confirmed')
                    RETURNING id, created_at;
                    """,
                    (user_id, customer_name, customer_email, shipping_address, total_amount),
                )
                order_row = cur.fetchone()
                order_id = order_row["id"]

                # 2. Insert item rows & update inventory
                for item in items:
                    cur.execute(
                        """
                        INSERT INTO order_items (order_id, product_id, title, price, quantity)
                        VALUES (%s, %s, %s, %s, %s);
                        """,
                        (order_id, item.get("id"), item["title"], item["price"], item["quantity"]),
                    )
                    # Decrement product stock
                    if item.get("id"):
                        cur.execute(
                            """
                            UPDATE products
                            SET stock = GREATEST(0, stock - %s)
                            WHERE id = %s;
                            """,
                            (item["quantity"], item["id"]),
                        )
            conn.commit()

        # 3. Dispatch confirmation email via Mailgun
        email_result = send_order_confirmation(
            to_email=customer_email,
            customer_name=customer_name,
            order_id=order_id,
            total_amount=total_amount,
            items=items,
            shipping_address=shipping_address,
        )

        email_status = "Sent" if email_result.get("sent") else (email_result.get("reason") or email_result.get("error") or "Pending")

        return jsonify(
            {
                "success": True,
                "order_id": order_id,
                "total_amount": round(total_amount, 2),
                "customer_email": customer_email,
                "email_sent": email_result.get("sent", False),
                "email_status": email_status,
            }
        ), 201

    except Exception as e:
        return jsonify({"error": f"Failed to place order: {str(e)}"}), 500


@app.get("/api/orders/<int:order_id>")
def get_order(order_id):
    """Retrieve details and item list for an order."""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, user_id, customer_name, customer_email, shipping_address,
                           total_amount::float AS total_amount, status, created_at
                    FROM orders WHERE id = %s;
                    """,
                    (order_id,),
                )
                order = cur.fetchone()

                if not order:
                    return jsonify({"error": "Order not found"}), 404

                cur.execute(
                    """
                    SELECT id, product_id, title, price::float AS price, quantity
                    FROM order_items WHERE order_id = %s;
                    """,
                    (order_id,),
                )
                items = cur.fetchall()

        return jsonify(
            {
                **order,
                "created_at": order["created_at"].isoformat() if order.get("created_at") else None,
                "items": items,
            }
        )
    except Exception as e:
        return jsonify({"error": f"Failed to fetch order: {str(e)}"}), 500


@app.get("/api/config")
def get_config():
    """Return public frontend configuration such as Google Client ID and Stripe Publishable Key."""
    return jsonify({
        "google_client_id": GOOGLE_CLIENT_ID,
        "stripe_publishable_key": STRIPE_PUBLISHABLE_KEY,
    })


@app.get("/api/cart")
def get_user_cart():
    """Retrieve database-backed cart for a user to sync across web and mobile."""
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT uc.product_id AS id, p.title, p.price::float AS price, p.image_url, p.category, p.stock, uc.quantity
                    FROM user_carts uc
                    JOIN products p ON uc.product_id = p.id
                    WHERE uc.user_id = %s;
                    """,
                    (user_id,),
                )
                items = cur.fetchall()
        return jsonify(items)
    except Exception as e:
        return jsonify({"error": f"Failed to fetch cart: {str(e)}"}), 500


@app.post("/api/cart")
def sync_user_cart():
    """Synchronize or update cart items for a user across devices."""
    data = request.get_json() or {}
    user_id = data.get("user_id")
    items = data.get("items") or []

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                # Replace existing user cart
                cur.execute("DELETE FROM user_carts WHERE user_id = %s;", (user_id,))
                for item in items:
                    product_id = item.get("id")
                    quantity = int(item.get("quantity", 1))
                    if product_id:
                        cur.execute(
                            """
                            INSERT INTO user_carts (user_id, product_id, quantity)
                            VALUES (%s, %s, %s)
                            ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;
                            """,
                            (user_id, product_id, quantity),
                        )
            conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": f"Failed to sync cart: {str(e)}"}), 500


@app.post("/api/stripe/create-checkout-session")
def create_stripe_checkout_session():
    """
    Creates a Stripe Checkout Session supporting Cards, Apple Pay, and Google Pay.
    Accepts items, customer details, and redirect URLs.
    """
    if not STRIPE_SECRET_KEY:
        return jsonify({"error": "Stripe secret key is not configured in backend/.env"}), 500

    data = request.get_json() or {}
    items = data.get("items") or []
    customer_email = (data.get("customer_email") or "").strip()
    customer_name = (data.get("customer_name") or "").strip()
    shipping_address = (data.get("shipping_address") or "").strip()
    user_id = data.get("user_id")

    if not items:
        return jsonify({"error": "Cart is empty"}), 400

    # Build line items for Stripe (convert price to pence / cents)
    line_items = []
    for item in items:
        unit_amount = int(round(float(item["price"]) * 100))
        product_data = {"name": item["title"]}
        if item.get("image_url"):
            # Stripe requires absolute http/https URLs for images
            img = item["image_url"]
            if img.startswith("http://") or img.startswith("https://"):
                product_data["images"] = [img]

        line_items.append(
            {
                "price_data": {
                    "currency": "gbp",  # UK Pounds Sterling (supports Apple Pay)
                    "product_data": product_data,
                    "unit_amount": unit_amount,
                },
                "quantity": int(item.get("quantity", 1)),
            }
        )

    # Origin for redirect
    origin = request.headers.get("Origin") or request.host_url.rstrip("/")

    try:
        session = stripe.checkout.Session.create(
            line_items=line_items,
            mode="payment",
            customer_email=customer_email or None,
            success_url=f"{origin}/?session_id={{CHECKOUT_SESSION_ID}}&status=success",
            cancel_url=f"{origin}/?status=cancelled",
            metadata={
                "customer_name": customer_name,
                "customer_email": customer_email,
                "shipping_address": shipping_address,
                "user_id": str(user_id) if user_id else "",
            },
        )
        return jsonify({"url": session.url, "id": session.id})
    except Exception as e:
        print(f"[Stripe] Error creating checkout session: {e}")
        return jsonify({"error": f"Failed to create Stripe session: {str(e)}"}), 500


@app.post("/api/stripe/verify-session")
def verify_stripe_session():
    """
    Verifies a completed Stripe Checkout session, saves the order in Supabase,
    and sends the Mailgun confirmation receipt.
    """
    if not STRIPE_SECRET_KEY:
        return jsonify({"error": "Stripe secret key missing"}), 500

    data = request.get_json() or {}
    session_id = data.get("session_id")

    if not session_id:
        return jsonify({"error": "session_id is required"}), 400

    try:
        session = stripe.checkout.Session.retrieve(session_id, expand=["line_items"])

        if session.payment_status != "paid":
            return jsonify({"error": "Payment has not been completed yet."}), 400

        # Check if order already recorded for this session (idempotency)
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, total_amount, customer_email FROM orders WHERE stripe_session_id = %s;",
                    (session_id,),
                )
                existing = cur.fetchone()

        if existing:
            return jsonify({
                "success": True,
                "order_id": existing["id"],
                "total_amount": float(existing["total_amount"]),
                "customer_email": existing["customer_email"],
                "already_recorded": True,
            })

        # Convert session to standard dict for reliable property access in Stripe Python v16
        session_dict = session.to_dict() if hasattr(session, "to_dict") else dict(session)
        meta = session_dict.get("metadata") or {}
        customer_details = session_dict.get("customer_details") or {}

        customer_name = meta.get("customer_name") or customer_details.get("name") or "Customer"
        customer_email = meta.get("customer_email") or customer_details.get("email") or session_dict.get("customer_email") or ""
        shipping_address = meta.get("shipping_address") or "Standard Delivery"
        user_id = int(meta["user_id"]) if meta.get("user_id") else None

        total_amount = float(session_dict.get("amount_total") or 0) / 100.0

        # Extract line items
        line_items_obj = session_dict.get("line_items") or {}
        line_items_data = line_items_obj.get("data") if isinstance(line_items_obj, dict) else (session.line_items.data if hasattr(session, "line_items") and session.line_items else [])
        items = []
        for li in line_items_data:
            li_dict = li if isinstance(li, dict) else (li.to_dict() if hasattr(li, "to_dict") else {})
            price_obj = li_dict.get("price") or {}
            items.append({
                "id": None,
                "title": li_dict.get("description") or "Crochet Item",
                "price": float(price_obj.get("unit_amount") or 0) / 100.0,
                "quantity": li_dict.get("quantity") or 1,
            })

        # Save order into Supabase
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO orders (user_id, customer_name, customer_email, shipping_address, total_amount, status, stripe_session_id)
                    VALUES (%s, %s, %s, %s, %s, 'paid', %s)
                    RETURNING id, created_at;
                    """,
                    (user_id, customer_name, customer_email, shipping_address, total_amount, session_id),
                )
                order_row = cur.fetchone()
                order_id = order_row["id"]

                for item in items:
                    cur.execute(
                        """
                        INSERT INTO order_items (order_id, product_id, title, price, quantity)
                        VALUES (%s, %s, %s, %s, %s);
                        """,
                        (order_id, item.get("id"), item["title"], item["price"], item["quantity"]),
                    )

            conn.commit()

        # Dispatch Mailgun email receipt
        email_result = send_order_confirmation(
            to_email=customer_email,
            customer_name=customer_name,
            order_id=order_id,
            total_amount=total_amount,
            items=items,
            shipping_address=shipping_address,
        )

        email_status = "Sent" if email_result.get("sent") else (email_result.get("reason") or email_result.get("error") or "Pending")

        return jsonify({
            "success": True,
            "order_id": order_id,
            "total_amount": round(total_amount, 2),
            "customer_email": customer_email,
            "email_sent": email_result.get("sent", False),
            "email_status": email_status,
        }), 201

    except Exception as e:
        print(f"[Stripe] Error verifying session: {e}")
        return jsonify({"error": f"Failed to verify payment session: {str(e)}"}), 500


@app.post("/api/auth/google")
def auth_google():
    """
    Verify Google OAuth credential or direct email login,
    and persist/retrieve user in Supabase.
    """
    data = request.get_json() or {}
    credential = (data.get("credential") or "").strip()
    name_input = (data.get("name") or "").strip()

    if not credential:
        return jsonify({"error": "Google credential token or email is required."}), 400

    email = ""
    google_id = None
    name = name_input
    avatar_url = ""

    # Check if credential is a valid Google JWT or direct email
    if "@" in credential and "." in credential and len(credential.split(".")) != 3:
        # Direct email login
        email = credential.lower()
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id, google_id, email, name, avatar_url FROM users WHERE email = %s;", (email,))
                existing_user = cur.fetchone()
                if existing_user:
                    return jsonify({
                        "success": True,
                        "user": {
                            "id": existing_user["id"],
                            "email": existing_user["email"],
                            "name": existing_user["name"] or "Odofin Moronke",
                            "avatar_url": existing_user["avatar_url"] or "",
                        }
                    })
        # If not found, create user
        name = name_input or email.split("@")[0].capitalize()
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO users (email, name)
                    VALUES (%s, %s)
                    RETURNING id, google_id, email, name, avatar_url;
                    """,
                    (email, name),
                )
                user = cur.fetchone()
            conn.commit()
        return jsonify({
            "success": True,
            "user": {
                "id": user["id"],
                "email": user["email"],
                "name": user["name"],
                "avatar_url": user["avatar_url"] or "",
            }
        })
    else:
        try:
            idinfo = id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                GOOGLE_CLIENT_ID or None,
                clock_skew_in_seconds=60,
            )
            google_id = idinfo.get("sub")
            email = idinfo.get("email")
            name = idinfo.get("name", name or "")
            avatar_url = idinfo.get("picture", "")
        except Exception as e:
            print(f"[Auth] Google verification error: {e}")
            return jsonify({"error": f"Invalid Google authentication token: {str(e)}"}), 401

    if not email:
        return jsonify({"error": "Email not provided."}), 400

    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO users (google_id, email, name, avatar_url)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (email) DO UPDATE
                    SET google_id = COALESCE(EXCLUDED.google_id, users.google_id),
                        name = CASE 
                            WHEN users.name IS NOT NULL AND users.name != '' AND users.name != split_part(users.email, '@', 1) 
                            THEN users.name 
                            ELSE COALESCE(NULLIF(EXCLUDED.name, ''), users.name)
                        END,
                        avatar_url = COALESCE(NULLIF(EXCLUDED.avatar_url, ''), users.avatar_url)
                    RETURNING id, google_id, email, name, avatar_url;
                    """,
                    (google_id, email, name, avatar_url),
                )
                user = cur.fetchone()
            conn.commit()

        return jsonify(
            {
                "success": True,
                "user": {
                    "id": user["id"],
                    "email": user["email"],
                    "name": user["name"],
                    "avatar_url": user["avatar_url"],
                },
            }
        )
    except Exception as e:
        print(f"[Auth DB Error]: {e}")
        return jsonify({"error": f"Database user sync failed: {str(e)}"}), 500


@app.get("/api/orders/my-orders")
def get_my_orders():
    """Fetch orders for a specific user."""
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id parameter is required."}), 400

    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, customer_name, customer_email, shipping_address,
                           total_amount::float AS total_amount, status, created_at
                    FROM orders
                    WHERE user_id = %s
                    ORDER BY id DESC;
                    """,
                    (user_id,),
                )
                orders = cur.fetchall()

        return jsonify(
            [
                {
                    **o,
                    "created_at": o["created_at"].isoformat() if o.get("created_at") else None,
                }
                for o in orders
            ]
        )
    except Exception as e:
        return jsonify({"error": f"Failed to fetch user orders: {str(e)}"}), 500


# ==========================================
# SELLER ADMIN & FILE UPLOADS
# ==========================================


@app.post("/api/admin/upload")
def upload_image():
    """Handle direct image uploads from seller."""
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    ext = Path(file.filename).suffix.lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
        return jsonify({"error": "Only image files (.jpg, .png, .webp, .gif) are supported"}), 400

    unique_filename = f"{uuid.uuid4().hex}{ext}"
    file_path = UPLOADS_DIR / unique_filename
    file.save(file_path)

    return jsonify({"url": f"/uploads/{unique_filename}"}), 201


@app.get("/uploads/<path:filename>")
def serve_upload(filename):
    """Serve uploaded product photos."""
    return send_from_directory(UPLOADS_DIR, filename)


@app.post("/api/admin/products")
def create_product():
    """Create a new product in catalog."""
    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    price = data.get("price") or 0.0
    category = (data.get("category") or "Cardigans").strip()
    stock = int(data.get("stock") or 1)
    images = data.get("images") or []
    image_url = images[0] if images else (data.get("image_url") or "").strip()
    badge = (data.get("badge") or "").strip()
    care_instructions = (data.get("care_instructions") or "").strip()

    if not title:
        return jsonify({"error": "Title is required"}), 400

    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO products (title, description, price, image_url, images, category, stock, badge, care_instructions)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, title, description, price, image_url, images, category, stock, badge, care_instructions, created_at;
                    """,
                    (title, description, price, image_url, images, category, stock, badge, care_instructions),
                )
                new_product = cur.fetchone()
            conn.commit()

        return jsonify(serialize_product(new_product)), 201
    except Exception as e:
        return jsonify({"error": f"Failed to create product: {str(e)}"}), 500


@app.put("/api/admin/products/<int:product_id>")
def update_product(product_id):
    """Update an existing product."""
    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    price = data.get("price") or 0.0
    category = (data.get("category") or "Cardigans").strip()
    stock = int(data.get("stock") or 0)
    images = data.get("images") or []
    image_url = images[0] if images else (data.get("image_url") or "").strip()
    badge = (data.get("badge") or "").strip()
    care_instructions = (data.get("care_instructions") or "").strip()

    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE products
                    SET title = %s, description = %s, price = %s, image_url = %s, images = %s,
                        category = %s, stock = %s, badge = %s, care_instructions = %s
                    WHERE id = %s
                    RETURNING id, title, description, price, image_url, images, category, stock, badge, care_instructions, created_at;
                    """,
                    (title, description, price, image_url, images, category, stock, badge, care_instructions, product_id),
                )
                updated = cur.fetchone()
            conn.commit()

        if not updated:
            return jsonify({"error": "Product not found"}), 404
        return jsonify(serialize_product(updated))
    except Exception as e:
        return jsonify({"error": f"Failed to update product: {str(e)}"}), 500


@app.delete("/api/admin/products/<int:product_id>")
def delete_product(product_id):
    """Remove a product from catalog."""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM products WHERE id = %s;", (product_id,))
            conn.commit()
        return jsonify({"success": True, "message": "Product deleted successfully"})
    except Exception as e:
        return jsonify({"error": f"Failed to delete product: {str(e)}"}), 500


@app.get("/api/admin/orders")
def get_admin_orders():
    """Retrieve all orders with items for seller management."""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, user_id, customer_name, customer_email, shipping_address,
                           total_amount::float AS total_amount, status, tracking_number, created_at
                    FROM orders
                    ORDER BY id DESC;
                    """
                )
                orders = cur.fetchall()

                # Fetch all order items
                cur.execute(
                    """
                    SELECT id, order_id, product_id, title, price::float AS price, quantity
                    FROM order_items;
                    """
                )
                items = cur.fetchall()

        items_by_order = {}
        for item in items:
            items_by_order.setdefault(item["order_id"], []).append(item)

        results = []
        for o in orders:
            results.append(
                {
                    **o,
                    "created_at": o["created_at"].isoformat() if o.get("created_at") else None,
                    "items": items_by_order.get(o["id"], []),
                }
            )

        return jsonify(results)
    except Exception as e:
        return jsonify({"error": f"Failed to retrieve orders: {str(e)}"}), 500


@app.patch("/api/admin/orders/<int:order_id>")
def update_order_status(order_id):
    """Update order production/fulfillment status and tracking number."""
    data = request.get_json() or {}
    status = (data.get("status") or "").strip()
    tracking_number = (data.get("tracking_number") or "").strip()

    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE orders
                    SET status = COALESCE(NULLIF(%s, ''), status),
                        tracking_number = COALESCE(NULLIF(%s, ''), tracking_number)
                    WHERE id = %s
                    RETURNING id, status, tracking_number;
                    """,
                    (status, tracking_number, order_id),
                )
                order = cur.fetchone()
            conn.commit()

        if not order:
            return jsonify({"error": "Order not found"}), 404
        return jsonify({"success": True, "order": order})
    except Exception as e:
        return jsonify({"error": f"Failed to update order: {str(e)}"}), 500


# ==========================================
# FRONTEND STATIC SERVING
# ==========================================


@app.get("/")
def serve_index():
    index = DIST_DIR / "index.html"
    if index.exists():
        return send_from_directory(DIST_DIR, "index.html")
    return jsonify(
        {
            "message": "Shop API is running. Products available at /api/products.",
            "frontend_dev_server": "http://localhost:5173",
        }
    )


@app.get("/<path:path>")
def serve_frontend(path):
    file_path = DIST_DIR / path
    if file_path.is_file():
        return send_from_directory(DIST_DIR, path)
    index = DIST_DIR / "index.html"
    if index.exists():
        return send_from_directory(DIST_DIR, "index.html")
    return jsonify({"error": "Not found"}), 404


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, port=port)
