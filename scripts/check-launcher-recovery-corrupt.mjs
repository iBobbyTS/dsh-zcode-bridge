// Scratch synthetic ciphertext only. Never copy or read a real credential file.
import {HostLauncher} from '../packages/host/launcher/index.mjs';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync,statSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
const base=resolve('../.agent-work/tmp/host-reuse-probe'),output=resolve('.agent-work/tmp/check-launcher-recovery-corrupt/launcher-recovery');mkdirSync(output,{recursive:true});
let fixture,seed;const events=[];
const launcher=new HostLauncher({scratchRoot:base,runId:'launcher-recovery-corrupt-'+Date.now(),artifactRoot:join(base,'official-extracted'),electronPath:join(base,'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'),builtinConfig:'/Applications/ZCode.app/Contents/Resources/config/provider/zcode-builtin.json'},{spawnProcess:(cmd,args,opts)=>{
 fixture=join(dirname(args.at(-1)),'data-base/.zcode/v2/credentials.json');mkdirSync(dirname(fixture),{recursive:true});
 writeFileSync(fixture,JSON.stringify({'oauth:active_provider':'enc:v1:invalid.cipher.payload'}),{mode:0o600});seed={size:statSync(fixture).size,mtimeMs:statSync(fixture).mtimeMs};return spawn(cmd,args,opts);
}});
launcher.subscribe(s=>events.push({at:Date.now(),...s}));
try{
 const state=await launcher.start(),after=statSync(fixture);
 const result={oracle:'LIVE-official-Host-scratch-synthetic-corrupt-cipher',state,fixtureMetadata:{before:seed,after:{size:after.size,mtimeMs:after.mtimeMs}},pass:state.auth==='signed-out'&&after.mtimeMs!==seed.mtimeMs,modelRequests:0,network:'OS-denied',keychain:'OS-denied',repeatLaunch:false};
 writeFileSync(join(output,'scratch-corrupt.json'),JSON.stringify(result,null,2));if(!result.pass)process.exitCode=1;console.log(JSON.stringify({pass:result.pass,phase:state.phase,auth:state.auth}));
}finally{await launcher.dispose();writeFileSync(join(output,'scratch-corrupt-events.json'),JSON.stringify(events,null,2));}
