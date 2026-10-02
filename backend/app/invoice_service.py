import os
import io
from datetime import datetime
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

def generate_invoice_pdf(invoice, order, restaurant, format_type="A4") -> bytes:
    buffer = io.BytesIO()
    
    # We create a clean, elegant PDF
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4 if format_type == "A4" else (226, 600), # 80mm thermal approx 226 points
        leftMargin=30 if format_type == "A4" else 10,
        rightMargin=30 if format_type == "A4" else 10,
        topMargin=30 if format_type == "A4" else 10,
        bottomMargin=30 if format_type == "A4" else 10,
    )
    
    story = []
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'InvoiceTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18 if format_type == "A4" else 12,
        textColor=colors.HexColor('#641C24'),
        alignment=1, # Center
        spaceAfter=4
    )
    
    subtitle_style = ParagraphStyle(
        'InvoiceSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10 if format_type == "A4" else 8,
        textColor=colors.HexColor('#282321'),
        alignment=1,
        spaceAfter=2
    )

    meta_style = ParagraphStyle(
        'Meta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9 if format_type == "A4" else 7,
        textColor=colors.HexColor('#282321'),
    )

    bold_meta = ParagraphStyle(
        'BoldMeta',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9 if format_type == "A4" else 7,
        textColor=colors.HexColor('#641C24'),
    )

    logo_path = os.path.join(os.path.dirname(__file__), "static", "ekdant_logo.png")
    if os.path.exists(logo_path):
        from reportlab.platypus import Image as RLImage
        logo_w = 200 if format_type == "A4" else 140
        logo_h = 55 if format_type == "A4" else 38
        story.append(RLImage(logo_path, width=logo_w, height=logo_h))
        story.append(Spacer(1, 4))
    else:
        story.append(Paragraph("HOTEL EKDANT FAMILY RESTAURANT", title_style))

    story.append(Paragraph(f"{restaurant.tagline}", subtitle_style))
    story.append(Paragraph(f"{restaurant.address}", subtitle_style))
    story.append(Paragraph(f"Phone: {restaurant.phone} | GSTIN: {restaurant.gstin} | FSSAI: {restaurant.fssai}", subtitle_style))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#C49A52'), spaceBefore=2, spaceAfter=10))

    # Invoice & Table Meta Table
    inv_date_str = invoice.created_at.strftime('%d-%b-%Y %I:%M %p') if invoice.created_at else datetime.now().strftime('%d-%b-%Y %I:%M %p')
    meta_data = [
        [
            Paragraph(f"<b>Tax Invoice #:</b> {invoice.invoice_number}", meta_style),
            Paragraph(f"<b>Table No:</b> {invoice.table.name if invoice.table else 'N/A'}", bold_meta),
        ],
        [
            Paragraph(f"<b>Date & Time:</b> {inv_date_str}", meta_style),
            Paragraph(f"<b>Order No:</b> {order.order_number if order else 'Direct Bill'}", meta_style),
        ],
        [
            Paragraph(f"<b>Customer:</b> {invoice.customer_name or 'Walk-in Guest'}", meta_style),
            Paragraph(f"<b>Payment:</b> {invoice.payment_method} ({invoice.payment_status})", meta_style),
        ]
    ]
    t_meta = Table(meta_data, colWidths=[280, 250] if format_type == "A4" else [105, 105])
    t_meta.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 10))

    # Items Table
    headers = ["Item Name", "Qty", "Price (₹)", "Amount (₹)"]
    items_rows = [headers]
    
    if order and order.items:
        for it in order.items:
            items_rows.append([
                it.item_name + (" [Veg]" if it.is_veg else " [Non-Veg]"),
                str(it.quantity),
                f"{it.price:.2f}",
                f"{it.total_price:.2f}"
            ])
    else:
        items_rows.append(["Restaurant Dining Service", "1", f"{invoice.subtotal:.2f}", f"{invoice.subtotal:.2f}"])

    col_widths = [260, 50, 110, 110] if format_type == "A4" else [90, 25, 45, 50]
    t_items = Table(items_rows, colWidths=col_widths)
    t_items.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#641C24')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#FFF9F0')),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 9 if format_type == "A4" else 7),
        ('ALIGN', (1,0), (-1,-1), 'RIGHT'),
        ('ALIGN', (0,0), (0,-1), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E5E4E7')),
    ]))
    story.append(t_items)
    story.append(Spacer(1, 10))

    # Totals breakdown
    totals_data = [
        ["Subtotal:", f"₹ {invoice.subtotal:.2f}"],
        [f"CGST ({invoice.cgst_rate}%):", f"₹ {invoice.cgst_amount:.2f}"],
        [f"SGST ({invoice.sgst_rate}%):", f"₹ {invoice.sgst_amount:.2f}"],
    ]
    if invoice.discount_amount > 0:
        totals_data.append(["Discount Applied:", f"- ₹ {invoice.discount_amount:.2f}"])
    totals_data.append(["Round Off:", f"₹ {invoice.round_off:.2f}"])
    totals_data.append(["Total Payable Amount:", f"₹ {invoice.final_payable:.2f}"])

    t_totals = Table(totals_data, colWidths=[380, 150] if format_type == "A4" else [120, 90])
    t_totals.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
        ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,-1), (-1,-1), 11 if format_type == "A4" else 9),
        ('TEXTCOLOR', (0,-1), (-1,-1), colors.HexColor('#641C24')),
        ('LINEABOVE', (0,-1), (-1,-1), 1.5, colors.HexColor('#C49A52')),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('TOPPADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(t_totals)
    story.append(Spacer(1, 15))

    footer_text = Paragraph(
        "<b>Thank you for dining with Hotel Ekdant! Please visit us again.</b><br/>"
        "<i>GST Tax Invoice issued as per Central & State Goods and Services Tax Rules.</i>",
        subtitle_style
    )
    story.append(footer_text)

    doc.build(story)
    return buffer.getvalue()


def generate_sales_excel(orders, restaurant, start_date=None, end_date=None) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Sales Report"

    # Header styling
    maroon_fill = PatternFill(start_color="641C24", end_color="641C24", fill_type="solid")
    gold_fill = PatternFill(start_color="C49A52", end_color="C49A52", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    title_font = Font(name="Calibri", size=14, bold=True, color="641C24")

    ws.merge_cells('A1:J1')
    ws['A1'] = f"{restaurant.name} — Sales & Tax Report"
    ws['A1'].font = title_font
    ws['A1'].alignment = Alignment(horizontal="center")

    period_str = f"Period: {start_date or 'All Time'} to {end_date or 'Present'}"
    ws.merge_cells('A2:J2')
    ws['A2'] = period_str
    ws['A2'].alignment = Alignment(horizontal="center")

    cols = [
        "Order #", "Date & Time", "Table", "Customer", 
        "Items Qty", "Subtotal (₹)", "CGST (₹)", "SGST (₹)", 
        "Total (₹)", "Status"
    ]
    ws.append([]) # Row 3 blank
    ws.append(cols) # Row 4 header

    for col_idx in range(1, len(cols) + 1):
        cell = ws.cell(row=4, column=col_idx)
        cell.fill = maroon_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")

    row_num = 5
    for ord in orders:
        total_qty = sum(it.quantity for it in ord.items) if ord.items else 0
        date_str = ord.created_at.strftime('%Y-%m-%d %H:%M') if ord.created_at else ''
        ws.append([
            ord.order_number,
            date_str,
            ord.table.name if ord.table else 'N/A',
            ord.customer_name or 'Guest',
            total_qty,
            round(ord.subtotal, 2),
            round(ord.cgst_amount, 2),
            round(ord.sgst_amount, 2),
            round(ord.final_amount, 2),
            ord.status
        ])
        row_num += 1

    # Auto-adjust column width safely
    from openpyxl.utils import get_column_letter
    for col_idx in range(1, len(cols) + 1):
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = 18

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
