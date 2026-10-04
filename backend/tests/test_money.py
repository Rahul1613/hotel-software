import pytest
from app.money import (
    rupees_to_paise, paise_to_rupees, format_inr, 
    calculate_gst_breakdown, get_financial_year
)

def test_rupees_to_paise():
    assert rupees_to_paise(250) == 25000
    assert rupees_to_paise(19.99) == 1999
    assert rupees_to_paise(0) == 0
    assert rupees_to_paise(None) == 0

def test_paise_to_rupees():
    assert paise_to_rupees(25000) == 250.0
    assert paise_to_rupees(1999) == 19.99
    assert paise_to_rupees(0) == 0.0

def test_format_inr():
    assert format_inr(25000) == "₹250.00"
    assert format_inr(1950) == "₹19.50"

def test_calculate_gst_breakdown_standard():
    # 1000 rupees (100000 paise), 5% GST (2.5% CGST + 2.5% SGST)
    res = calculate_gst_breakdown(
        subtotal_paise=100000,
        discount_paise=0,
        cgst_rate=2.5,
        sgst_rate=2.5
    )
    assert res["subtotal_paise"] == 100000
    assert res["taxable_paise"] == 100000
    assert res["cgst_paise"] == 2500
    assert res["sgst_paise"] == 2500
    assert res["final_payable_paise"] == 105000
    assert res["round_off_paise"] == 0

def test_calculate_gst_breakdown_with_discount():
    # Subtotal 1000 rupees, discount 200 rupees -> Taxable 800 rupees
    res = calculate_gst_breakdown(
        subtotal_paise=100000,
        discount_paise=20000,
        cgst_rate=2.5,
        sgst_rate=2.5
    )
    assert res["taxable_paise"] == 80000
    assert res["cgst_paise"] == 2000 # 2.5% of 800
    assert res["sgst_paise"] == 2000
    assert res["final_payable_paise"] == 84000

def test_calculate_gst_breakdown_odd_paise_rounding():
    # 333 rupees (33300 paise)
    # taxable: 33300
    # cgst: 832.5 -> 833 paise
    # sgst: 832.5 -> 833 paise
    # raw total: 33300 + 833 + 833 = 34966 paise (349.66 rs)
    # rounded: 350.00 rs (35000 paise)
    # round off: 35000 - 34966 = +34 paise
    res = calculate_gst_breakdown(
        subtotal_paise=33300,
        discount_paise=0,
        cgst_rate=2.5,
        sgst_rate=2.5
    )
    assert res["final_payable_paise"] == 35000
    assert res["round_off_paise"] == 36

def test_financial_year():
    from datetime import datetime
    dt_oct = datetime(2026, 10, 4)
    assert get_financial_year(dt_oct) == "26-27"
    dt_feb = datetime(2027, 2, 1)
    assert get_financial_year(dt_feb) == "26-27"
    dt_apr = datetime(2027, 4, 1)
    assert get_financial_year(dt_apr) == "27-28"
