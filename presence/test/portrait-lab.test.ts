import test from 'node:test';
import assert from 'node:assert/strict';
import { ORIGINAL_PORTRAIT, portraitStyle, validatePortraitProposal } from '../lib/portrait-lab.ts';
test('portrait proposals are bounded and retain a rationale', () => { const proposal = validatePortraitProposal({ scale: 99, positionX: -4, brightness: 0, rationale: 'center me' }); assert.equal(proposal.scale, 2.2); assert.equal(proposal.positionX, 0); assert.equal(proposal.brightness, 0.55); assert.equal(proposal.rationale, 'center me'); });
test('portrait styles are deterministic and original remains available', () => { assert.match(portraitStyle(ORIGINAL_PORTRAIT).filter, /brightness\(0.72\)/); assert.equal(ORIGINAL_PORTRAIT.rationale, 'Original preserved settings.'); });
