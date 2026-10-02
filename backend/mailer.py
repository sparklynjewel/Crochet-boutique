import os
from pathlib import Path
from dotenv import load_dotenv
import requests

# Ensure .env is loaded
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")


def send_order_confirmation(to_email, customer_name, order_id, total_amount, items, shipping_address):
    """
    Sends an order confirmation receipt using the Mailgun REST API.
    Returns a dict with status and message.
    """
    api_key = os.environ.get("MAILGUN_API_KEY", "").strip()
    domain = os.environ.get("MAILGUN_DOMAIN", "").strip()

    if not api_key or not domain or api_key == "your_actual_mailgun_api_key_here":
        print("[Mailer] Mailgun credentials not fully configured in .env. Order processed without email dispatch.")
        return {
            "sent": False,
            "reason": "Mailgun credentials missing or placeholder in .env",
        }

    # Build HTML receipt table for purchased items
    items_html = ""
    for item in items:
        subtotal = float(item["price"]) * int(item["quantity"])
        items_html += f"""
        <tr>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">{item['title']}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">{item['quantity']}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${float(item['price']):.2f}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${subtotal:.2f}</td>
        </tr>
        """

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Order Confirmation #{order_id}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px; color: #111827;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; overflow: hidden;">
            <div style="background-color: #0f172a; padding: 24px; text-align: center; color: #ffffff;">
                <h1 style="margin: 0; font-size: 24px; letter-spacing: -0.5px;">ShopSphere</h1>
                <p style="margin: 6px 0 0; font-size: 14px; color: #94a3b8;">Order Confirmation #{order_id}</p>
            </div>
            
            <div style="padding: 24px;">
                <p style="font-size: 16px;">Hi <strong>{customer_name}</strong>,</p>
                <p style="font-size: 14px; color: #4b5563;">Thank you for your purchase! We have received your order and are preparing it for shipment.</p>
                
                <h3 style="margin-top: 24px; font-size: 15px; border-bottom: 2px solid #f3f4f6; padding-bottom: 8px;">Order Details</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 12px;">
                    <thead>
                        <tr style="background: #f8fafc; color: #64748b; text-align: left;">
                            <th style="padding: 8px 12px;">Item</th>
                            <th style="padding: 8px 12px; text-align: center;">Qty</th>
                            <th style="padding: 8px 12px; text-align: right;">Price</th>
                            <th style="padding: 8px 12px; text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items_html}
                    </tbody>
                </table>
                
                <div style="margin-top: 16px; text-align: right;">
                    <p style="font-size: 18px; font-weight: bold; margin: 0;">Total Paid: ${float(total_amount):.2f}</p>
                </div>
                
                <div style="margin-top: 24px; background: #f8fafc; padding: 16px; border-radius: 6px;">
                    <h4 style="margin: 0 0 6px; font-size: 13px; color: #64748b; text-transform: uppercase;">Shipping To:</h4>
                    <p style="margin: 0; font-size: 14px; color: #1e293b; white-space: pre-line;">{shipping_address}</p>
                </div>
            </div>
            
            <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0;">If you have any questions, reply directly to this email.</p>
                <p style="margin: 4px 0 0;">© 2026 ShopSphere. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """

    api_url = f"https://api.mailgun.net/v3/{domain}/messages"

    try:
        response = requests.post(
            api_url,
            auth=("api", api_key),
            data={
                "from": f"ShopSphere Orders <postmaster@{domain}>",
                "to": [to_email],
                "subject": f"Order Confirmation #{order_id} - ShopSphere",
                "html": html_content,
            },
            timeout=10,
        )

        if response.status_code == 200:
            print(f"[Mailer] Successfully sent confirmation email to {to_email}")
            return {"sent": True, "id": response.json().get("id")}
        else:
            print(f"[Mailer] Mailgun returned error ({response.status_code}): {response.text}")
            return {
                "sent": False,
                "error": response.text,
                "status_code": response.status_code,
            }
    except Exception as e:
        print(f"[Mailer] Exception during Mailgun dispatch: {e}")
        return {"sent": False, "error": str(e)}
