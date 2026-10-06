// One live-http attempt through the real DSH HTTP carrier. No GUI controls, raw DB or credentials.
import {Context} from '@deepseek-ai/cordis'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import {HostConnectionService} from '../../dsh/packages/client/connection/src/rpc-host.ts'
import {apply,inject} from '../packages/host/index.mjs'
import {compareObservation} from '../packages/host/launcher/observation.mjs'
import {resolve,join} from 'node:path'
import {readFileSync,writeFileSync,existsSync,copyFileSync,mkdirSync,mkdtempSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
const base=resolve('../.agent-work/tmp/host-reuse-probe'),out=resolve('docs/probes/checks/launcher-recovery/live-attempt1');mkdirSync(out,{recursive:true})
const scratch=mkdtempSync('/private/tmp/s3-'),artifacts=JSON.parse(readFileSync(resolve('docs/probes/checks/launcher-recovery/live-http-artifacts.json'),'utf8'))
const save=(n:string,v:unknown)=>writeFileSync(join(out,n+'.json'),JSON.stringify(v,null,2)+'\n')
const table=()=>execFileSync('/bin/ps',['-axo','pid=,ppid=,comm='],{encoding:'utf8'}).split('\n').map(l=>l.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/)).filter(Boolean).map(m=>({pid:+m![1],ppid:+m![2],comm:m![3]}))
const gui=()=>table().filter(p=>p.comm.startsWith('/Applications/ZCode.app/')||p.comm==='ZCode')
const result:any={startedAt:new Date().toISOString(),oracle:'LIVE-DSH-HTTP-official-Host-real-HOME',attempt:1,scratch,modelsRequestedByHarness:0,notes:[],rpc:[]},ctx=new Context(),ids=new Set<number>();let plugin:any,stage='setup'
const before=gui();save('gui-before',before)
try{
 if(!before.length)throw Error('official-gui-not-running')
 await ctx.plugin(owner=>{new HostConnectionService(owner,[],{isAuthenticated:()=>true} as never)})
 await ctx.plugin(WebServer,{host:'127.0.0.1',port:0})
 plugin=await ctx.plugin({apply,inject},{authorityMode:'host-backed',launcher:{mode:'live-http',liveHttpArtifacts:artifacts,scratchRoot:scratch,runId:'live',artifactRoot:join(base,'official-extracted'),electronPath:join(base,'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'),builtinConfig:'/Applications/ZCode.app/Contents/Resources/config/provider/zcode-builtin.json'}} as never)
 const call=async(method:string,payload:unknown)=>{
  result.rpc.push({method,at:Date.now()});const response=await fetch(`http://127.0.0.1:${ctx.get('webServer')!.port}/zcode-bridge/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:'conversation-live',method,payload})});const r=(await response.json()).result;if(!r.ok)throw Object.assign(Error(r.error.code),{code:r.error.code});return r.value
 }
 stage='first-real-start';result.connected=await call('connect',{});save('connected',result.connected)
 result.launcher=await call('launcher',{operation:'state'});save('launcher',result.launcher)
 for(const id of [result.launcher.mainPid,result.launcher.hostPid])if(id)ids.add(id)
 const t=table();for(let i=0;i<8;i++)for(const p of t)if(ids.has(p.ppid))ids.add(p.pid);result.owned=t.filter(p=>ids.has(p.pid));save('owned',result.owned)
 if(result.launcher.phase!=='ready'||result.connected.auth!=='authenticated')throw Error('real-start-not-authenticated-ready')
 stage='official-catalog';const catalog=await call('sessions',{});save('catalog',catalog);result.taskCount=catalog.sessions.length
 result.gates=[];for(const row of catalog.sessions.filter((r:any)=>r.sharedTask?.status==='running').slice(0,12))result.gates.push({address:row.address,sharedTask:row.sharedTask,decision:await call('writePreflight',{address:row.address})})
 const idle=catalog.sessions.find((r:any)=>r.sharedTask?.status==='completed');if(idle)result.gates.push({address:idle.address,sharedTask:idle.sharedTask,decision:await call('writePreflight',{address:idle.address})})
 save('gates',result.gates)
 stage='first-observation';const baseline=result.launcher.observationBaseline;save('baseline',baseline)
 result.observations=[]
 // Three bounded samples; abnormal shared growth stops immediately, attribution stays unknown.
 for(let i=0;i<3;i++){
  await new Promise(r=>setTimeout(r,3000));const sample=await call('launcher',{operation:'observation'}),comparison=compareObservation(baseline,sample);result.observations.push({sample,comparison});save('observations',result.observations)
  if(!comparison.pass)throw Error(comparison.reason??'observation-failed')
 }
 result.pass=true;result.authFlipped=true
}catch(e:any){result.pass=false;result.failure={stage,code:e.code??null,message:e.message};result.authFlipped=result.connected?.auth==='authenticated';process.exitCode=1}
finally{
 await plugin?.dispose();await ctx.fiber.dispose();const after=gui();save('gui-after',after);result.guiUnchanged=JSON.stringify(before)===JSON.stringify(after);result.remaining=table().filter(p=>ids.has(p.pid));save('owned-remaining',result.remaining);const trace=join(scratch,'runs/live/launcher-states.jsonl');if(existsSync(trace))copyFileSync(trace,join(out,'launcher-states.jsonl'));result.endedAt=new Date().toISOString();save('result',result);console.log(JSON.stringify({pass:result.pass,authFlipped:result.authFlipped,failure:result.failure??null,taskCount:result.taskCount,guiUnchanged:result.guiUnchanged,remaining:result.remaining.length}))
}
