/** Generic Impossible Hangar transition kernel. Configurations supply rules; this
 * engine deliberately contains no winning sequence or puzzle-specific policy. */
export class HangarEnvironment {
  #configuration;
  #state;
  #step = 0;
  #history = [];

  constructor(configuration) {
    validateConfiguration(configuration);
    this.#configuration = structuredClone(configuration);
    this.#state = structuredClone(configuration.initialState);
  }

  observe() {
    const visible = {};
    for (const [name, sensor] of Object.entries(this.#configuration.sensors)) {
      if (!sensor.availableWhen || conditionsMatch(this.#state, sensor.availableWhen)) {
        visible[name] = sensor.fields.reduce((result, field) => ({ ...result, [field]: this.#state[field] }), {});
      }
    }
    return { step: this.#step, observations: visible, resources: structuredClone(this.#state.resources ?? {}) };
  }

  act(actionName) {
    const action = this.#configuration.actions[actionName];
    if (!action) return this.#record(actionName, false, 'unknown_action', {});
    if (!conditionsMatch(this.#state, action.requires ?? {})) return this.#record(actionName, false, 'requirements_not_met', {});
    if (!resourcesAvailable(this.#state.resources ?? {}, action.cost ?? {})) return this.#record(actionName, false, 'insufficient_resources', {});
    applyCost(this.#state.resources ?? {}, action.cost ?? {});
    const before = structuredClone(this.#state);
    Object.assign(this.#state, structuredClone(action.effects ?? {}));
    this.#step += 1;
    return this.#record(actionName, true, 'applied', changedFields(before, this.#state));
  }

  isMissionSuccessful() {
    return conditionsMatch(this.#state, this.#configuration.success);
  }

  history() { return structuredClone(this.#history); }

  #record(action, success, result, changes) {
    const event = { step: this.#step, action, success, result, changes };
    this.#history.push(event);
    return structuredClone(event);
  }
}

function conditionsMatch(state, conditions) { return Object.entries(conditions).every(([key, expected]) => Object.is(state[key], expected)); }
function resourcesAvailable(resources, cost) { return Object.entries(cost).every(([key, amount]) => Number(resources[key] ?? 0) >= Number(amount)); }
function applyCost(resources, cost) { for (const [key, amount] of Object.entries(cost)) resources[key] = Number(resources[key] ?? 0) - Number(amount); }
function changedFields(before, after) { const changes = {}; for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) changes[key] = structuredClone(after[key]); return changes; }
function validateConfiguration(configuration) {
  if (!configuration || typeof configuration !== 'object') throw new TypeError('configuration is required');
  for (const field of ['initialState', 'sensors', 'actions', 'success']) if (!configuration[field] || typeof configuration[field] !== 'object') throw new TypeError(`${field} is required`);
}

