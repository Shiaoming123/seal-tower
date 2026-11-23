import json,sys,statistics
from pathlib import Path
from collections import Counter,defaultdict
def load(f):
    return json.loads(Path(f).read_text(encoding='utf8'))
def key(row):
    return (row['leg'],row['mark'],row['branch'])
def chunks(p):
    chunks=[]
    for row in p['segments']:
        value=(row['stage'],*key(row)) if row['stage']=='road' else (row['stage'],row['leg'])
        if not chunks or value!=chunks[-1][0]:
            if chunks: chunks[-1][2]=row['t']
            chunks.append([value,[row],None])
        else: chunks[-1][1].append(row)
    return chunks
def data(p):
    roadlist=chunks(p)
    mins={}; raw=[]
    for identity,rows,finish in roadlist:
        start=rows[0]
        if not finish:continue
        if start['stage']=='turnoff':
            mins.setdefault('market',[]).append(finish-start['t']);continue
        if start['stage']!='road':continue
        changed=next((i for i in rows if i['selected']!=start['selected']),None)
        evt=next((e for e in p['events'] if e.get('kind')=='路面' and e['leg']==start['leg'] and e['branch']==start['branch'] and (start['branch'] or e['mark']==start['mark'])),None)
        raw.append({'leg':start['leg'],'mark':start['mark'],'branch':start['branch'],'ms':finish-start['t'],'fix_delay_ms':changed['t']-start['t'] if changed else None,'safe_ms_after_fix':finish-changed['t'] if changed else None,'choice':evt.get('choice','') if evt else '', 'notice':start['notice'],'stats':start['stats']})
    out={'hash':p['hash'],'legs_main_ms':[sum(x['ms'] for x in raw if x['leg']==i and not x['branch']) for i in range(4)],'branch_ms':[x['ms'] for x in raw if x['branch']],'market_ms':mins.get('market',[]),'road_slices':raw,'errors':p.get('errors'),'pitfall':p.get('failure'),'inputs':p.get('driveInputs'),'ms':p.get('ms')}
    if p.get('driveInputs'):
        out['haul_ms']=next(e['t'] for e in p['events'] if e.get('a')=='deliver')-p['contract']
        out['all_touches']=len(p['rawTouches']);out['safe_coast_median_ms']=statistics.median([x['ms'] for x in raw if x['choice']=='coast'])
        out['safe_after_fix_median_ms']=statistics.median([x['safe_ms_after_fix'] for x in raw if x['safe_ms_after_fix'] is not None])
    return out
if __name__=="__main__":
    for arg in sys.argv[1:]:
        p=load(arg);d=data(p);print(arg); print({k:v for k,v in d.items() if k not in ['hash','road_slices']});print([(row['mark'],row['ms'],row['fix_delay_ms']) for row in d['road_slices'][:6]])
