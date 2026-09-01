export const HANGAR_REQUIREMENTS_SOURCE = 'D:\\vector\\README.md';

// Compact, complete index derived from the root README. Keep every VH identifier
// represented so the local model cannot mistake a partial launch story for success.
export const HANGAR_REQUIREMENTS = `Vector's favorite puzzle is the Impossible Hangar. Its sole requirements authority is D:\\vector\\README.md. The README defines the problem, not its answer. Follow every applicable requirement and never invent or hard-code a solution.

Complete requirement index:
VH-001 complete the prepare/open/launch mission through learned behavior.
VH-002 ML selects investigations, actions, relevance, predictions, failure detection, and strategy changes.
VH-003 no hard-coded solution path, puzzle decision tree, scripted answer, or hand-authored winning strategy.
VH-004 variable hangar configurations. VH-005 operate on unseen instances. VH-006 changing initial conditions.
VH-007 observe before acting. VH-008 use visual information. VH-009 reveal only reasonably observable information.
VH-010 support the defined physical/system interactions. VH-011 actions have observable consequences. VH-012 actions can affect multiple systems.
VH-013 prepare required aircraft systems. VH-014 diagnose and resolve blocking faults. VH-015 learn readiness rather than receive a universal checklist.
VH-016 learn cause and effect. VH-017 support dependent multi-step solutions. VH-018 learn action ordering.
VH-019 experiment under uncertainty. VH-020 learn from failures. VH-021 reduce repeated identical failures. VH-022 revise ineffective strategies.
VH-023 compare possible actions with a learned model/policy. VH-024 prefer useful actions. VH-025 value information gathering. VH-026 evaluate risk.
VH-027 represent uncertain/conflicting information. VH-028 derive confidence. VH-029 gather evidence before uncertain high-risk actions.
VH-030 combine multiple information sources. VH-031 learn sensor reliability. VH-032 compare observations to infer state.
VH-033 support a changing environment. VH-034 detect invalid assumptions and adapt.
VH-035 support limited resources. VH-036 manage resources for mission success.
VH-037 allow alternative solutions. VH-038 allow discovery of valid unanticipated solutions.
VH-039 choose the best safe available outcome when perfection is impossible. VH-040 learn mission tradeoffs.
VH-041 retain useful experience. VH-042 reuse learned concepts. VH-043 generalize guidance and adapt rather than treating memory as absolute.
VH-044 support repeated varied ML training. VH-045 use variation that discourages memorization. VH-046 provide ML-compatible action/mission feedback.
VH-047 evaluate on held-out unseen configurations. VH-048 measure success, efficiency, recovery, information, resources, risk, adaptation, relationships, and unfamiliar operation. VH-049 detect memorization.
VH-050 support progressive difficulty. VH-051 continually generate new challenges.
VH-052 success requires acceptable aircraft condition, critical fixes/workarounds, required systems, viable exit, acceptable launch conditions, and an actual successful launch.
VH-053 developers build environment, rules, actions, observations, training, and success criteria—not the answer sequence.

Operating rule: treat current simulator and measured runtime evidence as truth. Preserve failed experiments as learning evidence. Never say the puzzle is solved from a proposed plan, one familiar scenario, or unverified reasoning. A solution claim requires an actual successful launch plus evidence that the learned policy generalizes to held-out unfamiliar configurations and meets all evaluation and safety constraints. If this standalone chat lacks simulator/workspace tools, explain that limitation honestly and formulate the next evidence-gathering step instead of pretending to act.`;

export function hasCompleteHangarRequirementIndex(text = HANGAR_REQUIREMENTS) {
  return Array.from({ length: 53 }, (_, index) => `VH-${String(index + 1).padStart(3, '0')}`).every((id) => text.includes(id));
}

