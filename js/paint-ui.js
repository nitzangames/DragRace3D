import { updateActivePaintPreview } from './paint-preview.js';

const STRIPE_OPTIONS = ['none', 'center', 'dual', 'racing'];
export const PALETTE = [
  0xc83a26, 0xff7f00, 0xffd14a, 0x33dd55, 0x18b8a0, 0x2a8fd4, 0x6c40a8,
  0xb02a8a, 0xffffff, 0x080808, 0x4d6dd6, 0x808080,
];

/** Pick two distinct palette colors deterministically from a seed. */
export function pickRandomPaint(seed, avoidColor) {
  let s = (seed | 0) >>> 0;
  const next = () => { s = Math.imul(s ^ (s >>> 15), 1 | s); s ^= s + Math.imul(s ^ (s >>> 7), 61 | s); return (s ^ (s >>> 14)) >>> 0; };
  let i1 = next() % PALETTE.length;
  if (avoidColor != null && PALETTE[i1] === avoidColor) i1 = (i1 + 1) % PALETTE.length;
  let i2 = next() % PALETTE.length;
  if (i2 === i1) i2 = (i2 + 1) % PALETTE.length;
  return { primary: PALETTE[i1], secondary: PALETTE[i2] };
}

export function renderPaintUI(parent, ownedCar, onChange) {
  parent.innerHTML = '';

  // The 3D preview is mounted persistently at the top of the cardetail
  // screen (outside this tab body), so it stays put across tab switches.
  // Paint changes just push the new paint into that existing preview —
  // no remount, no rotation reset.
  const apply = (newPaint) => {
    updateActivePaintPreview(newPaint);
    onChange(newPaint);
  };

  const primarySection = colorRow('Primary', ownedCar.paint.primary,
    c => apply({ ...ownedCar.paint, primary: c }));
  const secondarySection = colorRow('Secondary (cabin)', ownedCar.paint.secondary,
    c => apply({ ...ownedCar.paint, secondary: c }));
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
    btn.addEventListener('click', () => {
      // Update the visual selection inline so callers don't need to
      // re-render the whole paint UI (which would reset the 3D preview's
      // rotation angle on every tap).
      stripeRow.querySelectorAll('.stripe-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      apply({ ...ownedCar.paint, stripe: opt });
    });
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
    sw.addEventListener('click', () => {
      // Update selection inline; avoid the full paint-UI re-render that
      // would dispose+remount the 3D preview and reset its rotation.
      row.querySelectorAll('.swatch').forEach((s) => s.classList.remove('selected'));
      sw.classList.add('selected');
      onPick(c);
    });
    row.appendChild(sw);
  }
  wrap.appendChild(row);
  return wrap;
}
