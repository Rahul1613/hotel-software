import math
from datetime import datetime
import pytz

IST = pytz.timezone("Asia/Kolkata")

def now_ist() -> datetime:
    """Current time in Asia/Kolkata timezone."""
    return datetime.now(IST)

def now_utc() -> datetime:
    """Current UTC time."""
    return datetime.utcnow()

def rupees_to_paise(rupees: float) -> int:
    """Convert INR float to integer paise with standard rounding."""
    if rupees is None:
        return 0
    return int(round(float(rupees) * 100))

def paise_to_rupees(paise: int) -> float:
    """Convert integer paise to float rupees for display."""
    if paise is None:
        return 0.0
    return float(paise) / 100.0

def format_inr(paise: int) -> str:
    """Format paise to Indian Rupee currency string, e.g. ₹250.00"""
    rupees = paise_to_rupees(paise)
    return f"₹{rupees:.2f}"

def calculate_gst_breakdown(subtotal_paise: int, discount_paise: int, cgst_rate: float, sgst_rate: float, service_charge_rate: float = 0.0):
    """
    Standard Indian Restaurant GST Calculation:
    1. taxable = max(0, subtotal - discount)
    2. cgst = round(taxable * cgst_rate / 100)
    3. sgst = round(taxable * sgst_rate / 100)
    4. service_charge = round(taxable * service_charge_rate / 100)
    5. raw_total = taxable + cgst + sgst + service_charge
    6. rounded_total = round to nearest whole rupee (multiple of 100 paise)
    7. round_off = rounded_total - raw_total
    8. final_payable = rounded_total
    """
    subtotal_paise = max(0, int(subtotal_paise))
    discount_paise = max(0, min(subtotal_paise, int(discount_paise)))
    taxable_paise = subtotal_paise - discount_paise

    cgst_paise = int(round(taxable_paise * (float(cgst_rate) / 100.0)))
    sgst_paise = int(round(taxable_paise * (float(sgst_rate) / 100.0)))
    service_charge_paise = int(round(taxable_paise * (float(service_charge_rate) / 100.0))) if service_charge_rate > 0 else 0

    raw_total_paise = taxable_paise + cgst_paise + sgst_paise + service_charge_paise

    # Round to nearest whole rupee (100 paise)
    # e.g., 25050 -> 25100; 25040 -> 25000
    rupees_raw = raw_total_paise / 100.0
    rounded_rupees = round(rupees_raw)
    rounded_total_paise = int(rounded_rupees * 100)
    round_off_paise = rounded_total_paise - raw_total_paise

    return {
        "subtotal_paise": subtotal_paise,
        "discount_paise": discount_paise,
        "taxable_paise": taxable_paise,
        "cgst_rate": cgst_rate,
        "cgst_paise": cgst_paise,
        "sgst_rate": sgst_rate,
        "sgst_paise": sgst_paise,
        "service_charge_rate": service_charge_rate,
        "service_charge_paise": service_charge_paise,
        "round_off_paise": round_off_paise,
        "final_payable_paise": rounded_total_paise,
    }

def get_financial_year(dt: datetime = None) -> str:
    """Return Indian Financial Year format, e.g., '26-27' for Oct 2026."""
    if dt is None:
        dt = now_ist()
    year = dt.year
    month = dt.month
    if month >= 4:
        # April to Dec
        start_yr = year % 100
        end_yr = (year + 1) % 100
    else:
        # Jan to March
        start_yr = (year - 1) % 100
        end_yr = year % 100
    return f"{start_yr:02d}-{end_yr:02d}"

def ist_to_utc_range(day_date) -> tuple[datetime, datetime]:
    """Convert an IST calendar date into UTC datetime start & end for database filtering."""
    ist_start = IST.localize(datetime.combine(day_date, datetime.min.time()))
    ist_end = IST.localize(datetime.combine(day_date, datetime.max.time()))
    utc_start = ist_start.astimezone(pytz.utc).replace(tzinfo=None)
    utc_end = ist_end.astimezone(pytz.utc).replace(tzinfo=None)
    return utc_start, utc_end
