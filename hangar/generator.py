import hashlib,random
DIFFICULTY_LEVELS=('basic','standard','advanced')
def stable_seed(seed):return int.from_bytes(hashlib.sha256(str(seed).encode()).digest()[:8],'big')
def seed_split(seed):return 'held-out' if stable_seed(seed)%5==0 else 'training'
def generate_hangar(seed,difficulty='standard'):
 if difficulty not in DIFFICULTY_LEVELS:raise ValueError(f'difficulty must be one of {DIFFICULTY_LEVELS}')
 r=random.Random(stable_seed(seed));fault=r.choice(['relay','coolant','hydraulic']);exit_name=r.choice(['north_door','roof_gate','service_ramp']);field={'relay':'electrical_ready','coolant':'cooling_ready','hydraulic':'hydraulics_ready'}[fault];advanced=difficulty=='advanced';access_open=difficulty=='basic';battery=6 if access_open else 5 if advanced else r.randint(4,6)
 initial={'access_open':access_open,'electrical_ready':fault!='relay','cooling_ready':fault!='coolant','hydraulics_ready':fault!='hydraulic','navigation_ready':False,'exit_open':False,'airborne':False,'resources':{'battery':battery}}
 actions={'inspect_access':{'effects':{'access_open':True}},'repair_fault':{'requires':{'access_open':True},'cost':{'battery':1},'effects':{field:True}},'initialize_navigation':{'requires':{'electrical_ready':True,'cooling_ready':True,'hydraulics_ready':True},'cost':{'battery':1},'effects':{'navigation_ready':True}},'open_available_exit':{'requires':{'electrical_ready':True},'cost':{'battery':1},'effects':{'exit_open':True}},'launch':{'requires':{'navigation_ready':True,'exit_open':True},'cost':{'battery':1},'effects':{'airborne':True}}}
 if advanced:
  initial['exit_interlock_ready']=False;actions['release_exit_interlock']={'requires':{'navigation_ready':True},'cost':{'battery':1},'effects':{'exit_interlock_ready':True}};actions['open_available_exit']['requires']['exit_interlock_ready']=True
 return {'instance':{'seed':str(seed),'fault':fault,'exit':exit_name,'difficulty':difficulty},'initial_state':initial,'sensors':{'visual':{'fields':['access_open','exit_open','airborne']},'diagnostics':{'fields':[field,'navigation_ready']+(['exit_interlock_ready'] if advanced else []),'available_when':{'access_open':True}}},'actions':actions,'success':{'airborne':True}}
