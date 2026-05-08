/**
 * Updates a circular tachometer SVG. The SVG markup is owned by index.html;
 * this module updates the needle, RPM digits, gear text, and green/red zones.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Re-build the tach SVG inside the given parent element. */
export function buildTachSVG(parentEl, redline, greenBand) {
  parentEl.innerHTML = '';
  const W = 400, H = 400, cx = 200, cy = 200, r = 170;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('xmlns', SVG_NS);
  svg.style.width = '100%';
  svg.style.height = '100%';
  parentEl.appendChild(svg);

  const back = document.createElementNS(SVG_NS, 'circle');
  back.setAttribute('cx', cx); back.setAttribute('cy', cy);
  back.setAttribute('r', r + 8); back.setAttribute('fill', '#0e1116');
  back.setAttribute('stroke', '#33383f'); back.setAttribute('stroke-width', 3);
  svg.appendChild(back);

  function polar(deg, rad) {
    const a = (deg - 135) * Math.PI / 180;
    return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad];
  }
  function arcPath(a0, a1, rad) {
    const [x0, y0] = polar(a0, rad), [x1, y1] = polar(a1, rad);
    const large = (a1 - a0) > 180 ? 1 : 0;
    return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${rad} ${rad} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  const maxRpm = redline * 1.1;
  const redDeg = redline / maxRpm * 270;
  const greenStart = (redline - greenBand) / maxRpm * 270;

  function appendArc(d, color, w) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d); p.setAttribute('stroke', color);
    p.setAttribute('stroke-width', w); p.setAttribute('fill', 'none');
    p.setAttribute('stroke-linecap', 'round');
    svg.appendChild(p);
    return p;
  }
  appendArc(arcPath(0, 270, r), '#1a1d22', 28);
  appendArc(arcPath(0, redDeg, r), '#cdd2da', 18);
  appendArc(arcPath(greenStart, redDeg, r), '#22ee48', 18);
  appendArc(arcPath(redDeg, 270, r), '#ff2a18', 18);

  const needle = document.createElementNS(SVG_NS, 'line');
  needle.setAttribute('x1', cx); needle.setAttribute('y1', cy);
  needle.setAttribute('x2', cx); needle.setAttribute('y2', cy - (r - 18));
  needle.setAttribute('stroke', '#fff'); needle.setAttribute('stroke-width', 6);
  needle.setAttribute('stroke-linecap', 'round');
  needle.setAttribute('transform-origin', `${cx} ${cy}`);
  svg.appendChild(needle);

  const hub = document.createElementNS(SVG_NS, 'circle');
  hub.setAttribute('cx', cx); hub.setAttribute('cy', cy);
  hub.setAttribute('r', 14); hub.setAttribute('fill', '#222');
  hub.setAttribute('stroke', '#fff'); hub.setAttribute('stroke-width', 3);
  svg.appendChild(hub);

  const rpmDigits = textNode(svg, cx, cy - 30, '0', 56, '#fff', 'bold');
  textNode(svg, cx, cy + 8, 'RPM', 22, '#aaa');
  const gearDigit = textNode(svg, cx, cy + 60, '1', 64, '#fff', 'bold');
  textNode(svg, cx, cy + 88, 'GEAR', 18, '#aaa');

  return {
    update(rpm, gear) {
      const deg = Math.max(0, Math.min(270, rpm / maxRpm * 270));
      needle.setAttribute('transform', `rotate(${-135 + deg} ${cx} ${cy})`);
      rpmDigits.textContent = String(Math.round(rpm));
      gearDigit.textContent = String(gear);
    },
  };
}

function textNode(svg, x, y, text, size, color, weight) {
  const t = document.createElementNS(SVG_NS, 'text');
  t.setAttribute('x', x); t.setAttribute('y', y);
  t.setAttribute('text-anchor', 'middle');
  t.setAttribute('fill', color);
  t.setAttribute('font-size', size);
  if (weight) t.setAttribute('font-weight', weight);
  t.setAttribute('font-family', 'system-ui');
  t.textContent = text;
  svg.appendChild(t);
  return t;
}
