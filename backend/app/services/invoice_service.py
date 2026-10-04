import io
import urllib.parse
from html import escape
import qrcode
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from reportlab.lib.pagesizes import A4, mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from app.money import format_inr, paise_to_rupees, now_ist

def generate_invoice_pdf(invoice, orders, restaurant, format_type='A4') -> bytes:
    """
    Generate professional GST Invoice PDF using ReportLab with exact paise calculations.
    """
    buffer = io.BytesIO()
    
    if format_type == 'thermal':
        # 80mm width continuous receipt
        page_width = 80 * mm
        doc = SimpleDocTemplate(
            buffer,
            pagesize=(page_width, 220 * mm),
            leftMargin=4 * mm,
            rightMargin=4 * mm,
            topMargin=4 * mm,
            bottomMargin=4 * mm
        )
    else:
        # Standard A4 Tax Invoice
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=15 * mm,
            rightMargin=15 * mm,
            topMargin=15 * mm,
            bottomMargin=15 * mm
        )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'InvoiceTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=16 if format_type == 'A4' else 12,
        textColor=colors.HexColor('#641C24'),
        alignment=1, # Center
        spaceAfter=4
    )
    subtitle_style = ParagraphStyle(
        'InvoiceSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9 if format_type == 'A4' else 7.5,
        alignment=1,
        textColor=colors.HexColor('#444444'),
        spaceAfter=8
    )
    body_style = ParagraphStyle(
        'InvoiceBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9 if format_type == 'A4' else 8,
        textColor=colors.HexColor('#222222')
    )
    bold_style = ParagraphStyle(
        'InvoiceBold',
        parent=body_style,
        fontName='Helvetica-Bold'
    )

    elements = []

    # Header
    rest_name = restaurant.name if restaurant else "Hotel Ekdant Family Restaurant"
    rest_tagline = restaurant.tagline if restaurant else "Authentic Hospitality"
    elements.append(Paragraph(f"<b>{rest_name}</b>", title_style))
    elements.append(Paragraph(rest_tagline, subtitle_style))
    
    addr = f"{restaurant.address}<br/>Phone: {restaurant.phone} | GSTIN: {restaurant.gstin} | FSSAI: {restaurant.fssai}"
    elements.append(Paragraph(addr, subtitle_style))
    elements.append(Spacer(1, 8))

    # Bill Metadata
    dt_str = invoice.created_at.strftime("%d-%b-%Y %I:%M %p") if invoice.created_at else ""
    tbl_num = invoice.table.table_number if invoice.table else "Takeaway"
    
    meta_data = [
        [Paragraph(f"<b>Invoice No:</b> {invoice.invoice_number}", body_style), Paragraph(f"<b>Date:</b> {dt_str}", body_style)],
        [Paragraph(f"<b>Table:</b> {tbl_num}", body_style), Paragraph(f"<b>HSN/SAC:</b> {invoice.hsn_sac or '9963'}", body_style)],
        [Paragraph(f"<b>Customer:</b> {escape(invoice.customer_name or 'Guest')}", body_style), Paragraph(f"<b>Payment:</b> {invoice.payment_method} ({invoice.payment_status})", body_style)],
    ]
    if invoice.customer_gstin:
        meta_data.append([Paragraph(f"<b>Cust GSTIN:</b> {invoice.customer_gstin}", body_style), Paragraph("", body_style)])

    col_w = [85 * mm, 85 * mm] if format_type == 'A4' else [36 * mm, 36 * mm]
    meta_table = Table(meta_data, colWidths=col_w)
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 10))

    # Itemized Table
    item_rows = [["Item Description", "Qty", "Rate (₹)", "Total (₹)"]]
    for order in orders:
        for it in order.items:
            if it.item_status != "CANCELLED":
                item_rows.append([
                    it.item_name,
                    str(it.quantity),
                    f"{paise_to_rupees(it.price):.2f}",
                    f"{paise_to_rupees(it.total_price):.2f}"
                ])

    table_col_w = [90 * mm, 20 * mm, 30 * mm, 30 * mm] if format_type == 'A4' else [34 * mm, 10 * mm, 14 * mm, 14 * mm]
    items_table = Table(item_rows, colWidths=table_col_w)
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#641C24')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8 if format_type == 'thermal' else 9),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('LINEBELOW', (0, -1), (-1, -1), 1, colors.HexColor('#641C24')),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 8))

    # Summary Table
    summary_data = [
        ["Subtotal:", format_inr(invoice.subtotal)],
    ]
    if invoice.discount_amount > 0:
        summary_data.append(["Discount:", f"- {format_inr(invoice.discount_amount)}"])
    summary_data.append([f"CGST ({invoice.cgst_rate}%):", format_inr(invoice.cgst_amount)])
    summary_data.append([f"SGST ({invoice.sgst_rate}%):", format_inr(invoice.sgst_amount)])
    if invoice.service_charge_amount > 0:
        summary_data.append(["Service Charge:", format_inr(invoice.service_charge_amount)])
    if invoice.round_off != 0:
        summary_data.append(["Round Off:", format_inr(invoice.round_off)])
    summary_data.append(["FINAL PAYABLE:", format_inr(invoice.final_payable)])

    sum_col_w = [140 * mm, 30 * mm] if format_type == 'A4' else [44 * mm, 28 * mm]
    sum_table = Table(summary_data, colWidths=sum_col_w)
    sum_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, -1), (-1, -1), 10 if format_type == 'A4' else 9),
        ('LINEABOVE', (0, -1), (-1, -1), 1, colors.HexColor('#641C24')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(sum_table)

    # UPI QR Code
    if restaurant and restaurant.upi_id and invoice.final_payable > 0:
        elements.append(Spacer(1, 10))
        rupees_val = paise_to_rupees(invoice.final_payable)
        upi_string = f"upi://pay?pa={restaurant.upi_id}&pn={urllib.parse.quote(restaurant.name)}&am={rupees_val:.2f}&tr={invoice.invoice_number}&cu=INR"
        qr = qrcode.QRCode(box_size=3, border=1)
        qr.add_data(upi_string)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="black", back_color="white")
        qr_buf = io.BytesIO()
        qr_img.save(qr_buf, format='PNG')
        qr_buf.seek(0)
        elements.append(RLImage(qr_buf, width=25 * mm, height=25 * mm))
        elements.append(Paragraph(f"Scan & Pay via any UPI App • {restaurant.upi_id}", subtitle_style))

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()

def generate_thermal_receipt_html(invoice, orders, restaurant) -> str:
    """Generate 80mm ESC/POS browser printable thermal HTML receipt with UPI QR."""
    dt_str = invoice.created_at.strftime("%d-%b-%Y %I:%M %p") if invoice.created_at else ""
    tbl_num = invoice.table.table_number if invoice.table else "Takeaway"
    
    rows_html = ""
    for o in orders:
        for it in o.items:
            if it.item_status != "CANCELLED":
                rows_html += f"""
                <tr>
                    <td style="text-align:left;">{escape(it.item_name)}</td>
                    <td style="text-align:center;">{it.quantity}</td>
                    <td style="text-align:right;">{paise_to_rupees(it.price):.2f}</td>
                    <td style="text-align:right;">{paise_to_rupees(it.total_price):.2f}</td>
                </tr>
                """

    upi_qr_html = ""
    if restaurant and restaurant.upi_id and invoice.final_payable > 0:
        rupees_val = paise_to_rupees(invoice.final_payable)
        upi_url = f"upi://pay?pa={restaurant.upi_id}&pn={urllib.parse.quote(restaurant.name)}&am={rupees_val:.2f}&tr={invoice.invoice_number}&cu=INR"
        qr = qrcode.QRCode(box_size=3, border=1)
        qr.add_data(upi_url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        import base64
        b64_qr = base64.b64encode(buf.getvalue()).decode('utf-8')
        upi_qr_html = f"""
        <div style="text-align:center; margin-top:8px;">
            <img src="data:image/png;base64,{b64_qr}" style="width:90px;height:90px;" alt="UPI QR" /><br/>
            <span style="font-size:10px;">Scan to Pay: {restaurant.upi_id}</span>
        </div>
        """

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="utf-8">
    <title>Bill - {invoice.invoice_number}</title>
    <style>
      @page {{ size: 80mm auto; margin: 0; }}
      body {{ font-family: 'Courier New', monospace; width: 72mm; margin: 0 auto; padding: 6px 0; font-size: 12px; line-height: 1.25; color: #000; }}
      .center {{ text-align: center; }}
      .bold {{ font-weight: bold; }}
      .header {{ border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }}
      table {{ width: 100%; border-collapse: collapse; font-size: 11px; margin: 5px 0; }}
      th {{ border-bottom: 1px dashed #000; padding: 3px 0; }}
      td {{ padding: 2px 0; }}
      .totals {{ border-top: 1px dashed #000; margin-top: 4px; padding-top: 4px; font-size: 11px; }}
      .grand-total {{ font-size: 14px; font-weight: bold; border-top: 2px dashed #000; border-bottom: 2px dashed #000; padding: 4px 0; margin: 6px 0; }}
      .footer {{ text-align: center; font-size: 10px; margin-top: 8px; }}
      .no-print {{ text-align: center; margin-bottom: 8px; }}
      .print-btn {{ background: #258451; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; font-weight: bold; cursor: pointer; }}
      @media print {{ .no-print {{ display: none !important; }} }}
    </style>
    </head>
    <body onload="window.print()">
      <div class="no-print">
        <button onclick="window.print()" class="print-btn">🖨️ Print Bill</button>
      </div>
      <div class="header center">
        <div style="font-size:16px; font-weight:bold;">{escape(restaurant.name)}</div>
        <div style="font-size:10px;">{escape(restaurant.tagline)}</div>
        <div style="font-size:9px;">{escape(restaurant.address)}</div>
        <div style="font-size:9px;">Ph: {escape(restaurant.phone)} | GSTIN: {escape(restaurant.gstin)}</div>
        <div style="font-size:9px;">FSSAI Lic: {escape(restaurant.fssai)}</div>
      </div>
      <div style="font-size:10px; margin-bottom:4px;">
        <div><b>Bill No:</b> {invoice.invoice_number} | <b>Table:</b> {tbl_num}</div>
        <div><b>Date:</b> {dt_str}</div>
        <div><b>Customer:</b> {escape(invoice.customer_name or 'Guest')}</div>
        <div><b>Payment:</b> {invoice.payment_method} ({invoice.payment_status})</div>
        <div><b>HSN/SAC:</b> {invoice.hsn_sac or '9963'}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="text-align:left;">Item</th>
            <th style="text-align:center;">Qty</th>
            <th style="text-align:right;">Rate</th>
            <th style="text-align:right;">Amt</th>
          </tr>
        </thead>
        <tbody>
          {rows_html}
        </tbody>
      </table>
      <div class="totals">
        <div style="display:flex; justify-content:space-between;"><span>Subtotal:</span><span>{format_inr(invoice.subtotal)}</span></div>
        {f"<div style='display:flex; justify-content:space-between;'><span>Discount:</span><span>- {format_inr(invoice.discount_amount)}</span></div>" if invoice.discount_amount > 0 else ""}
        <div style="display:flex; justify-content:space-between;"><span>CGST ({invoice.cgst_rate}%):</span><span>{format_inr(invoice.cgst_amount)}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>SGST ({invoice.sgst_rate}%):</span><span>{format_inr(invoice.sgst_amount)}</span></div>
        {f"<div style='display:flex; justify-content:space-between;'><span>Service Chg:</span><span>{format_inr(invoice.service_charge_amount)}</span></div>" if invoice.service_charge_amount > 0 else ""}
        {f"<div style='display:flex; justify-content:space-between;'><span>Round Off:</span><span>{format_inr(invoice.round_off)}</span></div>" if invoice.round_off != 0 else ""}
        <div class="grand-total" style="display:flex; justify-content:space-between;">
          <span>TOTAL PAYABLE:</span>
          <span>{format_inr(invoice.final_payable)}</span>
        </div>
      </div>
      {upi_qr_html}
      <div class="footer">
        <div>Thank you for dining with Hotel Ekdant!</div>
        <div>Please visit again!</div>
      </div>
    </body>
    </html>
    """

def generate_kot_html(order, kitchen_station: str = None) -> str:
    """Generate 80mm thermal KOT ticket HTML."""
    items = order.items
    if kitchen_station and kitchen_station != "ALL":
        items = [it for it in items if it.kitchen_station == kitchen_station]

    item_parts = []
    for it in items:
        if it.item_status != "CANCELLED":
            custom_div = f"<div style=\"font-size:10px; font-style:italic; margin-left:12px; color:#444;\">{escape(it.customization)}</div>" if it.customization else ""
            veg_label = "[VEG]" if it.is_veg else "[NON-VEG]"
            item_parts.append(
                f"<div style='padding:3px 0; border-bottom:1px dotted #888; font-size:13px;'>"
                f"<b>{it.quantity}×</b> {escape(it.item_name)} {veg_label}"
                f"{custom_div}"
                f"</div>"
            )
    items_html = "".join(item_parts)

    tbl = order.table.table_number if order.table else "Takeaway"
    sec = order.table.section if order.table else "Takeaway"
    dt_str = order.created_at.strftime('%d-%b %I:%M %p') if order.created_at else ""

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="utf-8">
    <title>KOT - Table {tbl}</title>
    <style>
      @page {{ size: 80mm auto; margin: 0; }}
      body {{ font-family: monospace; width: 72mm; margin: 0 auto; padding: 8px 0; font-size: 13px; color: #000; }}
      .table-box {{ font-size: 20px; font-weight: bold; border: 2px solid #000; text-align: center; padding: 3px; margin: 4px 0; }}
    </style>
    </head>
    <body onload="window.print()">
      <div style="text-align:center; font-weight:bold; font-size:15px; border-bottom:1px dashed #000; padding-bottom:3px;">
        KITCHEN ORDER TICKET (KOT)
      </div>
      <div style="text-align:center; font-size:11px;">HOTEL EKDANT {f'• {kitchen_station}' if kitchen_station else ''}</div>
      <div class="table-box">TABLE {tbl} ({sec})</div>
      <div style="font-size:11px; margin-bottom:4px;">
        <div><b>Order #:</b> {order.order_number}</div>
        <div><b>Time:</b> {dt_str}</div>
        <div><b>Guest:</b> {escape(order.customer_name or 'Guest')}</div>
        {f'<div><b>Instructions:</b> {escape(order.special_instructions)}</div>' if order.special_instructions else ''}
      </div>
      <div style="border-top:1px dashed #000; padding-top:4px;">
        {items_html}
      </div>
      <div style="border-top:1px dashed #000; margin-top:6px; padding-top:3px; font-size:11px; text-align:center; font-weight:bold;">
        TOTAL ITEMS: {sum(it.quantity for it in items if it.item_status != 'CANCELLED')}
      </div>
    </body>
    </html>
    """

def generate_sales_excel(orders, invoices, restaurant) -> bytes:
    """Generate multi-sheet sales report with Invoices, Orders, and GST breakdown."""
    wb = Workbook()
    
    # Sheet 1: Invoices (Tax Register)
    ws_inv = wb.active
    ws_inv.title = "Invoice Register"
    ws_inv.append(["Invoice No", "Date", "Table", "Customer", "Subtotal (₹)", "Discount (₹)", "Taxable (₹)", "CGST (₹)", "SGST (₹)", "Round Off (₹)", "Final (₹)", "Payment Method", "Status"])
    
    for inv in invoices:
        ws_inv.append([
            inv.invoice_number,
            inv.created_at.strftime('%Y-%m-%d %H:%M') if inv.created_at else '',
            inv.table.table_number if inv.table else 'Takeaway',
            inv.customer_name,
            paise_to_rupees(inv.subtotal),
            paise_to_rupees(inv.discount_amount),
            paise_to_rupees(inv.taxable_amount),
            paise_to_rupees(inv.cgst_amount),
            paise_to_rupees(inv.sgst_amount),
            paise_to_rupees(inv.round_off),
            paise_to_rupees(inv.final_payable),
            inv.payment_method,
            inv.payment_status
        ])

    # Sheet 2: Orders
    ws_ord = wb.create_sheet(title="Orders")
    ws_ord.append(["Order No", "Date", "Table", "Type", "Source", "Customer", "Items Count", "Subtotal (₹)", "Final (₹)", "Status"])
    for o in orders:
        ws_ord.append([
            o.order_number,
            o.created_at.strftime('%Y-%m-%d %H:%M') if o.created_at else '',
            o.table.table_number if o.table else 'Takeaway',
            o.order_type,
            o.source,
            o.customer_name,
            len(o.items),
            paise_to_rupees(o.subtotal),
            paise_to_rupees(o.final_amount),
            o.status
        ])

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# DUAL BILLING: Internal Bill Template
# ---------------------------------------------------------------------------

def generate_internal_bill_html(invoice, orders, restaurant, internal_notes=None) -> str:
    """
    Generate 80mm-optimised internal management receipt HTML.
    Shows item-wise selling price, preparation cost, gross profit, and P&L summary.
    Clearly marked INTERNAL COPY – NOT A CUSTOMER TAX INVOICE.
    """
    dt_str = invoice.created_at.strftime("%d-%b-%Y %I:%M %p") if invoice.created_at else ""
    tbl_num = invoice.table.table_number if invoice.table else "Takeaway"

    # Build per-item rows with cost analysis
    rows_html = ""
    total_selling_paise = 0
    total_cost_paise = 0

    for o in orders:
        for it in o.items:
            if it.item_status != "CANCELLED":
                selling = it.total_price  # paise already includes qty
                # Fetch prep cost from the MenuItem via the relationship
                unit_cost = 0
                if it.item and hasattr(it.item, 'preparation_cost') and it.item.preparation_cost:
                    unit_cost = it.item.preparation_cost
                cost_total = unit_cost * it.quantity
                profit = selling - cost_total
                profit_color = "#258451" if profit >= 0 else "#c0392b"

                total_selling_paise += selling
                total_cost_paise += cost_total

                rows_html += f"""
                <tr>
                    <td style="text-align:left; font-size:10px;">{escape(it.item_name)}</td>
                    <td style="text-align:center;">{it.quantity}</td>
                    <td style="text-align:right;">{paise_to_rupees(it.price):.2f}</td>
                    <td style="text-align:right;">{paise_to_rupees(unit_cost):.2f}</td>
                    <td style="text-align:right; color:{profit_color};">{paise_to_rupees(profit):.2f}</td>
                </tr>
                """

    total_gross_profit = total_selling_paise - total_cost_paise
    profit_margin_pct = (total_gross_profit / total_selling_paise * 100) if total_selling_paise > 0 else 0.0

    # Internal adjustments
    adj_html = ""
    net_adjustment_paise = 0
    if internal_notes:
        adj_html = "<div style='border-top:1px dashed #888; margin-top:4px; padding-top:4px;'><b>Internal Adjustments:</b></div>"
        for note in internal_notes:
            adj_sign = "+" if note.amount_paise >= 0 else ""
            adj_color = "#258451" if note.amount_paise >= 0 else "#c0392b"
            adj_html += f"""
            <div style='font-size:10px; display:flex; justify-content:space-between;'>
                <span style='max-width:60%;'>[{escape(note.note_type)}] {escape(note.reason)}</span>
                <span style='color:{adj_color}; font-weight:bold;'>{adj_sign}{paise_to_rupees(note.amount_paise):.2f}</span>
            </div>"""
            net_adjustment_paise += note.amount_paise

    net_profit = total_gross_profit + net_adjustment_paise

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="utf-8">
    <title>INTERNAL BILL - {invoice.invoice_number}</title>
    <style>
      @page {{ size: 80mm auto; margin: 0; }}
      body {{ font-family: 'Courier New', monospace; width: 72mm; margin: 0 auto; padding: 6px 0; font-size: 11px; line-height: 1.3; color: #000; }}
      .watermark {{ text-align:center; font-size:9px; font-weight:bold; background:#ffe0e0; border:2px solid #c0392b; padding:3px; margin-bottom:4px; color:#c0392b; letter-spacing:1px; }}
      .center {{ text-align: center; }}
      .bold {{ font-weight: bold; }}
      .header {{ border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 4px; }}
      table {{ width: 100%; border-collapse: collapse; font-size: 10px; margin: 4px 0; }}
      th {{ border-bottom: 1px dashed #000; padding: 2px 1px; font-size: 9px; }}
      td {{ padding: 2px 1px; }}
      .totals {{ border-top: 1px dashed #000; margin-top: 4px; padding-top: 4px; font-size: 10px; }}
      .profit-line {{ font-size: 12px; font-weight: bold; border-top: 2px dashed #000; border-bottom: 2px dashed #000; padding: 3px 0; margin: 5px 0; }}
      .no-print {{ text-align: center; margin-bottom: 8px; }}
      .print-btn {{ background: #641C24; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; font-weight: bold; cursor: pointer; }}
      @media print {{ .no-print {{ display: none !important; }} }}
    </style>
    </head>
    <body>
      <div class="no-print">
        <button onclick="window.print()" class="print-btn">🖨️ Print Internal Bill</button>
      </div>
      <div class="watermark">⚠ INTERNAL COPY – NOT A CUSTOMER TAX INVOICE ⚠</div>
      <div class="header center">
        <div style="font-size:13px; font-weight:bold;">{escape(restaurant.name if restaurant else 'Hotel Ekdant')}</div>
        <div style="font-size:9px;">MANAGEMENT INTERNAL DOCUMENT</div>
      </div>
      <div style="font-size:10px; margin-bottom:4px;">
        <div><b>Bill No:</b> {invoice.invoice_number} | <b>Table:</b> {tbl_num}</div>
        <div><b>Date:</b> {dt_str}</div>
        <div><b>Customer:</b> {escape(invoice.customer_name or 'Guest')}</div>
        <div><b>Payment:</b> {invoice.payment_method} ({invoice.payment_status})</div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="text-align:left;">Item</th>
            <th style="text-align:center;">Qty</th>
            <th style="text-align:right;">Sale</th>
            <th style="text-align:right;">Cost</th>
            <th style="text-align:right;">Profit</th>
          </tr>
        </thead>
        <tbody>
          {rows_html}
        </tbody>
      </table>
      <div class="totals">
        <div style="display:flex; justify-content:space-between;"><span>Total Selling:</span><span>{format_inr(total_selling_paise)}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>Total Food Cost:</span><span>- {format_inr(total_cost_paise)}</span></div>
        {f"<div style='display:flex; justify-content:space-between;'><span>Discount Given:</span><span>- {format_inr(invoice.discount_amount)}</span></div>" if invoice.discount_amount > 0 else ""}
        <div style="display:flex; justify-content:space-between;"><span>CGST ({invoice.cgst_rate}%):</span><span>{format_inr(invoice.cgst_amount)}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>SGST ({invoice.sgst_rate}%):</span><span>{format_inr(invoice.sgst_amount)}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>Final Customer Paid:</span><span><b>{format_inr(invoice.final_payable)}</b></span></div>
      </div>
      {adj_html}
      <div class="profit-line" style="display:flex; justify-content:space-between; color:{'#258451' if total_gross_profit >= 0 else '#c0392b'};">
        <span>GROSS PROFIT:</span>
        <span>{format_inr(total_gross_profit)} ({profit_margin_pct:.1f}%)</span>
      </div>
      {f"<div style='display:flex; justify-content:space-between; font-size:11px; font-weight:bold; color:{'#258451' if net_profit >= 0 else '#c0392b'};'><span>NET (after adj):</span><span>{format_inr(net_profit)}</span></div>" if internal_notes else ""}
      <div style="border-top:1px dashed #000; margin-top:6px; padding-top:3px; font-size:9px; text-align:center; color:#888;">
        CONFIDENTIAL — For authorized staff only.<br/>
        Printed: {dt_str}
      </div>
    </body>
    </html>
    """


def generate_dual_receipt_html(invoice, orders, restaurant, internal_notes=None) -> str:
    """
    Returns a single HTML document that prints BOTH customer bill and internal bill
    on separate pages (page-break-after). Safe for one-pass printing — no duplicate
    transactions are created because invoice already exists in DB before this is called.
    """
    customer_html_body = _extract_body_content(
        generate_thermal_receipt_html(invoice, orders, restaurant)
    )
    internal_html_body = _extract_body_content(
        generate_internal_bill_html(invoice, orders, restaurant, internal_notes)
    )

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Dual Bill - {invoice.invoice_number}</title>
<style>
  @page {{ size: 80mm auto; margin: 0; }}
  body {{ font-family: 'Courier New', monospace; width: 72mm; margin: 0 auto; padding: 0; font-size: 12px; color: #000; }}
  .bill-section {{ page-break-after: always; padding: 6px 0; }}
  .bill-section:last-child {{ page-break-after: avoid; }}
  .no-print {{ text-align: center; margin: 8px 0; }}
  .print-btn {{ background: #641C24; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; font-weight: bold; cursor: pointer; }}
  @media print {{ .no-print {{ display: none !important; }} }}
</style>
</head>
<body onload="window.print()">
  <div class="no-print">
    <button onclick="window.print()" class="print-btn">🖨️ Print Both Bills</button>
  </div>
  <div class="bill-section">
    {customer_html_body}
  </div>
  <div class="bill-section">
    {internal_html_body}
  </div>
</body>
</html>"""


def _extract_body_content(full_html: str) -> str:
    """Extract content between <body ...> and </body> from a full HTML string."""
    import re
    # Remove onload attr from body tag, strip outer body tags
    body_match = re.search(r'<body[^>]*>(.*?)</body>', full_html, re.DOTALL | re.IGNORECASE)
    if body_match:
        content = body_match.group(1)
        # Remove the standalone print buttons (no-print divs) since parent already has one
        content = re.sub(r'<div class="no-print">.*?</div>', '', content, flags=re.DOTALL)
        return content.strip()
    return full_html

