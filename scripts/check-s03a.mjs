import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
const commands=[['npm',['test']],['npm',['run','build']],['node',['../dsh/node_modules/vitest/vitest.mjs','run','--config','scripts/dsh-vitest.config.mjs']]];
const results=[];
for(const [command,args] of commands){
 const r=spawnSync(command,args,{encoding:'utf8',timeout:120000,env:{...process.env,NO_COLOR:'1'}});
 results.push({command,args,exit:r.status,signal:r.signal,error:r.error?.message??null,stdout:r.stdout,stderr:r.stderr});
 console.log(JSON.stringify({command,args,exit:r.status}));
 if(r.status!==0)process.exitCode=1;
}
await writeFile('docs/probes/checks/s03a-checks.json',JSON.stringify({at:new Date().toISOString(),results},null,2)+'\n');
