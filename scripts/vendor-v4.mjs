// Read-only selective schema/pure-function transplant. No services or runtime imports.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root=resolve(process.argv[2]??'../reference/ZCode');
const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
if(revision!=='29628c9acdb81b703bbd4080c207a0e7ce5e276e')throw Error('Unexpected reference revision');
const source=resolve(root,'packages/shared/src/zcode-protocol-v4');
const out='packages/host/vendor/zcode';
await mkdir(out,{recursive:true});
const exports={
 'command':['parseCommandEnvelope','commandAckSchema','commandsQueryResultSchema','COMMANDS_REQUIRING_BASE_REVISION','ROW_TARGETING_COMMANDS'],
 'transport':['conversationTopicFrameSchema','conversationTopicWireCandidateSchema','v4ConversationSubscribeParamsSchema','v4ConversationSubscribeResultSchema','v4ConversationResyncParamsSchema','v4ConversationResyncResultSchema','v4ConversationUnsubscribeParamsSchema','clientHelloSchema','helloMessageSchema'],
 'apply':['applyConversationDeltas'],
 'wire-assembler':['TopicWireFrameAssembler'],
 'wire-codec':['encodeTopicWireFrames','measureTopicNotificationEnvelopeBytes'],
 'wire-binary':['crc32WireBytes'],
 'core':['PROTOCOL_V4_LIMITS'],
 '../zcode-protocol/index':['zcodeWorkspaceUpdateInteractionPreferencesParamsSchema','zcodeWorkspaceUpdateInteractionPreferencesResultSchema','zcodeWorkspaceUpdateModelIoPreferencesParamsSchema','zcodeWorkspaceUpdateModelIoPreferencesResultSchema','zcodeWorkspaceReadPresentationParamsSchema','zcodeWorkspacePresentationSchema'],
};
const notice='/*! Derived from ZCode @'+revision+'; Copyright 2026 Z.AI Co., Ltd. Apache-2.0 (LICENSE).\n * Modified: selective ESM bundle of shared schemas/pure functions, TypeScript erased; services excluded.\n * Regenerate with scripts/vendor-v4.mjs; see SOURCES.json for provenance. */';
const result=await build({stdin:{contents:Object.entries(exports).map(([file,names])=>`export {${names.join(',')}} from '${source}/${file}.ts';`).join('\n'),resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'esm',platform:'neutral',treeShaking:true,external:['zod'],write:false,metafile:true,plugins:[{name:'read-only-shared',setup(b){b.onResolve({filter:/.*/},async args=>{
 if(args.path==='zod')return {path:'zod',external:true};
 let path=args.path.startsWith('.')?resolve(args.resolveDir,args.path):args.path;
 if(path.endsWith('.js'))path=path.slice(0,-3)+'.ts';
 if(path==='@zcode/model-option-map')path=resolve(root,'packages/model-option-map/src/index.ts');
 if(!path.startsWith(root+'/packages/shared/')&&!path.startsWith(root+'/packages/model-option-map/'))throw Error('Forbidden transplant dependency: '+path);
 await stat(path);return {path};
});}}],banner:{js:notice}});
const sources=[];for(const path of Object.keys(result.metafile.inputs)){if(path==='<stdin>')continue;const abs=resolve(path);sources.push({path:relative(root,abs),sha256:createHash('sha256').update(await readFile(abs)).digest('hex'),bytes:result.metafile.inputs[path].bytes});}
await writeFile(out+'/v4.mjs',result.outputFiles[0].contents);
await writeFile(out+'/SOURCES.json',JSON.stringify({repository:'https://github.com/zai-org/ZCode',revision,license:'Apache-2.0',exports,sources},null,2)+'\n');
await writeFile(out+'/LICENSE',await readFile(root+'/LICENSE'));
await writeFile(out+'/NOTICE.md',await readFile(root+'/NOTICE.md'));
console.log(JSON.stringify({sourceFiles:sources.length,outputBytes:result.outputFiles[0].contents.length}));
