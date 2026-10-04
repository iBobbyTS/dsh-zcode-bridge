// Read-only HTTP verification of the persistent web profile; auth cookie never exported.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {compareObservation} from '../packages/host/launcher/observation.mjs';
const out=resolve(process.env.S03_WEB_CHECK_OUTPUT??'docs/probes/checks/s03-p2/persistent-web');mkdirSync(out,{recursive:true});
const log=readFileSync('/private/tmp/s03-web-server-final.log','utf8'),url=log.match(/dsh web: (http:\/\/127\.0\.0\.1:3092\/\?token=[^\s]+)/)?.[1];if(!url)throw Error('web-url-unavailable');
const response=await fetch(url,{redirect:'manual'}),cookie=response.headers.getSetCookie().map(c=>c.split(';')[0]).join(';');
const call=async(method,payload)=>{const r=await fetch('http://127.0.0.1:3092/zcode-bridge/'+method,{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify({type:'client-request',rpcId:'s03-web-read',method,payload})});const body=await r.json();if(!body.result?.ok)throw Error(body.result?.error?.code??'web-read-failed');return body.result.value;};
const save=(name,v)=>writeFileSync(join(out,name+'.json'),JSON.stringify(v,null,2));
const connected=await call(process.argv.includes('--observe-existing')?'status':'connect',{});save('connected',connected);if(!connected.connected||connected.auth!=='authenticated'){console.log(JSON.stringify({state:connected.state,auth:connected.auth,reason:connected.reason,readOnly:true,spawnedByCheck:!process.argv.includes('--observe-existing')}));process.exitCode=1;}else{
const catalog=await call('sessions',{});save('catalog',catalog);
const idle=catalog.sessions.find(r=>r.sharedTask.status==='completed');if(idle)save('idle-gate',await call('writePreflight',{address:idle.address}));
const observation=await call('launcher',{operation:'observation'});save('observation',observation);const comparison=compareObservation(connected.launcher.observationBaseline,observation);save('comparison',comparison);
console.log(JSON.stringify({baseURL:'http://127.0.0.1:3092',auth:connected.auth,taskCount:catalog.sessions.length,comparison}));

}
