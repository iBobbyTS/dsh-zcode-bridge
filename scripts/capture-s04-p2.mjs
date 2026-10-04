// S04-P2 evidence harness. Talks to the running DSH web profile through the same /zcode-bridge
// carrier the web UI uses; never reads credentials and never opens the real SQLite directly.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
const log=process.env.S04_WEB_LOG??'/private/tmp/s03-web-restart2.log';
const out=resolve(process.env.S04_OUT??'docs/probes/checks/s04-p2');mkdirSync(out,{recursive:true});
const url=readFileSync(log,'utf8').match(/dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+)/)?.[1];
if(!url)throw Error('web-url-unavailable');
const origin=new URL(url).origin;
const response=await fetch(url,{redirect:'manual'});
const cookie=response.headers.getSetCookie().map(c=>c.split(';')[0]).join(';');
const call=async(method,payload)=>{const r=await fetch(origin+'/zcode-bridge/'+method,{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify({type:'client-request',rpcId:'s04-'+method,method,payload})});const body=await r.json();if(!body.result?.ok)throw Object.assign(Error(body.result?.error?.code??'web-rpc-failed'),{code:body.result?.error?.code});return body.result.value};
const save=(name,value)=>{writeFileSync(join(out,name+'.json'),JSON.stringify(value,null,2));console.log(name,JSON.stringify(value).slice(0,400));};
const command=process.argv[2];
if(command==='status')save('status',await call('status',{}));
if(command==='connect')save('connected',await call('connect',{}));
if(command==='baseline'){const status=await call('status',{});const catalog=await call('sessions',{});const observation=await call('launcher',{operation:'observation'});save('send-before',{at:Date.now(),auth:status.auth,connected:status.connected,taskCount:catalog.sessions.length,catalog:{complete:catalog.catalog.complete,truncated:catalog.catalog.truncated,sharedGui:catalog.catalog.sharedGui,readOnly:catalog.catalog.readOnly,multiWorkspace:catalog.catalog.multiWorkspace},usage:observation.usage,rpc:observation.rpc,writeRpc:observation.writeRpc??[],schedulerPolicy:observation.schedulerPolicy});}
if(command==='send')save('send-result',await call('ownTurn',{}));
if(command==='observe'){const observation=await call('launcher',{operation:'observation'});save('observation-'+(process.argv[3]??'now'),{at:Date.now(),usage:observation.usage,rpc:observation.rpc,writeRpc:observation.writeRpc??[],taskCount:observation.tasks.length,tasks:observation.tasks.filter(t=>!t.deleted),schedulerPolicy:observation.schedulerPolicy});}
if(command==='preflight'){save('preflight-'+(process.argv[3]??'now'),await call('writePreflight',{address:JSON.parse(process.argv[4])}));}
