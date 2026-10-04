import { describe, it, expect } from 'vitest';
import { rupeesToPaise, paiseToRupees, formatINR, calculateCartGst } from '../src/utils/money';

describe('Money and GST Calculations', () => {
  it('converts rupees to paise and back with proper precision', () => {
    expect(rupeesToPaise(150.5)).toBe(15050);
    expect(paiseToRupees(15050)).toBe(150.5);
    expect(formatINR(15050, true)).toBe('₹150.50');
    expect(formatINR(150.5, false)).toBe('₹150.50');
  });

  it('calculates standard 5% restaurant GST and rounds to whole rupee', () => {
    const res = calculateCartGst(1000, 0, 2.5, 2.5, 0);
    expect(res.subtotal).toBe(1000);
    expect(res.cgst).toBe(25);
    expect(res.sgst).toBe(25);
    expect(res.finalPayable).toBe(1050);
    expect(res.roundOff).toBe(0);
  });

  it('computes GST strictly on post-discount amount', () => {
    // 1000 subtotal, 200 discount -> 800 taxable
    const res = calculateCartGst(1000, 200, 2.5, 2.5, 0);
    expect(res.taxable).toBe(800);
    expect(res.cgst).toBe(20);
    expect(res.sgst).toBe(20);
    expect(res.finalPayable).toBe(840);
  });
});
