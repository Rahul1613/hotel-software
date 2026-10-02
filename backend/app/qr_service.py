import os
import io
import qrcode
from PIL import Image, ImageDraw, ImageFont

def generate_table_qr_image(table_number: str, token: str, base_url: str = "http://localhost:3000") -> bytes:
    """
    Generates a high-resolution branded QR code image for a table stand with the actual Ekdant logo.
    Target URL: e.g. http://localhost:3000/menu?table=05&token=...
    """
    qr_url = f"{base_url}/menu?table={table_number}&token={token}"
    
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(qr_url)
    qr.make(fit=True)
    
    # Fill color Deep Maroon: #641C24, back Warm Ivory: #FFF9F0
    img = qr.make_image(fill_color="#641C24", back_color="#FFF9F0").convert("RGB")
    
    # Add branded header and table caption
    width, height = img.size
    header_height = 80
    footer_height = 60
    canvas_height = height + header_height + footer_height
    canvas = Image.new("RGB", (width, canvas_height), color="#FFF9F0")
    
    draw = ImageDraw.Draw(canvas)
    
    # Header area: paste actual logo image if available
    logo_path = os.path.join(os.path.dirname(__file__), "static", "ekdant_logo.png")
    if os.path.exists(logo_path):
        try:
            logo_img = Image.open(logo_path).convert("RGBA")
            # Resize keeping aspect ratio
            target_w = int(width * 0.8)
            ratio = target_w / float(logo_img.width)
            target_h = int(float(logo_img.height) * ratio)
            if target_h > header_height - 10:
                target_h = header_height - 10
                ratio = target_h / float(logo_img.height)
                target_w = int(float(logo_img.width) * ratio)
            
            logo_resized = logo_img.resize((target_w, target_h), Image.Resampling.LANCZOS)
            paste_x = (width - target_w) // 2
            paste_y = (header_height - target_h) // 2
            canvas.paste(logo_resized, (paste_x, paste_y), logo_resized)
        except Exception:
            draw.rectangle([(0, 0), (width, header_height)], fill="#641C24")
            draw.text((width // 2, header_height // 2), "HOTEL EKDANT", fill="#C49A52", anchor="mm")
    else:
        draw.rectangle([(0, 0), (width, header_height)], fill="#641C24")
        draw.text((width // 2, header_height // 2), "HOTEL EKDANT", fill="#C49A52", anchor="mm")
    
    # Paste QR in middle
    canvas.paste(img, (0, header_height))
    
    # Bottom Table info
    draw.rectangle([(0, canvas_height - footer_height), (width, canvas_height)], fill="#852D34")
    draw.text((width // 2, canvas_height - 40), f"TABLE {table_number}", fill="#FFF9F0", anchor="mm")
    draw.text((width // 2, canvas_height - 18), "Scan to View Menu & Order", fill="#C49A52", anchor="mm")
    
    buf = io.BytesIO()
    canvas.save(buf, format="PNG")
    return buf.getvalue()
