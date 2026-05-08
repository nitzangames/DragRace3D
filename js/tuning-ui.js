import { balance } from './balance.js';
import { applyPartsToCar } from './parts.js';

export function renderTuningUI(parent, ownedCar, onChange) {
  const baseCar = balance.cars.find(c => c.id === ownedCar.carId);
  const withParts = applyPartsToCar(baseCar, ownedCar.parts, balance.parts);
  const tunable = withParts.transmissionTunable;

  parent.innerHTML = '';

  function slider(label, min, max, step, value, onInput, formatter) {
    const wrap = document.createElement('div');
    wrap.className = 'tune-row';
    wrap.innerHTML = `
      <div class="tune-label"><span>${label}</span><strong class="tune-value"></strong></div>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" />
    `;
    const valueEl = wrap.querySelector('.tune-value');
    const input = wrap.querySelector('input');
    valueEl.textContent = formatter(value);
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      valueEl.textContent = formatter(v);
      onInput(v);
    });
    parent.appendChild(wrap);
  }

  // Launch RPM
  slider('Launch RPM', baseCar.idleRpm, baseCar.redlineRpm, 50, ownedCar.tune.launchRpm,
    v => onChange({ ...ownedCar.tune, launchRpm: v }),
    v => `${v} RPM`);

  // Tire pressure (rear)
  slider('Tire Pressure (rear)', 22, 42, 1, ownedCar.tune.tirePressure[1],
    v => onChange({ ...ownedCar.tune, tirePressure: [ownedCar.tune.tirePressure[0], v] }),
    v => `${v} psi`);

  // Final drive
  slider('Final Drive Ratio', 2.8, 4.5, 0.05, ownedCar.tune.finalDrive,
    v => onChange({ ...ownedCar.tune, finalDrive: +v.toFixed(2) }),
    v => v.toFixed(2));

  // Gear ratios — only if tunable
  if (tunable) {
    for (let g = 0; g < 4; g++) {
      slider(`Gear ${g+1} ratio`, 0.7, 4.5, 0.05, ownedCar.tune.gearRatios[g],
        v => {
          const gr = [...ownedCar.tune.gearRatios];
          gr[g] = +v.toFixed(2);
          onChange({ ...ownedCar.tune, gearRatios: gr });
        },
        v => v.toFixed(2));
    }
  } else {
    const note = document.createElement('div');
    note.className = 'tune-note';
    note.textContent = 'Install Transmission T3+ to unlock gear-ratio tuning.';
    parent.appendChild(note);
  }
}
