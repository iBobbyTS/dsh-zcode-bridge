// Read-only probe against installed npm artifacts and the official source evidence copy.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const [npmRoot,sourceRoot]=process.argv.slice(2);
if(!npmRoot||!sourceRoot)throw new Error('Usage: node packages/driver/contract-probe.mjs <npm/node_modules> <official source root>');
const read=path=>readFile(path,'utf8');
const npm=(pkg,file)=>resolve(npmRoot,'@deepseek-ai',pkg,file);
const source=file=>resolve(sourceRoot,file);
function body(text,name){
  const start=text.indexOf('interface '+name+' {');assert.notEqual(start,-1,name);
  let i=text.indexOf('{',start),depth=1,end=i+1;
  for(;depth;end++){if(text[end]==='{')depth++;if(text[end]==='}')depth--}
  return text.slice(i+1,end-1).replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'').replace(/[\s;]/g,'');
}
const pkg=JSON.parse(await read(npm('dsh-agent','package.json')));
assert.equal(pkg.version,'0.2.0-rc.2');
const official=await read(source('packages/core/agent/src/index.ts'));
const artifact=await read(npm('dsh-agent','lib/types/index.d.ts'));
const interfaces={};
for(const name of ['AgentFactory','AgentHandle','CreateAgentOptions','ResumeAgentOptions']){
  assert.equal(body(artifact,name),body(official,name),name+' contract drift');interfaces[name]='一致';
}
const eventNames=text=>[...text.matchAll(/['"](agent\/[^'"]+)['"]\s*\(/g)].map(match=>match[1]);
const names=eventNames(await read(npm('dsh-agent','lib/types/runtime-types.d.ts')));
assert.deepEqual(names,eventNames(await read(source('packages/core/agent/src/runtime-types.ts'))));
assert.equal(body(await read(npm('dsh-agent','lib/types/dispatch.d.ts')),'AgentEventDispatch'),body(await read(source('packages/core/agent/src/dispatch.ts')),'AgentEventDispatch'));
assert.equal(body(await read(npm('dsh-session','lib/types/types.d.ts')),'SessionHeader'),body(await read(source('packages/core/session/src/types.ts')),'SessionHeader'));
const validation=await read(source('packages/session/session-format-v3-to-v4/src/validation.ts'));
const npmValidation=await read(npm('dsh-session-format-v3-to-v4','lib/index.js'));
const headerKeys=text=>{
  const required=JSON.parse(text.match(/const required = (\[[^\]]+\])/)[1].replaceAll("'",'"'));
  const optional=[...text.match(/const allowed = new Set\(\[\s*\.\.\.required,\s*([^\]]+)\]/)[1].matchAll(/['"]([^'"]+)['"]/g)].map(match=>match[1]);
  return {required,optional};
};
assert.deepEqual(headerKeys(npmValidation),headerKeys(validation));
const agents=await import(pathToFileURL(npm('dsh-agent','lib/index.js')));
const scope=await import(pathToFileURL(npm('dsh-scope','lib/index.js')));
const calls=[];
const ctx={serial:(...args)=>{calls.push(['serial',...args])},waterfall:(...args)=>{calls.push(['waterfall',...args]);return args.at(-1)()},
  events:{dispatch:()=>[(...args)=>calls.push(['emit',...args])]},logger:{warn(){}}};
const agent={id:'DSH-X'},dispatch=agents.agentEvents(ctx,agent);
assert.deepEqual(Object.keys(dispatch),['emit','serial','waterfall']);
dispatch.emit('agent/status',{status:'idle',agent:{id:'wrong'}});
await dispatch.serial('agent/created',{source:'startup'});
assert.equal(dispatch.waterfall('agent/pre-step',{},()=>42),42);
for(const [,carrier,,payload] of calls){assert.equal(scope.carrierKeyOf(carrier),agent);assert.equal(payload.agent,agent)}
console.log(JSON.stringify({cohort:pkg.version,interfaces,events:names,SessionHeader:headerKeys(validation),agentEvents:Object.keys(dispatch),runtimeExports:Object.keys(agents),result:'逐项一致'},null,2));
