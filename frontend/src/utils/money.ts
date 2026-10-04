export function rupeesToPaise(rupees: number): number {
  return Math.round(Number(rupees || 0) * 100);
}

export function paiseToRupees(paise: number): number {
  return Number(paise || 0) / 100;
}

export function formatINR(rupeesOrPaise: number, isPaise: boolean = false): string {
  const rupees = isPaise ? paiseToRupees(rupeesOrPaise) : Number(rupeesOrPaise || 0);
  return `₹${rupees.toFixed(2)}`;
}

export function calculateCartGst(
  subtotalRupees: number,
  discountRupees: number,
  cgstRate: number,
  sgstRate: number,
  serviceChargeRate: number = 0
) {
  const subtotalPaise = rupeesToPaise(subtotalRupees);
  const discountPaise = Math.min(subtotalPaise, rupeesToPaise(discountRupees));
  const taxablePaise = Math.max(0, subtotalPaise - discountPaise);

  const cgstPaise = Math.round(taxablePaise * (cgstRate / 100));
  const sgstPaise = Math.round(taxablePaise * (sgstRate / 100));
  const scPaise = serviceChargeRate > 0 ? Math.round(taxablePaise * (serviceChargeRate / 100)) : 0;

  const rawTotalPaise = taxablePaise + cgstPaise + sgstPaise + scPaise;
  const roundedRupees = Math.round(rawTotalPaise / 100);
  const roundedTotalPaise = roundedRupees * 100;
  const roundOffPaise = roundedTotalPaise - rawTotalPaise;

  return {
    subtotal: paiseToRupees(subtotalPaise),
    discount: paiseToRupees(discountPaise),
    taxable: paiseToRupees(taxablePaise),
    cgst: paiseToRupees(cgstPaise),
    sgst: paiseToRupees(sgstPaise),
    serviceCharge: paiseToRupees(scPaise),
    roundOff: paiseToRupees(roundOffPaise),
    finalPayable: paiseToRupees(roundedTotalPaise),
  };
}
