def evaluate_episode(episode):
 actions=episode['actions'];failures=[x for x in actions if not x['success']];seen=set();repeated=0
 for x in failures:
  key=(x['action'],x['result']);repeated+=key in seen;seen.add(key)
 fields={f'{sensor}.{field}' for snapshot in episode['observations'] for sensor,values in snapshot['observations'].items() for field in values};usage={k:v-episode['final_resources'].get(k,0) for k,v in episode['initial_resources'].items()};useful=sum(x['success'] and bool(x['changes']) for x in actions);metrics={'mission_success':episode['mission_success'],'action_count':len(actions),'failed_actions':len(failures),'repeated_failures':repeated,'useful_actions':useful,'information_fields_observed':len(fields),'resource_usage':usage};return {'metrics':metrics,'feedback':(100 if metrics['mission_success'] else 0)+useful*2+min(len(fields),10)-len(failures)*3-repeated*5-len(actions)*.25}
