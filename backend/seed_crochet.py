import sys
from pathlib import Path

# Add backend directory to path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

import app

crochet_items = [
    {
        "title": "Granny Square Boho Cardigan",
        "description": "Handcrafted vintage-inspired multicolor granny square cardigan with balloon sleeves and ribbed cuffs. Lightweight yet cozy.",
        "price": 115.00,
        "image_url": "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800",
        "images": [
            "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800",
            "https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=800",
            "https://images.unsplash.com/photo-1544441893-675973e31985?w=800",
        ],
        "category": "Cardigans",
        "stock": 2,
        "badge": "Handmade Favorite",
        "care_instructions": "100% Milk Cotton Yarn. Hand wash cold with gentle detergent, lay flat on towel to dry. Never machine dry.",
    },
    {
        "title": "Pastel Daisy Bucket Hat",
        "description": "Adorably retro crocheted bucket hat featuring handmade daisy squares in soft pastel tones. Breathable for sunny festivals and daily wear.",
        "price": 38.00,
        "image_url": "https://images.unsplash.com/photo-1576871337622-98d48d1cf531?w=800",
        "images": [
            "https://images.unsplash.com/photo-1576871337622-98d48d1cf531?w=800",
            "https://images.unsplash.com/photo-1521369909029-2afed882baee?w=800",
        ],
        "category": "Hats & Beanies",
        "stock": 3,
        "badge": "Summer Essential",
        "care_instructions": "Soft Cotton & Acrylic blend. Spot clean with cool water or gentle hand wash.",
    },
    {
        "title": "Handcrafted Crochet Crossbody Tote",
        "description": "Sturdy crochet shoulder bag with intricate macrame lace borders and reinforced shoulder strap. Perfect for farmers market or weekend strolls.",
        "price": 48.00,
        "image_url": "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800",
        "images": [
            "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800",
            "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800",
        ],
        "category": "Bags",
        "stock": 1,
        "badge": "Only 1 Made",
        "care_instructions": "Heavy-gauge 100% organic cotton cord. Spot clean only.",
    },
    {
        "title": "Vintage Lace Crochet Crop Top",
        "description": "Delicate halter-style crochet crop top with scalloped edging and adjustable lace-up back tie for an effortless custom fit.",
        "price": 55.00,
        "image_url": "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800",
        "images": [
            "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800",
            "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800",
        ],
        "category": "Tops",
        "stock": 2,
        "badge": "Made to Order",
        "care_instructions": "Bamboo and cotton blend yarn. Hand wash cold, lay flat to dry.",
    },
    {
        "title": "Chunky Waffle Knit Infinity Scarf",
        "description": "Oversized, extra-plush crochet scarf worked in a textured waffle stitch. Wraps twice for ultimate warmth in chilly autumn weather.",
        "price": 44.00,
        "image_url": "https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=800",
        "images": [
            "https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=800",
        ],
        "category": "Accessories",
        "stock": 4,
        "badge": "Cozy Collection",
        "care_instructions": "Wool and premium acrylic blend. Hand wash cold, do not bleach.",
    },
]

def seed():
    with app.get_db() as conn:
        with conn.cursor() as cur:
            # Clear old dummy products
            cur.execute("DELETE FROM products WHERE category IN ('Electronics', 'Clothing', 'General');")
            # Insert crochet products
            for item in crochet_items:
                cur.execute(
                    """
                    INSERT INTO products (title, description, price, image_url, images, category, stock, badge, care_instructions)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
                    """,
                    (
                        item["title"],
                        item["description"],
                        item["price"],
                        item["image_url"],
                        item["images"],
                        item["category"],
                        item["stock"],
                        item["badge"],
                        item["care_instructions"],
                    ),
                )
            conn.commit()
    print("SUCCESS: Seeded crochet items into Supabase!")

if __name__ == "__main__":
    seed()
