import { Context } from '@deepseek-ai/cordis';
import WebServer from '@deepseek-ai/dsh-host-webserver';
import { HostConnectionService } from '../../dsh/packages/client/connection/src/rpc-host.ts';
import { resolve, join } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const modulePath=process.env.SCRATCH_HOST_MODULE??resolve('packages/host/index.mjs');
const {apply,inject}=await import(pathToFileURL(modulePath).href);
const scratch=resolve('../.agent-work/tmp/host-reuse-probe'),output=resolve(process.env.SCRATCH_LAUNCHER_OUTPUT??'.agent-work/tmp/check-scratch-dsh/scratch-host-launcher/dsh-live');await mkdir(output,{recursive:true});
const ps=()=>execFileSync('/bin/ps',['-axo','pid=,ppid=,comm='],{encoding:'utf8'}).split('\n').map(l=>l.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/)).filter(Boolean).map(m=>({pid:Number(m![1]),ppid:Number(m![2]),comm:m![3]}));
const gui=()=>ps().filter(p=>p.comm.startsWith('/Applications/ZCode.app/')||p.comm==='ZCode');
const before=gui(),ctx=new Context();let result:any,stage='setup',lastProjection:any;
try{
  await ctx.plugin(owner=>{new HostConnectionService(owner,[],{isAuthenticated:()=>true} as never)});
  await ctx.plugin(WebServer,{host:'127.0.0.1',port:0});
  const plugin=await ctx.plugin({apply,inject},{authorityMode:'host-backed',launcher:{scratchRoot:scratch,artifactRoot:join(scratch,'official-extracted'),electronPath:join(scratch,'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'),builtinConfig:'/Applications/ZCode.app/Contents/Resources/config/provider/zcode-builtin.json'}} as never);
  const call=async(method:string,payload:unknown)=>{const r=await fetch(`http://127.0.0.1:${ctx.get('webServer')!.port}/zcode-bridge/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:'scratch-live',method,payload})});return (await r.json()).result};
  stage='connect';const connected=await call('connect',{});lastProjection=connected;assert.equal(connected.ok,true);assert.equal(connected.value.reason,'host-execution-disabled-official-host');assert.equal(connected.value.connected,false);assert.equal(connected.value.launcher.phase,'ready');
  const state=await call('launcher',{operation:'state'});const services=await call('launcher',{operation:'services'});const watch=await call('launcher',{operation:'watch',afterRevision:state.value.revision-1});
  assert.deepEqual(services.value.services,['oauth','provider-settings','setting']);assert.equal(watch.value.channelAvailable,true);assert.equal(state.value.landings.passed,true);assert.equal(state.value.auth,'signed-out');
  const table=ps(),ids=new Set<number>([state.value.mainPid,state.value.hostPid]);for(let i=0;i<8;i++)for(const p of table)if(ids.has(p.ppid))ids.add(p.pid);
  stage='dispose';await plugin.dispose();assert.deepEqual(ps().filter(p=>ids.has(p.pid)),[]);stage='gui-inventory';assert.deepEqual(gui(),before);
  result={pass:true,oracle:'LIVE-installed-DSH-plugin-HTTP',modelRequests:0,connected,services,watch,guiUnchanged:true,remainingOwned:[]};
}catch(e:any){result={pass:false,error:e.code??e.message,stage,lastProjection,guiBefore:before,guiAfter:gui()};process.exitCode=1}
finally{await ctx.fiber.dispose();await writeFile(resolve(output,'dsh-live.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result))}
