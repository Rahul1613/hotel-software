import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import io
import base64
import qrcode
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from app.models import SessionLocal, RestaurantTable, Restaurant

def generate_qr_base64(table_number: str, base_url: str = "") -> str:
    """Generates a high-contrast QR code image as base64 string."""
    qr_url = f"{base_url}/menu?table={table_number}" if base_url else f"/menu?table={table_number}"
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data(qr_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#641C24", back_color="#FFFFFF").convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode('utf-8')

def generate_html_stands(tables, restaurant, base_url: str = "") -> str:
    """Generates a complete self-contained printable HTML page for all 11 tables."""
    cards_html = ""
    
    logo_path = os.path.join(os.path.dirname(__file__), "static", "ekdant_logo.png")
    logo_src = ""
    if os.path.exists(logo_path):
        with open(logo_path, "rb") as lf:
            logo_src = f"data:image/png;base64,{base64.b64encode(lf.read()).decode('utf-8')}"

    # We pair tables 2 per page
    for i, t in enumerate(tables):
        qr_b64 = generate_qr_base64(t.table_number, base_url)
        section_label = "AC DINING HALL" if t.section == "AC" else "NON-AC FAMILY HALL"
        section_color = "#258451" if t.section == "AC" else "#852D34"
        section_bg = "#E8F5E9" if t.section == "AC" else "#FFEBEE"
        
        cards_html += f"""
        <div class="qr-card">
          <div class="card-inner">
            <div class="card-header">
              <div class="devotional-text">॥ श्री गणेशाय नमः ॥</div>
              {'<img src="' + logo_src + '" alt="Hotel Ekdant" class="logo-img" />' if logo_src else ''}
              <div class="hotel-title">HOTEL EKDANT</div>
              <div class="hotel-sub">FAMILY RESTAURANT & DINING</div>
            </div>

            <div class="table-badge-wrap">
              <div class="table-number">TABLE {t.table_number}</div>
              <div class="table-section" style="color: {section_color}; background-color: {section_bg}; border-color: {section_color};">
                {section_label} • Capacity: {t.capacity} Guests
              </div>
            </div>

            <div class="qr-box">
              <img src="data:image/png;base64,{qr_b64}" alt="QR Table {t.table_number}" class="qr-img" />
              <div class="scan-pill">
                <span>📱 Scan with Camera / Google Lens</span>
              </div>
            </div>

            <div class="instructions">
              <div class="step-item"><b>1.</b> Scan QR Code</div>
              <div class="step-item"><b>2.</b> View Digital Menu</div>
              <div class="step-item"><b>3.</b> Order & Dine</div>
            </div>

            <div class="card-footer">
              <div><b>Near Shree Ganesh Mandir, Kolhapur Road</b></div>
              <div>Ph: {restaurant.phone if restaurant else '+91 98234 56789'} • Pay at Counter</div>
            </div>
          </div>
        </div>
        """
        # Add a cut/page divider if needed
        if (i + 1) % 2 == 0 and (i + 1) < len(tables):
            cards_html += '<div class="page-break"></div>'

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Hotel Ekdant - All Table QR Stands (Printable)</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    
    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }}

    body {{
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: #EFE8DC;
      color: #282321;
      padding: 20px;
    }}

    /* Top Control Bar */
    .top-controls {{
      max-width: 900px;
      margin: 0 auto 25px auto;
      background: #FFFFFF;
      padding: 16px 24px;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border: 1px solid #C49A52;
    }}

    .controls-title {{
      font-family: 'Cinzel', serif;
      font-size: 16px;
      font-weight: 800;
      color: #641C24;
    }}

    .controls-desc {{
      font-size: 11px;
      color: #666;
    }}

    .btn-print {{
      background: #641C24;
      color: #FFF9F0;
      border: none;
      padding: 10px 22px;
      font-size: 13px;
      font-weight: 700;
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(100, 28, 36, 0.3);
      transition: background 0.2s;
    }}

    .btn-print:hover {{
      background: #852D34;
    }}

    /* Sheet layout (2 cards per A4 page) */
    .sheet-container {{
      max-width: 900px;
      margin: 0 auto;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 20px;
    }}

    .qr-card {{
      width: 420px;
      height: 590px;
      background: #FFFDF7;
      border: 3px solid #641C24;
      border-radius: 20px;
      padding: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.08);
      position: relative;
      page-break-inside: avoid;
    }}

    .card-inner {{
      width: 100%;
      height: 100%;
      border: 2px solid #C49A52;
      border-radius: 14px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      text-align: center;
      background: linear-gradient(180deg, #FFFDF7 0%, #FFF9F0 100%);
    }}

    .card-header {{
      width: 100%;
    }}

    .devotional-text {{
      font-size: 11px;
      font-weight: 700;
      color: #C49A52;
      letter-spacing: 2px;
      margin-bottom: 4px;
    }}

    .logo-img {{
      height: 48px;
      max-width: 180px;
      object-fit: contain;
      margin: 0 auto 4px auto;
      display: block;
    }}

    .hotel-title {{
      font-family: 'Cinzel', serif;
      font-size: 20px;
      font-weight: 900;
      color: #641C24;
      letter-spacing: 1.5px;
      line-height: 1.1;
    }}

    .hotel-sub {{
      font-size: 9px;
      font-weight: 700;
      color: #C49A52;
      letter-spacing: 2px;
      margin-top: 2px;
    }}

    .table-badge-wrap {{
      margin: 6px 0;
    }}

    .table-number {{
      font-family: 'Cinzel', serif;
      font-size: 28px;
      font-weight: 900;
      color: #641C24;
      background: #FFF9F0;
      border: 2px solid #C49A52;
      display: inline-block;
      padding: 4px 24px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(100,28,36,0.1);
    }}

    .table-section {{
      font-size: 10px;
      font-weight: 800;
      border: 1px solid;
      display: inline-block;
      padding: 3px 12px;
      border-radius: 20px;
      margin-top: 5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }}

    .qr-box {{
      background: #FFFFFF;
      padding: 10px;
      border-radius: 14px;
      border: 2px solid #C49A52;
      box-shadow: 0 4px 12px rgba(0,0,0,0.06);
      display: flex;
      flex-direction: column;
      align-items: center;
    }}

    .qr-img {{
      width: 160px;
      height: 160px;
      display: block;
    }}

    .scan-pill {{
      background: #641C24;
      color: #FFF9F0;
      font-size: 10px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 8px;
      margin-top: 8px;
    }}

    .instructions {{
      display: flex;
      gap: 12px;
      font-size: 10px;
      color: #555;
      background: #FFF9F0;
      border: 1px dashed #C49A52;
      padding: 6px 14px;
      border-radius: 10px;
    }}

    .step-item b {{
      color: #641C24;
    }}

    .card-footer {{
      font-size: 9px;
      color: #666;
      line-height: 1.3;
      border-top: 1px solid #EADDC9;
      padding-top: 6px;
      width: 100%;
    }}

    .page-break {{
      width: 100%;
      height: 0;
      page-break-after: always;
      break-after: page;
    }}

    /* Print Specific Rules */
    @media print {{
      body {{
        background: #FFFFFF !important;
        padding: 0 !important;
      }}
      .no-print {{
        display: none !important;
      }}
      .sheet-container {{
        max-width: 100% !important;
        gap: 0 !important;
      }}
      .qr-card {{
        width: 48% !important;
        height: 138mm !important;
        margin: 5mm 1% !important;
        box-shadow: none !important;
        border: 2px solid #641C24 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }}
      .page-break {{
        display: block !important;
        page-break-after: always !important;
        break-after: page !important;
      }}
    }}
  </style>
</head>
<body>

  <div class="top-controls no-print">
    <div>
      <div class="controls-title">HOTEL EKDANT — ALL 11 TABLE QR STANDS</div>
      <div class="controls-desc">Ready to print on A4 cardstock / paper. Each sheet fits 2 standard acrylic table stands (Tables 01 to 11).</div>
    </div>
    <div style="display: flex; gap: 10px; align-items: center;">
      <button onclick="window.print()" class="btn-print">
        <span>🖨️ Print All Table Stands (Ctrl+P)</span>
      </button>
    </div>
  </div>

  <div class="sheet-container">
    {cards_html}
  </div>

</body>
</html>"""
    return html

def generate_pdf_stands(tables, restaurant, output_pdf_path: str, base_url: str = ""):
    """Generates an A4 PDF document containing all 11 table stands (2 per page)."""
    doc = SimpleDocTemplate(
        output_pdf_path,
        pagesize=A4,
        leftMargin=20,
        rightMargin=20,
        topMargin=20,
        bottomMargin=20
    )
    
    story = []
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'CardTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=14,
        textColor=colors.HexColor('#641C24'),
        alignment=1,
        spaceAfter=2
    )
    
    sub_style = ParagraphStyle(
        'CardSub',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        textColor=colors.HexColor('#C49A52'),
        alignment=1,
        spaceAfter=4
    )
    
    tbl_style = ParagraphStyle(
        'CardTbl',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        textColor=colors.HexColor('#641C24'),
        alignment=1,
        spaceAfter=2
    )
    
    tag_style = ParagraphStyle(
        'CardTag',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        textColor=colors.HexColor('#258451'),
        alignment=1,
        spaceAfter=4
    )
    
    footer_style = ParagraphStyle(
        'CardFooter',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7,
        textColor=colors.HexColor('#555555'),
        alignment=1
    )
    
    logo_path = os.path.join(os.path.dirname(__file__), "static", "ekdant_logo.png")

    for i in range(0, len(tables), 2):
        pair = tables[i:i+2]
        pair_cells = []
        
        for t in pair:
            card_flowables = []
            if os.path.exists(logo_path):
                card_flowables.append(RLImage(logo_path, width=120, height=33))
                card_flowables.append(Spacer(1, 2))
            
            card_flowables.append(Paragraph("HOTEL EKDANT", title_style))
            card_flowables.append(Paragraph("FAMILY RESTAURANT & DINING", sub_style))
            card_flowables.append(Spacer(1, 4))
            
            card_flowables.append(Paragraph(f"TABLE {t.table_number}", tbl_style))
            sec_txt = f"{'AC DINING HALL' if t.section == 'AC' else 'NON-AC FAMILY HALL'} (Seats {t.capacity})"
            card_flowables.append(Paragraph(sec_txt, tag_style))
            card_flowables.append(Spacer(1, 4))
            
            # QR code image
            qr_bytes = io.BytesIO(base64.b64decode(generate_qr_base64(t.table_number, base_url)))
            card_flowables.append(RLImage(qr_bytes, width=150, height=150))
            card_flowables.append(Spacer(1, 4))
            
            card_flowables.append(Paragraph("<b>Scan with Mobile Camera / Google Lens</b><br/>Browse Digital Menu & Place Order", sub_style))
            card_flowables.append(Spacer(1, 6))
            card_flowables.append(Paragraph("Near Shree Ganesh Mandir, Kolhapur Road • Ph: +91 98234 56789<br/>Pure Maharashtrian & Family Hospitality", footer_style))
            
            t_cell = Table([[item] for item in card_flowables], colWidths=[260])
            t_cell.setStyle(TableStyle([
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('BOX', (0,0), (-1,-1), 1.5, colors.HexColor('#641C24')),
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#FFFDF7')),
                ('TOPPADDING', (0,0), (-1,-1), 8),
                ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ]))
            pair_cells.append(t_cell)
            
        if len(pair_cells) == 1:
            # Add an empty placeholder to keep table balance
            pair_cells.append("")
            
        # Put 2 cards on the page
        page_table = Table([[pair_cells[0]], [Spacer(1, 15)], [pair_cells[1]] if pair_cells[1] else []], colWidths=[550])
        page_table.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        story.append(page_table)
        
        if i + 2 < len(tables):
            story.append(PageBreak())
            
    doc.build(story)

def generate_all():
    db = SessionLocal()
    tables = db.query(RestaurantTable).order_by(RestaurantTable.table_number).all()
    restaurant = db.query(Restaurant).first()
    db.close()
    
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    
    # 1. Output HTML in root directory
    html_path = os.path.join(root_dir, "table_qr_stands_print.html")
    html_content = generate_html_stands(tables, restaurant)
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"Generated printable HTML: {html_path}")
    
    # 2. Output PDF in root directory
    pdf_path = os.path.join(root_dir, "Hotel_Ekdant_Table_QR_Stands.pdf")
    generate_pdf_stands(tables, restaurant, pdf_path)
    print(f"Generated printable PDF: {pdf_path}")
    
    # 3. Also output individual high-resolution PNGs in table_qr_codes/
    qr_dir = os.path.join(root_dir, "table_qr_codes")
    os.makedirs(qr_dir, exist_ok=True)
    for t in tables:
        qr_bytes = base64.b64decode(generate_qr_base64(t.table_number))
        png_file = os.path.join(qr_dir, f"Table_{t.table_number}_{t.section}.png")
        with open(png_file, "wb") as f:
            f.write(qr_bytes)
    print(f"Generated 11 individual table PNGs in: {qr_dir}")

if __name__ == "__main__":
    generate_all()
