export const formatQty = (n: number) =>
  n.toLocaleString('en-IN', { maximumFractionDigits: 3 });

export const formatMoney = (n: number) =>
  n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
