import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENV_PRESETS } from '../js/env-presets.js';
import { ENV_PRESET_IDS } from '../js/constants.js';

test('all preset ids are present', () => {
  for (const id of ENV_PRESET_IDS) {
    assert.ok(ENV_PRESETS[id], 'missing preset: ' + id);
  }
});

test('each preset has all required fields', () => {
  const required = ['sun', 'ambient', 'ground', 'sky', 'fog', 'lightIntensity'];
  for (const id of ENV_PRESET_IDS) {
    for (const f of required) {
      assert.ok(f in ENV_PRESETS[id], `${id} missing ${f}`);
    }
    assert.equal(ENV_PRESETS[id].sky.length, 2, `${id} sky must be [top,bottom]`);
  }
});

test('night tracks are darker than the stadium baseline', () => {
  assert.ok(ENV_PRESETS.tokyo.lightIntensity < ENV_PRESETS.amphitheater.lightIntensity);
  assert.ok(ENV_PRESETS.vegas.lightIntensity < ENV_PRESETS.amphitheater.lightIntensity);
});

test('desert tracks are brighter than the stadium baseline', () => {
  assert.ok(ENV_PRESETS.redrock.lightIntensity > ENV_PRESETS.amphitheater.lightIntensity);
  assert.ok(ENV_PRESETS.saguaro.lightIntensity > ENV_PRESETS.amphitheater.lightIntensity);
});
