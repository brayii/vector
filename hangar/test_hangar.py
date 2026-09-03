import unittest
from hangar.agent import TabularAgent
from hangar.environment import HangarEnvironment
from hangar.evaluate import evaluate_episode
from hangar.generator import DIFFICULTY_LEVELS,generate_hangar,seed_split
from hangar.requirements import audit
class HangarTests(unittest.TestCase):
 def test_partial_observation_and_action_feedback(self):
  env=HangarEnvironment(generate_hangar('one'));self.assertNotIn('diagnostics',env.observe()['observations']);self.assertEqual(env.act('launch')['result'],'requirements_not_met');env.act('inspect_access');self.assertIn('diagnostics',env.observe()['observations'])
 def test_generation_reproducible_varied_and_disjoint(self):
  self.assertEqual(generate_hangar('x'),generate_hangar('x'));self.assertGreaterEqual(len({str(generate_hangar(i)['instance']) for i in range(30)}),6);train={i for i in range(100) if seed_split(i)=='training'};held={i for i in range(100) if seed_split(i)=='held-out'};self.assertTrue(train and held);self.assertFalse(train&held)
 def test_progressive_difficulty_changes_observation_and_action_complexity(self):
  basic=generate_hangar('level','basic');standard=generate_hangar('level','standard');advanced=generate_hangar('level','advanced');self.assertEqual(DIFFICULTY_LEVELS,('basic','standard','advanced'));self.assertTrue(basic['initial_state']['access_open']);self.assertFalse(standard['initial_state']['access_open']);self.assertIn('release_exit_interlock',advanced['actions']);self.assertIn('exit_interlock_ready',advanced['actions']['open_available_exit']['requires']);self.assertGreater(len(advanced['actions']),len(standard['actions']));self.assertEqual(generate_hangar('level','advanced'),advanced)
  with self.assertRaises(ValueError):generate_hangar('level','impossible')
 def test_feedback_penalizes_repeated_failure(self):
  env=HangarEnvironment(generate_hangar('m'));env.observe();env.act('launch');env.act('launch');result=evaluate_episode(env.episode());self.assertEqual(result['metrics']['repeated_failures'],1)
 def test_learned_policy_generalizes(self):
  agent=TabularAgent(seed=42);training=agent.train();evaluation=agent.evaluate();self.assertGreater(training['states'],10);self.assertGreaterEqual(evaluation['success_rate'],.8)
 def test_training_reproducible(self):
  first=TabularAgent(seed=9);second=TabularAgent(seed=9);self.assertEqual(first.train(200),second.train(200));self.assertEqual(first.evaluate(20),second.evaluate(20))
 def test_requirement_audit_is_complete_and_does_not_claim_full_solution(self):
  evidence=audit();self.assertEqual(set(evidence),{f'VH-{i:03d}' for i in range(1,54)});self.assertTrue(any(item['status']=='partial' for item in evidence.values()))
if __name__=='__main__':unittest.main()
