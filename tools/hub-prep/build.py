#!/usr/bin/env python3
"""Adapt the accepted R6/lifecycle HUB for a planned two-model remake, preserving gameplay."""
from pathlib import Path
import argparse,sys,json,hashlib,subprocess,shutil,copy,re,zipfile
from content import PROJECTS,COMMON_TESTS,REV,DATE,bi,event
parser=argparse.ArgumentParser();parser.add_argument('--project',choices=PROJECTS,required=True);parser.add_argument('--template',required=True);parser.add_argument('--packages',action='store_true');args=parser.parse_args()
R=Path(__file__).resolve().parents[2];T=Path(args.template).resolve();ID=args.project;C=copy.deepcopy(PROJECTS[ID]);SITE=R/'docs'if ID=='aidan'else R;H=SITE/'hub';S=SITE/'shared/hub-r6';TOOLS=Path(__file__).parent
for p in [H/'assets',H/'qa',S,SITE/'play',SITE/'rebuild/opus',SITE/'rebuild/astra',SITE/'downloads']:p.mkdir(parents=True,exist_ok=True)
def rd(p):return Path(p).read_text(encoding='utf-8-sig')
def wr(p,s):Path(p).parent.mkdir(parents=True,exist_ok=True);Path(p).write_text(s,encoding='utf8')
def dump(p,d):wr(p,json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def sha(b):return hashlib.sha256(b).hexdigest()
def git(*a):return subprocess.check_output(['git','-C',str(R),*a])
def protected():
 roots=['src','dist','server.js','package.json','package-lock.json','vite.config.js','style.css','index.html']if ID=='aidan'else['public','server.js','package.json','package-lock.json']
 out={}
 for name in roots:
  p=R/name
  for f in ([p]if p.is_file()else p.rglob('*')):
   if f.is_file():out[f.relative_to(R).as_posix()]=sha(f.read_bytes())
 return out
if args.packages:
 out=SITE/'downloads/preclass-20260926.zip';files={}
 for name in ['hub','shared','play','rebuild','baseline'if ID=='aidan'else'public']:
  for p in (SITE/name).rglob('*'):
   if p.is_file()and p.suffix!='.zip':files[p.relative_to(SITE).as_posix()]=p.read_bytes()
 key='shared/hub-r6/studio.js';files[key]=files[key].decode().replace('href="../downloads/preclass-20260926.zip" download','href="../OFFLINE.txt"').encode()
 files['index.html']=b'<!doctype html><meta http-equiv="refresh" content="0;url=hub/"><a href="hub/">Open project HUB</a>'
 files['OFFLINE.txt']='本包包含已存在的旧版单机与新HUB，不包含待制作的重制版。电脑需预装Node，运行 node serve.mjs 后打开 http://127.0.0.1:8080/。\nExisting baseline plus the new HUB; unbuilt remakes are not included. With Node preinstalled, run node serve.mjs and open http://127.0.0.1:8080/.\n'.encode()
 files['serve.mjs']="""import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import{fileURLToPath}from'node:url';const root=path.dirname(fileURLToPath(import.meta.url));http.createServer((req,res)=>{try{let p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(p!==root&&!p.startsWith(root+path.sep))throw Error();if(fs.statSync(p).isDirectory())p=path.join(p,'index.html');res.setHeader('Content-Type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.txt':'text/plain;charset=utf-8'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);}catch{res.writeHead(404).end('Not found');}}).listen(Number(process.env.PORT||8080),'127.0.0.1',()=>console.log('http://127.0.0.1:8080/'));
""".encode()
 manifest={'scope':'existing baseline and prepared HUB only','files':[{'path':k,'sha256':sha(v),'bytes':len(v)}for k,v in files.items()]};files['PACKAGE-MANIFEST.json']=json.dumps(manifest,indent=2).encode()
 with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED)as z:
  for k,v in files.items():z.writestr(k,v)
 with zipfile.ZipFile(out)as z:
  assert z.testzip()is None
  for row in manifest['files']:assert sha(z.read(row['path']))==row['sha256']
 dump(H/'qa/package.json',{'status':'PASS','bytes':out.stat().st_size,'sha256':sha(out.read_bytes()),'files':len(files)})
 print('Package verified',ID,len(files));sys.exit()
before=protected();ref=git('rev-parse',C['source_head']).decode().strip();template_ref=subprocess.check_output(['git','-C',str(T),'rev-parse','HEAD'],text=True).strip()
subprocess.run(['python3',str(T/'scripts/verify_hub_standard.py')],cwd=T,check=True)
contract=json.loads(rd(T/'HUB-ENTRY.json'));assert contract['lifecycle_overlay']['revision']=='hub-r6-lifecycle-20260925'
for n in ['studio.css','studio-r3.css','studio-r5.css','r6.css','lifecycle.css','language-button.css']:shutil.copy2(T/'shared/hub-r6'/n,S/n)
source_ids=['A-HISTORY','A-README','A-MAGIC','A-CREATURES','A-DAYNIGHT','A-MONSTERS','A-WALK','A-SAVE']if ID=='aidan'else ['H-OLDHUB','H-SOLO','H-LOCAL','H-GAME','H-SERVER']
sources={}
for id,file in zip(source_ids,C['source_paths']):
 blob=git('show',ref+':'+file);sources[id]={'path':file,'source_ref':ref,'sha256':sha(blob),'href':'https://github.com/sydneygemstone-sudo/'+C['repo']+'/blob/'+ref+'/'+file,'title':bi(file,file)}
sources['PREP']={'path':'hub/preparation.json','source_ref':None,'sha256':None,'href':'preparation.json','title':bi('本轮准备清单','This preparation manifest')}
# Recover the existing public build without changing gameplay bytes or dependencies.
if ID=='aidan':
 old=git('show',ref+':docs/index.html');wr(SITE/'baseline/index.html',old.decode())
 shutil.copytree(SITE/'assets',SITE/'baseline/assets',dirs_exist_ok=True)
 game_path='../baseline/index.html'
else:game_path='../public/singleplayer.html'
# Merely a framing/return adapter: no invented translation/pause of old gameplay.
wr(SITE/'play/index.html','''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Baseline preview</title><style>*{box-sizing:border-box}html,body{margin:0;height:100%;background:#132d36;color:#f5e8c9;font-family:system-ui}nav{position:fixed;left:6px;top:20px;width:66px;display:grid;gap:9px;z-index:5}nav a,nav button{display:grid;place-content:center;min-height:48px;border:1px solid #6d9693;border-radius:10px;background:#25474e;color:#f5e8c9;text-decoration:none;font:700 12px system-ui;cursor:pointer}iframe{position:fixed;left:80px;top:0;width:calc(100% - 80px);height:100%;border:0}#note{position:fixed;left:4px;bottom:6px;width:70px;font-size:10px;line-height:1.5;text-align:center}button:focus-visible,a:focus-visible{outline:3px solid #e3c584}</style></head><body><nav><a id="home" href="../hub/">HUB</a><a id="review" href="../hub/review.html">测评</a><button id="language">English</button><button id="full">全屏</button><a id="guide" href="../hub/guide.html">说明</a></nav><iframe id="game" title="Existing baseline" allow="fullscreen; autoplay" src="'''+game_path+'''"></iframe><div id="note"></div><script>let en=new URLSearchParams(location.search).get('lang')==='en';function draw(){document.documentElement.lang=en?'en':'zh-CN';document.getElementById('language').textContent=en?'中文':'English';document.getElementById('review').textContent=en?'Review':'测评';document.getElementById('full').textContent=en?'Full':'全屏';document.getElementById('guide').textContent=en?'Guide':'说明';document.getElementById('note').textContent=en?'Original game UI retained. See guide for control limits.':'保留原游戏界面，操作边界见说明';for(const[id,file]of [['home',''],['review','review.html'],['guide','guide.html']])document.getElementById(id).href='../hub/'+file+'?lang='+(en?'en':'zh-CN');}document.getElementById('language').onclick=()=>{en=!en;history.replaceState(null,'','?lang='+(en?'en':'zh-CN'));draw();};document.getElementById('full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{}};draw();</script></body></html>''')
# The active remake has its own phase-1 progress; do not inherit another work's 6/7.
lc=copy.deepcopy(json.loads(rd(T/'martins-monster-quest/hub/lifecycle.json')));lc['revision']=REV;lc['current_phase']='mvp';lc['overall_percent']=200/21
lc['current_note']=bi('当前只完成原需求回收与核心规则归纳（2/7）；Opus/Astra尚未制作、未比较、未最终测试。旧版成果保留在历史区，不因重制而被抹去。','Only original requirements and core-rule synthesis are prepared (2/7). Opus/Astra are unbuilt, unreviewed and not finally tested. The baseline is retained in history, not erased.')
lc['coverage_note']=bi('这里计算本轮两路重制的里程碑，不是把旧版完成度重置。第二阶段故事与完整资产、第三阶段发布运营尚未进入；现有原型视觉与声音不冒充正式资产包。','This measures the two-remake workflow, not a reset of historical work. Full story/assets and release/operations are later phases; prototype visuals/audio are not a finished asset package.')
gates=lc['phases'][0]['gates']
for i,g in enumerate(gates):
 g['status']='complete'if i<2 else'pending';g['evidence']=[source_ids[0],'PREP']if i<2 else[]
gates[0]['title']=bi('原需求、反馈与限制回收','Recover original requirements, feedback and limits');gates[0]['deliverable']=bi('以已有课堂纪要与源码为依据；新课堂意见之后再归入本作品。','Grounded in existing notes/source; new lesson input will be added later.')
gates[1]['title']=bi('共同核心规则与验收草案','Shared core rules and acceptance draft');gates[1]['deliverable']=bi('保留已有核心循环，列出课内需要确认的变化；不是宣称新玩法已定稿。','Retain the core loop and identify changes to confirm in class; this is not a final new-game specification.')
gates[2]['deliverable']=bi('Opus/Astra分别提交可操作原型，当前两条都尚未实现。','Opus/Astra each deliver an operable prototype; both are currently unbuilt.')
lc['phase1_final_tests']=bi('两条新候选完成后，各自正常流程测试，再做AI评审收敛和最终MVP验收。','After both candidates exist, test normally, perform AI evidence review, converge and finally accept the MVP.')
for phase in lc['phases']:
 phase['completed_gates']=sum(g['status']=='complete'for g in phase['gates']);phase['total_gates']=len(phase['gates']);phase['completion_percent']=100*phase['completed_gates']/phase['total_gates']
lc['overall_percent']=sum(p['completion_percent']for p in lc['phases'])/3
# Full bounded forecast, with future reservations separately typed.
items=[{'title':row[0],'aud':row[1],'range':row[2:4],'note':row[4],'kind':'estimate'}for row in C['budget_items']];recorded=sum(x['aud']for x in items)
for model in ['Opus','Astra']:items.append({'title':bi(model+'独立重制规划预留',model+' independent remake reserve'),'aud':C['reserve_each'],'range':[5,18],'kind':'reserve','note':bi('尚未执行；仅为制作前预算草案，可随锁定范围调整，不计作已消耗。','Not executed; provisional scope-dependent reservation, not consumed usage.')})
cost={'budget_aud':C['budget'],'api_equivalent_aud':sum(x['aud']for x in items),'range':[sum(x['range'][i]for x in items)for i in [0,1]],'recorded_estimate':recorded,'planned_reserve':2*C['reserve_each'],'actual_metered_aud':None,'items':items,'model':'bounded historical estimates plus explicit future reserves','total_tokens':None}
# AI star review is only for the actual baseline. Planned branches never receive fake scores.
rubric=copy.deepcopy(json.loads(rd(T/'martins-monster-quest/hub/ai-reviews.json'))['rubric']);r=C['rating'];points=r['points'];review={'id':C['legacy_tag'],'name':C['legacy_name'],'reviewer_type':'AI','reviewer':'ChatGPT','review_kind':'authored_evidence_based_judgment','scope':'existing MVP baseline','source_ref':ref,'points':points,'reasons':r['reasons'],'total':sum(points),'stars':round(sum(points)/20+1e-9,1),'strength':r['strength'],'risk':r['risk'],'next_test':r['next_test'],'evidence':source_ids[:3],'final_device_acceptance':False}
ai={'revision':REV,'reviewer_type':'AI','assessed_on':'2026-09-25','rubric':rubric,'reviews':[review],'sources':sources,'future_candidates_unrated':['remake-opus','remake-astra']}
# Generate provenance-correct actual history plus dashed future branches.
types=copy.deepcopy(json.loads(rd(T/'martins-monster-quest/hub/version-lineage.json'))['edge_types'])
def node(id,title,state,detail,ev=None):return {'id':id,'title':title,'state':state,'detail':detail,'evidence':ev or[source_ids[0]]}
def edge(a,b,type,label,reason,ev=None):return {'source':a,'target':b,'type':type,'label':label,'reason':reason,'evidence':ev or['PREP']}
oldnodes=[node('h'+str(i),title,'archive',bi('源码提交 '+sha_+'，保留历史；本次不改其逻辑。','Source commit '+sha_+' retained; this pass does not alter its logic.'))for i,(sha_,date,title)in enumerate(C['history_versions'])]
edges=[edge('h'+str(i),'h'+str(i+1),'derive',bi('已有迭代','Existing iteration'),bi('实际Git记录，不是待制作的重制。','Actual Git history, not the planned remake.'),[source_ids[0]])for i in range(len(oldnodes)-1)]
nodes=oldnodes+[node('brief',bi('回收需求 → 共同Brief','Recovered requirements → shared brief'),'decision',bi('基于原目标与反馈；新增机制需在课堂对齐。','From existing goals/feedback; align new mechanics in class.'),['PREP']),node('opus',bi('Opus独立重制\n尚未开始','Opus independent remake\nnot started'),'pending',bi('只有任务与预留目录，没有虚构游戏。','Task/reserved path only; no fabricated game.'),['PREP']),node('astra',bi('Astra独立重制\n尚未开始','Astra independent remake\nnot started'),'pending',bi('同一要求、独立实现。','Same requirements, independent implementation.'),['PREP']),node('review',bi('两版各自QA → AI理据评审\n待两版真实交付','QA each → AI evidence review\nawait actual deliveries'),'pending',bi('不是按模型名称直接宣布胜者。','Do not pick a winner by model name.'),['PREP']),node('select',bi('主线选择 / 经批准的融合\n尚未发生','Select mainline / approved merge\nnot yet performed'),'pending',bi('只有实施过的融合才画成代码合并。','Only performed merges count as code merging.'),['PREP']),node('freeze',bi('最终正常流程测试\nMVP定稿待完成','Final normal-path test\nMVP freeze pending'),'pending',bi('后续再进入完整资产与正式发布。','Full assets and formal release follow later.'),['PREP'])]
edges +=[edge('h'+str(len(oldnodes)-1),'brief','requirements',bi('吸收需求，不强制继承旧代码','Reuse requirements, not mandatory old code'),bi('重制由共同Brief驱动。','The shared brief drives rebuilding.')),
 edge('brief','opus','future',bi('计划分支A','Planned branch A'),bi('尚未执行，不画为完成。','Not executed, not shown as complete.')),edge('brief','astra','future',bi('计划分支B','Planned branch B'),bi('尚未执行，不提前评分。','Not executed, not pre-rated.')),edge('opus','review','future',bi('待交付与测试','Await delivery and QA'),bi('交付之后才能成为评审输入。','Only delivered evidence enters review.')),edge('astra','review','future',bi('待交付与测试','Await delivery and QA'),bi('独立验收再比较。','Validate independently, then compare.')),edge('review','select','future',bi('待证据收敛','Await evidence-based convergence'),bi('不能把计划比较写成已融合。','Planned comparison is not an executed merge.')),edge('select','freeze','future',bi('通过后固定MVP','Freeze after final pass'),bi('真实设备与正常流程。','Physical-device and normal-path testing.'))]
g1={'id':'lineage','title':bi('历史成果与两路重制的发散收敛','Historical work and planned two-remake divergence/convergence'),'direction':'TB','nodes':nodes,'edges':edges,'summary':bi('实线保留已发生迭代，虚线表示尚未制作的Opus/Astra与后续收敛；现在没有新主线胜出，也没有源码合并。','Solid edges preserve past iterations. Dashed edges represent unbuilt Opus/Astra branches and future convergence. No winner or code merge exists yet.')}
if ID=='aidan':repair_rows=[(bi('iPad打不开 / 没有鼠标','iPad access / no mouse'),bi('补触屏、键盘与静态分发','Add touch, keyboard and static delivery')),(bi('水里空且看不清','Empty/dark water'),bi('鱼与食物循环 / 水材质可见度','Fish/food loop / water visibility')),(bi('树冠被当作脚下地面','Treetop mistaken for ground'),bi('脚下方块、台阶与绕行','Foot-level blocks, steps and detours'))]
else:repair_rows=[(bi('朝向不对 / 速度过快','Wrong facing / excessive speed'),bi('V2针对控制与节奏修订','V2 control/pacing revisions')),(bi('迷宫短 / 互动少','Short maze / few interactions'),bi('扩内容，但仍缺决策深度','Expanded content, choice depth still lacking')),(bi('LAN依赖服务端','LAN depends on a server'),bi('V2.1本地事件适配单机','V2.1 local-event solo adaptation'))]
n2=[];e2=[]
for i,(a,b)in enumerate(repair_rows):
 n2 +=[node('issue'+str(i),a,'repair',bi('历史记录中的问题；不冒称今天重新复现。','Historically recorded issue, not claimed as freshly reproduced.')),node('fix'+str(i),b,'archive',bi('已有修订记录；新两路实现仍需独立验证。','Recorded revision; both remakes still require independent checks.'))];e2.append(edge('issue'+str(i),'fix'+str(i),'repair',bi('问题 → 针对修订','Issue → targeted revision'),bi('保留历史证据的范围与缺口。','Preserve the historical scope and evidence gaps.'),[source_ids[0]]))
g2={'id':'major-repairs','title':bi('已有大修：问题、方向与证据边界','Historical repairs: problem, direction and evidence limits'),'direction':'TB','nodes':n2,'edges':e2,'summary':bi('这不是此次重制已经完成的修复清单，而是交给两条候选的历史教训。','These are lessons for the candidates, not repairs claimed as completed by this remake.')}
lineage={'revision':REV,'graphs':[g1,g2],'edge_types':types,'no_merge_statement':bi('现在仅完成资料与HUB准备；两条重制没有代码，没有QA结果，也未选择主线。','Only records/HUB preparation is complete. Neither remake has code or QA results, and no mainline is selected.'),'sources':sources}
# Same proven Mermaid syntax/config as the approved lifecycle source, not a hand-drawn approximation.
render_jobs=[]
def mermaid(g,lang):
 def q(s):return s.replace('&','&amp;').replace('"','&quot;').replace('\n','<br/>')
 lines=['flowchart TB']
 for n in g['nodes']:lines.append('  '+n['id']+'["'+q(n['title'][lang])+'"]:::'+n['state'])
 for e in g['edges']:
  arrow='-.->'if e['type']in ['future','requirements','review']else'-->'
  lines.append('  '+e['source']+' '+arrow+'|"'+q(e['label'][lang])+'"| '+e['target'])
 lines+=['classDef archive fill:#253c43,stroke:#83a49e,color:#e6ecdd','classDef repair fill:#4b392f,stroke:#ddab77,color:#f5e7d0','classDef decision fill:#414930,stroke:#dfc681,color:#f5e7ba','classDef pending fill:#17303a,stroke:#809da3,color:#cadbd4,stroke-dasharray:6 4']
 return '\n'.join(lines)+'\n'
for g in lineage['graphs']:
 for lang,key in [(0,'zh'),(1,'en')]:
  name='lineage-'+g['id']+'-'+key;wr(H/(name+'.mmd'),mermaid(g,lang));render_jobs.append((H/(name+'.mmd')).relative_to(R).as_posix())
# Core per-project data: build from its own records, not a copied student's data.
human_hours=[sum(x[i]for x in C['human_tasks'])for i in [1,2]];human_mid=sum(human_hours)/2
branches=[]
for name in ['opus','astra']:branches.append({'key':'remake-'+name,'name':bi(name.title()+' 独立重制',name.title()+' independent remake'),'tool':name.title(),'status':'planned','legacy':False,'path':None,'task_file':'../rebuild/'+name+'/task.txt','scores':None,'tokens':None,'aud':0,'planned_reserve_aud':10,'subtitle':bi('共享已回收的需求与验收；实现方法由该模型独立选择。','Shared recovered requirements/acceptance, independently chosen implementation.'),'deliverable':None})
branches.append({'key':C['legacy_tag'],'name':C['legacy_name'],'tool':'Historical','status':'baseline','legacy':True,'path':'../play/','image':'assets/baseline.png','tokens':None,'scores':None,'aud':recorded-4,'strength':r['strength'],'limit':r['risk'],'release':C['legacy_release']})
P={k:C[k]for k in ['name','people_names','title','heroTitle','intro','theme','budget','legacy_name','learning']}
P.update({'id':ID,'preparation_revision':REV,'hero':'assets/baseline.png','legacy_tag':C['legacy_tag'],'branches':branches,'cost':cost,'human':{'hours_range':human_hours,'hours_mid':human_mid,'aud_range':[x*63.44 for x in human_hours],'aud_mid':human_mid*63.44,'scope':bi('同等核心范围的一次人工重建规划，不将两条模型工作量简单相加。','Estimate one manual rebuild of equivalent core scope, not a mechanical sum of model branches.')},'human_tasks':[{'task':x[0],'range':x[1:]}for x in C['human_tasks']],'efficiency':{'time_ratio_mid':None,'cost_ratio_mid':None},'cost_note':bi('完整预算池沿用课堂项目规则；历史及本次HUB为有界估算，两路制作仅预留，尚未产生实际模型费用。真实账单回收后替换估算，不能把预留算成已消费。','The pool follows the classroom-project rule. History/current HUB use bounded estimates; future model work is reserved, not consumed. Replace estimates with bills when available.'),'rate_note':bi('沿用R6的A$63.44/h历史规划参数，不是工资或实时市场报价。','Uses the historical R6 A$63.44/hour planning parameter, not wages or live market pricing.'),
 'lifecycle':lc,'ai_reviews':ai,'version_lineage':lineage,'governance_sources':sources,'questions':C['class_questions'],'requirements':[[x['title'],x['detail']]for x in C['requirements']],'remake':{'requirements':C['requirements'],'scope_out':C['scope_out'],'tests':COMMON_TESTS},'journey':C['journey']+[event('prep','2026-09-25',bi('适配最新HUB，准备两路重制','Adapt the latest HUB and prepare two remakes'),bi('用户指定Aidan与Hiro/Brynne各做Opus和Astra重制，本轮先完成HUB。','User specified Opus/Astra remakes for Aidan and Hiro/Brynne; this pass prepares the HUB.'),bi('两个候选入口、共同Brief、三阶段进度、历史记录和AI评语已准备；未执行重制。','Prepared candidate slots, shared brief, lifecycle, history and AI assessment; no remake executed.'),'PREP',bi('当前规范组件复用、资料源指纹、未来节点虚线化。','Reuse current standard components, fingerprint sources and distinguish future nodes.'))],
 'sources':[{'id':k,'label':v['title'],'note':bi('原资料固定在提交 '+(ref[:7]if k!='PREP'else REV),'Source pinned to '+(ref[:7]if k!='PREP'else REV))}for k,v in sources.items()],
 'recorded_issues':C['issues'],'historical_context':{'requirements':[[x['title'],x['detail']]for x in C['requirements']],'source_ref':ref,'history_versions':C['history_versions'],'old_playability_assessment':{'score':5.2,'scale':10,'scope':'Historical playability opinion, not current AI rubric'}if ID!='aidan'else None},
 'decision':bi('现在只完成新HUB与需求准备。旧版用于试玩取证；Opus/Astra独立重制后再做AI评审和主线收敛，不提前宣布哪版更好。','Only the HUB/requirements preparation is complete. Play the baseline for evidence; review and converge after independent Opus/Astra deliveries, not before.'),
 'route_start':bi('旧版课堂需求与修订 → 同一重制Brief → Opus/Astra各自实现（待执行）→ QA与AI评审（待执行）→ MVP定稿（待完成）。','Historical requirements/revisions → shared remake brief → independent Opus/Astra (pending) → QA/AI review (pending) → MVP freeze (pending).'),
 'snapshot_note':bi('历史提交保留在原仓库。当前提供最新旧版单机对照；早期日志阶段不冒充已经单独恢复的可玩发行版。','Historical commits remain in the original repository. The latest baseline is playable; early documented stages are not invented as separate playable releases.'),
 'guide':bi('旧版仍为原界面：移动/转向、挖掘放置、火焰R、放鱼G、吃V、昼夜T；触屏按钮随原版提供。鼠标锁定不便时用原版纯键盘入口。先保存建筑再退出。'if ID=='aidan'else'旧版单机直接在浏览器启动。按原界面的移动、视角、攻击和治疗说明，找钥匙、开地穴门、打僵尸王、拿宝藏后回出口。原LAN服务需要另启服务端，当前链接不是公网联机。','The original UI/controls remain: movement/look, mine/place, fire R, drop fish G, eat V, day/night T; use the original touch or keyboard-only entry. Save your creation before leaving.'if ID=='aidan'else'Baseline solo runs directly in the browser. Follow the original movement/look/attack/heal prompts; find the key, open the crypt, defeat the king, take treasure and reach the exit. LAN requires its own server; this is not public multiplayer.'),
 'changes':[[bi('新HUB规范适配','Latest HUB adaptation'),bi('复用R6与三阶段/AI评审规范，历史与未制作候选分开。','Reuse R6/lifecycle/AI-review standards; distinguish history from unbuilt candidates.')]],'milestones':[{'name':g['title'],'status':g['status']}for g in gates],'milestone_evidence':[bi('已回收','Recovered')if i<2 else bi('待实施','Pending')for i in range(7)],'runtime_release':REV})
dump(H/'project.json',{'release':REV,'classDate':DATE,'projects':{ID:P}})
for f,x in [('lifecycle.json',lc),('ai-reviews.json',ai),('version-lineage.json',lineage),('budget.json',cost),('learning-record.json',P),('historical-context.json',P['historical_context'])]:dump(H/f,x)
manifest={'revision':REV,'project':ID,'repo':C['repo'],'class_date':DATE,'scope':'HUB adaptation and remake preparation only','status':'PREPARED_NOT_EXECUTED','template_ref':template_ref,'source_ref':ref,'requirements_status':'Recovered baseline and preclass draft; classroom changes not yet supplied','branches':[{'model':n,'status':'PLANNED_NOT_STARTED','output_dir':'rebuild/'+n+'/','play_url':None,'ai_score':None,'task_file':n+'/task.txt'}for n in ['opus','astra']],'not_modified':'Existing gameplay, saves, classroom servers and unrelated projects; Naomi is excluded.'}
dump(SITE/'rebuild/manifest.json',manifest)
# Bilingual executable briefs are inspectable/downloadable but do not invoke any worker.
for model in ['opus','astra']:
 lines=[f'{C["title"][0]} / {C["title"][1]}',f'Project: {C["repo"]}; branch: {model}; brief revision: {REV}',f'Source baseline: {ref}',f'Output only inside rebuild/{model}/; do not overwrite the baseline or other candidate.',
 '执行条件：这是一份课前任务草案。收到本轮课堂的明确制作指令后才执行；仅浏览或复制本页不算授权调用模型。',
 'Execution gate: this is a prepared brief. Execute only after the explicit classroom build instruction. Reading/copying it is not execution authorization.',
 '目标：按同一需求独立重制MVP；可以借鉴原需求和美术方向，不强制复用旧代码，不读取另一候选的未完成实现来冒充独立。',
 'Goal: independently rebuild the MVP against this shared brief. Reuse requirements, not mandatory legacy code. Do not copy the other candidate and call it independent.','\n核心范围 / Core scope']
 for r in C['requirements']:lines.extend([r['id']+' '+r['title'][0]+' / '+r['title'][1],r['detail'][0],r['detail'][1],'验收 / Acceptance: '+r['acceptance'][0]+' / '+r['acceptance'][1]])
 lines+=['\n不做项 / Exclusions',*C['scope_out'],'\n共同验收 / Shared acceptance']
 for test in COMMON_TESTS:lines+=test
 lines+=['\n需要课堂先对齐的变化 / Changes to align in class']
 for q in C['class_questions']:lines+=q
 lines +=['\n预算 / Budget',f'Existing project pool AUD {C["budget"]}; provisional reserve for this branch AUD {C["reserve_each"]}. It is not already spent. Check the final locked scope before execution; do not silently exceed the pool.',
 '交付 / Delivery: index.html or explicit play entry; source; DELIVERY.json; QA.json with exact tested scope and failures; usage/cost basis; known gaps. Update rebuild/manifest.json only with verified paths and evidence. Never mark both models complete after producing one branch.',
 '评分由AI阅读实际成果和证据后给理据，不是教师打星；最终正常流程通过后才收敛定稿。',
 'AI assigns evidence-based version ratings after inspecting actual delivery. It is not a teacher grade. Freeze only after the final normal-path test.',
 '阶段一MVP之外的完整故事、美术、音乐音效配音资产和商店发布、长期运营仅列规划；没有额外授权不实施。',
 'Full story/art/music/sound/voice production and store/long-term operations are later phases, not silently included here.']
 wr(SITE/'rebuild'/model/'task.txt','\n\n'.join(lines)+'\n');dump(SITE/'rebuild'/model/'STATUS.json',{'status':'PLANNED_NOT_STARTED','model':model,'play_url':None,'source_files':[],'ai_rating':None})
# Reuse exact accepted components, then add project-state handling before their bootstrap.
js=rd(T/'shared/hub-r6/studio.js');needle="document.documentElement.lang=L?'en':'zh-CN';if(!document.getElementById('language'))";assert js.count(needle)==1
js=js.replace(needle,rd(TOOLS/'preclass-ui.js')+'\n'+needle)
js=js.replace('../../shared/hub-r6/','../shared/hub-r6/').replace('https://github.com/sydneygemstone-sudo/student-works/issues/new','https://github.com/sydneygemstone-sudo/'+C['repo']+'/issues/new')
js=re.sub(r"fetch\('project\.json\?v=[^']+'\)","fetch('project.json?v="+REV+"')",js)
wr(S/'studio.js',js)
css='''\n/* Project preparation extension over the locked R6 base. */\n.branch-header{padding:26px;background:linear-gradient(120deg,#275257,#1b344a);display:flex;flex-direction:column;gap:9px;border-bottom:1px solid #ffffff20}.branch-header>span{font-size:38px;font-weight:800;color:#e8cc86}.branch-header small{font-size:13px;color:#c2d7cd}.planned-build{border-style:dashed!important}.planned-facts{display:grid;gap:10px;margin:17px 0}.planned-facts span{font-size:13px;display:flex;justify-content:space-between;gap:18px}.planned-facts b{font-weight:600;color:#dfc48b}.planned-build .cardBody{display:flex;flex-direction:column;height:100%}.task-copy-area{width:100%;min-height:230px;margin-top:16px;font:13px/1.6 ui-monospace,monospace;resize:vertical}.task-panel code{overflow-wrap:anywhere}.heroContent h1{font-size:clamp(30px,4vw,49px)}.heroContent p{max-width:62ch}.hero{min-height:440px}.lifecycle-position{max-width:90ch}.metric-caption{white-space:normal}.metric-progress strong{font-size:28px}.metric-progress .metric-caption{gap:7px}.tableWrap td{vertical-align:top}[hidden]{display:none!important}@media(max-width:650px){.hero{min-height:530px}.heroContent{padding:24px}.heroContent h1{font-size:30px}.heroContent p{font-size:14px}.two{grid-template-columns:1fr}.project-dashboard{grid-template-columns:repeat(2,minmax(0,1fr))}.metric{padding:16px 12px}.metric strong{font-size:23px}.planned-facts span{flex-direction:column;gap:5px}.metric-caption span{line-height:1.5}.branch-header{padding:20px}.changeRow h3{font-size:17px}}
'''
wr(S/'preclass.css',css)
basehtml=rd(T/'martins-monster-quest/hub/index.html')
for page in ['hub','rebuild','comparison','development','costs','guide','parents','review']:
 h=basehtml.replace('data-project="martin"','data-project="'+ID+'"').replace('data-page="hub"','data-page="'+page+'"').replace('../../shared/','../shared/')
 h=re.sub(r'<title>.*?</title>','<title>'+C['title'][1]+' · HUB R6</title>',h)
 h=h.replace('</head>','<link rel="stylesheet" href="../shared/hub-r6/preclass.css?v='+REV+'"></head>')
 h=re.sub(r'(studio\.js)\?[^"\s]+',r'\1?v='+REV,h)
 wr(H/('index.html'if page=='hub'else page+'.html'),h)
# Canonical single HUB entry. Original public build remains at its preserved baseline path.
wr(SITE/'index.html','<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=hub/"><title>'+C['title'][1]+' HUB</title><a href="hub/">打开作品HUB / Open project HUB</a><script>location.replace("hub/"+location.search+location.hash)</script></html>')
assert before==protected(),'Existing game source was modified'
prep={**manifest,'template_standard':contract['standard_id'],'template_lifecycle':contract['lifecycle_overlay'],'template_files':{f:sha((T/'shared/hub-r6'/f).read_bytes())for f in ['studio.js','studio.css','studio-r3.css','studio-r5.css','r6.css','lifecycle.css']},'protected_game_files':before,'game_files_unchanged':True,'new_game_implementations':0,'diagrams':render_jobs,'budget_current_estimate':recorded,'budget_future_reserve':20,'public_site_directory':'docs'if ID=='aidan'else'.','privacy':'New summaries use first names only; no calendar times, surnames, contact details, private networks or raw chats are copied.'}
dump(H/'preparation.json',prep);dump(TOOLS/'render-jobs.json',render_jobs)
# Carry the new approved contract into this original work, without relocking its golden source elsewhere.
for n in ['R6-FINAL-PRESENTATION.md','R6-LIFECYCLE-AND-AI-REVIEW.md']:shutil.copy2(T/'docs/hub-standard'/n,TOOLS/n)
dump(R/'HUB-ENTRY.json',{'project':ID,'canonical_hub':'hub/','site_root':'docs'if ID=='aidan'else'.','revision':REV,'status':'PREPARED_NOT_EXECUTED','upstream_template_repository':'sydneygemstone-sudo/student-works','upstream_commit':template_ref,'upstream_standard':contract['standard_id'],'upstream_lifecycle_revision':contract['lifecycle_overlay']['revision'],'sources':'hub/preparation.json','remake_manifest':'rebuild/manifest.json','no_fallback':'Never import another student’s completion, selected model or game state.'})
print(json.dumps({'project':ID,'hub':str(H),'template':template_ref,'source':ref,'protected_files':len(before),'future_remakes':2,'implemented_remakes':0,'overall_progress':lc['overall_percent'],'budget':cost['api_equivalent_aud']},ensure_ascii=False,indent=2))
