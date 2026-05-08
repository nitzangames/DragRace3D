/**
 * Classic automotive tachometer SVG.
 * Numeric tick labels 0-7 around the dial (x1000 RPM).
 * Needle sweeps 270° from lower-left (7-8 o'clock) to lower-right (4-5 o'clock),
 * passing through the top.
 *
 * polar(deg=0) → lower-left, polar(deg=270) → lower-right.
 * needle rotate(-135 + deg) at deg=0 → pointing lower-left. ✓ aligned.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Re-build the tach SVG inside the given parent element. */
export function buildTachSVG(parentEl, redline, greenBand) {
  parentEl.innerHTML = '';
  const W = 400, H = 400, cx = 200, cy = 200, r = 160;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('xmlns', SVG_NS);
  svg.style.width = '100%';
  svg.style.height = '100%';
  parentEl.appendChild(svg);

  // --- Rim + dark face ---
  const rim = document.createElementNS(SVG_NS, 'circle');
  rim.setAttribute('cx', cx); rim.setAttribute('cy', cy);
  rim.setAttribute('r', r + 14);
  rim.setAttribute('fill', '#c8cdd5');  // light grey rim
  svg.appendChild(rim);

  const face = document.createElementNS(SVG_NS, 'circle');
  face.setAttribute('cx', cx); face.setAttribute('cy', cy);
  face.setAttribute('r', r + 4);
  face.setAttribute('fill', '#111418');
  svg.appendChild(face);

  // deg=0 → lower-left (7-8 o'clock), matches rotate(-135+0).
  // That means: angle from positive-x = (deg + 135) * π/180
  function polar(deg, rad) {
    const a = (deg + 135) * Math.PI / 180;
    return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad];
  }

  function arcPath(a0, a1, rad) {
    const [x0, y0] = polar(a0, rad);
    const [x1, y1] = polar(a1, rad);
    const large = (a1 - a0) > 180 ? 1 : 0;
    return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${rad} ${rad} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }

  function appendArc(d, color, w) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d); p.setAttribute('stroke', color);
    p.setAttribute('stroke-width', w); p.setAttribute('fill', 'none');
    p.setAttribute('stroke-linecap', 'butt');
    svg.appendChild(p);
    return p;
  }

  const maxRpm = redline * 1.1;
  const redDeg  = (redline / maxRpm) * 270;            // degree where redline falls
  const greenStartDeg = ((redline - greenBand) / maxRpm) * 270;

  // Track background arc (full sweep, dark)
  appendArc(arcPath(0, 270, r - 10), '#1a1d22', 20);

  // Red zone arc (past redline to max = 270°)
  appendArc(arcPath(redDeg, 270, r - 10), '#ff2a18', 20);

  // Thin green shift-cue arc just before redline
  appendArc(arcPath(greenStartDeg, redDeg, r - 10), '#22ee48', 6);

  // --- Major + minor ticks and numeric labels ---
  // We show numeric labels 0..7 (these are × 1000 RPM markers)
  // Max dial = maxRpm ≈ 7480 (for redline=6800)
  // We draw ticks from 0 to the largest N*1000 ≤ maxRpm + minor step
  const minorStep = 250;  // RPM per minor tick
  const majorStep = 1000; // RPM per major tick
  const totalMinorSteps = Math.ceil(maxRpm / minorStep);

  for (let i = 0; i <= totalMinorSteps; i++) {
    const rpm = i * minorStep;
    if (rpm > maxRpm) break;
    const deg = (rpm / maxRpm) * 270;
    const isMajor = (rpm % majorStep === 0);
    const tickLen = isMajor ? 18 : 9;
    const tickW   = isMajor ? 3 : 1.5;
    const outerR  = r - 2;
    const innerR  = outerR - tickLen;
    const [ox, oy] = polar(deg, outerR);
    const [ix, iy] = polar(deg, innerR);
    const tick = document.createElementNS(SVG_NS, 'line');
    tick.setAttribute('x1', ox.toFixed(1)); tick.setAttribute('y1', oy.toFixed(1));
    tick.setAttribute('x2', ix.toFixed(1)); tick.setAttribute('y2', iy.toFixed(1));
    tick.setAttribute('stroke', '#e0e4ea');
    tick.setAttribute('stroke-width', tickW);
    svg.appendChild(tick);

    if (isMajor) {
      const labelN = rpm / 1000;  // 0..7 (maybe 8 but maxRpm cuts it)
      if (labelN > maxRpm / 1000) continue;
      const labelR = outerR - tickLen - 16;
      const [lx, ly] = polar(deg, labelR);
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('x', lx.toFixed(1));
      t.setAttribute('y', ly.toFixed(1));
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('dominant-baseline', 'central');
      t.setAttribute('fill', '#e0e4ea');
      t.setAttribute('font-size', 24);
      t.setAttribute('font-weight', '600');
      t.setAttribute('font-family', 'system-ui');
      t.textContent = String(labelN);
      svg.appendChild(t);
    }
  }

  // --- Center label: "x1000 RPM" ---
  const centerLabel = document.createElementNS(SVG_NS, 'text');
  centerLabel.setAttribute('x', cx);
  centerLabel.setAttribute('y', cy + 38);
  centerLabel.setAttribute('text-anchor', 'middle');
  centerLabel.setAttribute('fill', '#9aa0ab');
  centerLabel.setAttribute('font-size', 18);
  centerLabel.setAttribute('font-family', 'system-ui');
  centerLabel.textContent = 'x1000 RPM';
  svg.appendChild(centerLabel);

  // --- Needle (long, red, full diameter — tip and tail both visible) ---
  // We update x1/y1/x2/y2 directly each frame instead of using a rotation
  // transform. SVG's `transform="rotate(...)"` interacts with browser CSS
  // transform-origin in surprising ways for <line> elements; computing the
  // endpoints in viewBox coordinates is unambiguous and easier to reason about.
  const needleTip  = r - 22;
  const needleTail = 55;
  const needle = document.createElementNS(SVG_NS, 'line');
  needle.setAttribute('stroke', '#e8102a');
  needle.setAttribute('stroke-width', 9);
  needle.setAttribute('stroke-linecap', 'round');
  svg.appendChild(needle);

  // Hub cap
  const hub = document.createElementNS(SVG_NS, 'circle');
  hub.setAttribute('cx', cx); hub.setAttribute('cy', cy);
  hub.setAttribute('r', 12); hub.setAttribute('fill', '#c8cdd5');
  hub.setAttribute('stroke', '#e8102a'); hub.setAttribute('stroke-width', 3);
  svg.appendChild(hub);

  // Initialize needle to 0-RPM position
  setNeedle(0);
  function setNeedle(rpm) {
    const deg = Math.max(0, Math.min(270, (rpm / maxRpm) * 270));
    // polar() puts deg=0 at lower-left (7-8 o'clock) and deg=270 at lower-right
    // (4-5 o'clock); the needle tip should sit at the same dial position.
    const rad = (deg + 135) * Math.PI / 180;
    const cosA = Math.cos(rad), sinA = Math.sin(rad);
    const tipX  = cx + cosA * needleTip;
    const tipY  = cy + sinA * needleTip;
    const tailX = cx - cosA * needleTail;
    const tailY = cy - sinA * needleTail;
    needle.setAttribute('x1', tailX.toFixed(1));
    needle.setAttribute('y1', tailY.toFixed(1));
    needle.setAttribute('x2', tipX.toFixed(1));
    needle.setAttribute('y2', tipY.toFixed(1));
  }

  // Visual-only bounce: needle wiggles at idle (small) and at limiter (big)
  // to convey engine state. Doesn't affect physics — caller's rpm is unchanged.
  let frame = 0;
  const IDLE_THRESHOLD = 1500;
  return {
    update(rpm, gear) {
      frame++;
      let displayRpm = rpm;
      if (rpm < IDLE_THRESHOLD) {
        // Idle bounce: ~6Hz oscillation ± random noise
        displayRpm += Math.sin(frame * 0.42) * 22 + (Math.random() - 0.5) * 14;
      } else if (rpm >= redline) {
        // Limiter bounce: ~9Hz oscillation, larger amplitude, more chaotic
        displayRpm += Math.sin(frame * 0.92) * 160 + (Math.random() - 0.5) * 120;
      }
      setNeedle(displayRpm);
    },
  };
}
