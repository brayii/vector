import test from 'node:test';
import assert from 'node:assert/strict';
import { HangarEnvironment } from './environment.js';

const configuration = () => ({
  initialState: { panelOpen: false, power: false, navigation: false, exitOpen: false, airborne: false, hiddenFault: 'relay', resources: { battery: 3 } },
  sensors: {
    visual: { fields: ['panelOpen', 'exitOpen', 'airborne'] },
    diagnostics: { fields: ['hiddenFault', 'power', 'navigation'], availableWhen: { panelOpen: true } },
  },
  actions: {
    inspectPanel: { effects: { panelOpen: true } },
    restorePower: { requires: { panelOpen: true }, cost: { battery: 1 }, effects: { power: true, hiddenFault: null } },
    initializeNavigation: { requires: { power: true }, cost: { battery: 1 }, effects: { navigation: true } },
    openExit: { requires: { power: true }, effects: { exitOpen: true } },
    launch: { requires: { navigation: true, exitOpen: true }, cost: { battery: 1 }, effects: { airborne: true } },
  },
  success: { airborne: true },
});

test('observations reveal only currently available sensor fields', () => {
  const environment = new HangarEnvironment(configuration());
  assert.equal(environment.observe().observations.diagnostics, undefined);
  environment.act('inspectPanel');
  assert.equal(environment.observe().observations.diagnostics.hiddenFault, 'relay');
});

test('actions expose failure and multi-system effects without prescribing a policy', () => {
  const environment = new HangarEnvironment(configuration());
  assert.equal(environment.act('launch').result, 'requirements_not_met');
  environment.act('inspectPanel');
  const result = environment.act('restorePower');
  assert.deepEqual(result.changes.hiddenFault, null);
  assert.equal(result.changes.power, true);
  assert.equal(environment.observe().resources.battery, 2);
});

test('mission success is derived only from configuration success conditions', () => {
  const environment = new HangarEnvironment(configuration());
  for (const action of ['inspectPanel', 'restorePower', 'initializeNavigation', 'openExit', 'launch']) environment.act(action);
  assert.equal(environment.isMissionSuccessful(), true);
});

