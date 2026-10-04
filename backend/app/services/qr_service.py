import os
import qrcode
from PIL import Image, ImageDraw, ImageFont
import io

def generate_table_qr_image(table_number: str, qr_token: str, base_url: str = None) -> bytes:
    """
    Generate branded QR Code pointing to /?t=<qr_token>.
    """
    if not base_url:
        base_url = "https://hotel-ekdant.onrender.com"
    base_url = base_url.rstrip('/')
    
    # Secure token URL format
    qr_data = f"{base_url}/?t={qr_token}"

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(qr_data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="#641C24", back_color="#FFF9F0").convert('RGBA')

    # Add center badge
    img_w, img_h = img.size
    logo_size = int(img_w * 0.22)
    logo_box = (
        (img_w - logo_size) // 2,
        (img_h - logo_size) // 2,
        (img_w + logo_size) // 2,
        (img_h + logo_size) // 2
    )

    draw = ImageDraw.Draw(img)
    # Draw circle or rounded box for logo
    draw.ellipse(logo_box, fill="#FFF9F0", outline="#C49A52", width=3)
    
    # Draw "EKDANT" text inside
    font = ImageFont.load_default()
    draw.text((img_w // 2 - 18, img_h // 2 - 5), "EKDANT", fill="#641C24", font=font)

    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()
