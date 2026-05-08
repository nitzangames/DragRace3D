const STRIPE_OPTIONS = ['none', 'center', 'dual', 'racing'];
const PALETTE = [
  0xc83a26, 0xff7f00, 0xffd14a, 0x33dd55, 0x18b8a0, 0x2a8fd4, 0x6c40a8,
  0xb02a8a, 0xffffff, 0x080808, 0x4d6dd6, 0x808080,
];

export function renderPaintUI(parent, ownedCar, onChange) {
  parent.innerHTML = '';

  const primarySection = colorRow('Primary', ownedCar.paint.primary,
    c => onChange({ ...ownedCar.paint, primary: c }));
  const secondarySection = colorRow('Secondary (cabin)', ownedCar.paint.secondary,
    c => onChange({ ...ownedCar.paint, secondary: c }));
  parent.appendChild(primarySection);
  parent.appendChild(secondarySection);

  // Stripe variant
  const stripeWrap = document.createElement('div');
  stripeWrap.className = 'paint-row';
  stripeWrap.innerHTML = `<div class="paint-label">Stripe</div>`;
  const stripeRow = document.createElement('div');
  stripeRow.className = 'stripe-row';
  for (const opt of STRIPE_OPTIONS) {
    const btn = document.createElement('button');
    btn.className = 'stripe-btn' + (ownedCar.paint.stripe === opt ? ' selected' : '');
    btn.textContent = opt.toUpperCase();
    btn.addEventListener('click', () => onChange({ ...ownedCar.paint, stripe: opt }));
    stripeRow.appendChild(btn);
  }
  stripeWrap.appendChild(stripeRow);
  parent.appendChild(stripeWrap);
}

function colorRow(label, currentColor, onPick) {
  const wrap = document.createElement('div');
  wrap.className = 'paint-row';
  wrap.innerHTML = `<div class="paint-label">${label}</div>`;
  const row = document.createElement('div');
  row.className = 'palette-row';
  for (const c of PALETTE) {
    const sw = document.createElement('button');
    sw.className = 'swatch' + (c === currentColor ? ' selected' : '');
    sw.style.background = '#' + c.toString(16).padStart(6, '0');
    sw.addEventListener('click', () => onPick(c));
    row.appendChild(sw);
  }
  wrap.appendChild(row);
  return wrap;
}
