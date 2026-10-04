// Read-only transplant of the official Main coordinator; no runtime/auth implementation copied.
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
const root=resolve('../reference/ZCode');
const result=await build({stdin:{contents:`export {TaskRealtimeBus} from '${root}/packages/desktop/src/main/taskRealtimeBus.ts';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'esm',platform:'node',external:['zod'],write:false,metafile:true,plugins:[{name:'official-bus',setup(b){
  b.onResolve({filter:/^@zcode\/shared$/},()=>({path:'shared',namespace:'facade'}));
  b.onLoad({filter:/.*/,namespace:'facade'},()=>({contents:`export {HostMessageTypes,HostResponseTypes} from '${root}/packages/shared/src/channels.ts'; export {hostResponseMessageSchema,formatZodError} from '${root}/packages/shared/src/validation.ts';`,loader:'ts',resolveDir:root}));
  b.onResolve({filter:/^\.\/logger\.js$/},()=>({path:'logger',namespace:'facade-logger'}));
  b.onLoad({filter:/.*/,namespace:'facade-logger'},()=>({contents:'export const logger={info(){},warn(){}};',loader:'js'}));
  b.onResolve({filter:/.*/},args=>{
    if(args.path==='zod')return {path:'zod',external:true};
    let p=args.path==='@zcode/model-option-map'?root+'/packages/model-option-map/src/index.ts':resolve(args.resolveDir,args.path);
    if(p.endsWith('.js'))p=p.slice(0,-3)+'.ts';
    if(!p.startsWith(root+'/packages/'))throw Error('Unapproved dependency: '+p);
    return {path:p};
  });
}}],banner:{js:'/* Generated from Apache-2.0 ZCode@29628c9; see host-bus-SOURCES.json and ../vendor/zcode/LICENSE. */'}});
const sources=[];
for(const p of Object.keys(result.metafile.inputs))if(!p.startsWith('facade')&&p!=='<stdin>'){const abs=resolve(p);sources.push({path:relative(root,abs),sha256:createHash('sha256').update(await readFile(abs)).digest('hex')});}
await writeFile('packages/host/launcher/host-bus.mjs',result.outputFiles[0].contents);
await writeFile('packages/host/launcher/host-bus-SOURCES.json',JSON.stringify({repository:'https://github.com/zai-org/ZCode',revision:'29628c9acdb81b703bbd4080c207a0e7ce5e276e',license:'Apache-2.0',adapter:'logger is a no-op; schemas and bus unchanged',sources},null,2)+'\n');
console.log(JSON.stringify({sourceFiles:sources.length,bytes:result.outputFiles[0].contents.length}));
