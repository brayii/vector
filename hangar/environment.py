from copy import deepcopy
class HangarEnvironment:
 def __init__(self,config):
  for key in ('initial_state','sensors','actions','success'):
   if not isinstance(config.get(key),dict): raise TypeError(f'{key} is required')
  self.config=deepcopy(config);self.state=deepcopy(config['initial_state']);self.initial_resources=deepcopy(self.state.get('resources',{}));self.step=0;self.actions=[];self.observations=[]
 def observe(self):
  visible={name:{f:self.state.get(f) for f in sensor['fields']} for name,sensor in self.config['sensors'].items() if not sensor.get('available_when') or self._matches(sensor['available_when'])};result={'step':self.step,'observations':visible,'resources':deepcopy(self.state.get('resources',{}))};self.observations.append(deepcopy(result));return result
 def act(self,name):
  action=self.config['actions'].get(name)
  if not action:return self._record(name,False,'unknown_action',{})
  if not self._matches(action.get('requires',{})):return self._record(name,False,'requirements_not_met',{})
  if any(self.state.get('resources',{}).get(k,0)<v for k,v in action.get('cost',{}).items()):return self._record(name,False,'insufficient_resources',{})
  before=deepcopy(self.state)
  for k,v in action.get('cost',{}).items():self.state['resources'][k]-=v
  self.state.update(deepcopy(action.get('effects',{})));self.step+=1;changes={k:deepcopy(v) for k,v in self.state.items() if before.get(k)!=v};return self._record(name,True,'applied',changes)
 def _matches(self,conditions):return all(self.state.get(k)==v for k,v in conditions.items())
 def _record(self,name,success,result,changes):event={'step':self.step,'action':name,'success':success,'result':result,'changes':changes};self.actions.append(event);return deepcopy(event)
 def available_actions(self):return list(self.config['actions'])
 def mission_successful(self):return self._matches(self.config['success'])
 def episode(self):return {'actions':deepcopy(self.actions),'observations':deepcopy(self.observations),'initial_resources':deepcopy(self.initial_resources),'final_resources':deepcopy(self.state.get('resources',{})),'mission_success':self.mission_successful()}
