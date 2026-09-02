import json,random
from .environment import HangarEnvironment
from .generator import generate_hangar,seed_split
class TabularAgent:
 def __init__(self,alpha=.25,gamma=.92,epsilon=.25,seed=1):self.alpha=alpha;self.gamma=gamma;self.epsilon=epsilon;self.random=random.Random(seed);self.values={}
 def train(self,episodes=1600,prefix='training'):
  seeds=[f'{prefix}-{i}' for i in range(episodes*3) if seed_split(f'{prefix}-{i}')=='training'][:episodes]
  for seed in seeds:self._run(seed,True)
  return {'episodes':len(seeds),'states':len(self.values)}
 def evaluate(self,instances=120,prefix='evaluation'):
  seeds=[f'{prefix}-{i}' for i in range(instances*8) if seed_split(f'{prefix}-{i}')=='held-out'][:instances];runs=[self._run(s,False) for s in seeds];success=sum(x['mission_success'] for x in runs);return {'instances':len(runs),'successes':success,'success_rate':success/len(runs),'mean_actions':sum(len(x['actions']) for x in runs)/len(runs)}
 def _run(self,seed,learning):
  env=HangarEnvironment(generate_hangar(seed))
  for _ in range(24):
   if env.mission_successful():break
   state=self._key(env.observe());available=env.available_actions();action=self._select(state,available,learning);event=env.act(action);next_state=self._key(env.observe())
   if learning:
    reward=(len(event['changes'])*2 if event['success'] else -4)+(100 if env.mission_successful() else -.2);old=self.values.get((state,action),0);best=max(self.values.get((next_state,a),0) for a in available);self.values[(state,action)]=old+self.alpha*(reward+self.gamma*best-old)
  return env.episode()
 def _select(self,state,actions,learning):
  if learning and self.random.random()<self.epsilon:return self.random.choice(actions)
  return max(actions,key=lambda a:self.values.get((state,a),0))
 def _key(self,observation):return json.dumps({'observations':observation['observations'],'resources':observation['resources']},sort_keys=True)
