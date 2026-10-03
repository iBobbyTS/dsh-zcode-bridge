import { BridgeHost } from '../packages/host/runtime.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { statusText } from '../packages/client/status.mjs';
const workspacePath=process.argv[2];
if(!workspacePath){console.error('Usage: npm run probe -- /absolute/dedicated/workspace');process.exit(2)}
const host=new BridgeHost({workspacePath});
try {
  const s=await host.connect();
  let processPaths=[];if(s.pid){try{const {stdout}=await promisify(execFile)('/usr/sbin/lsof',['-a','-p',String(s.pid),'-d','txt','-Fn'],{timeout:3000});processPaths=stdout.split('\n').filter(x=>x.startsWith('n')&&x.includes('ZCode.app')).map(x=>x.slice(1))}catch{}}
  console.log(JSON.stringify({processPaths,state:s.state,reason:s.reason,uiText:statusText(s),connected:s.connected,auth:s.auth,installation:s.installation,pid:s.pid,roundTrip:s.roundTrip,sessionCount:s.sessionCount,stderrBytes:s.stderrBytes},null,2));
  if(!s.connected)process.exitCode=1;
}finally{await host.dispose();console.log(JSON.stringify({disposed:host.status.reason,paidModelCalls:0}))}
