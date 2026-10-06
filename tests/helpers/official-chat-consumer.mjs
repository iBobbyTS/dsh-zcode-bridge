import {existsSync} from 'node:fs';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

export const npmRoot=process.env.DSH_DRIVER_NPM_NODE_MODULES??'/private/tmp/dsh-local-npm-verify/npm/node_modules';
export const sourceRoot=process.env.DSH_DRIVER_SOURCE_ROOT??'/Users/ibobby/Projects/dsh-zcode-acp/.agent-work/tmp/dsh-official';
export const officialArtifact=name=>join(npmRoot,'@deepseek-ai',name,'lib/index.js');
export const officialAvailable=existsSync(officialArtifact('dsh-session'))&&existsSync(join(sourceRoot,'packages/client/ui-chat/src/client/conversation-nodes/register.ts'));
export const loadOfficial=name=>import(pathToFileURL(officialArtifact(name)));

/** Compile the unmodified official consumer sources, never a local reimplementation.
 * Type-only UI dependencies disappear; runtime libraries resolve to the rc.2 npm
 * artifacts. No file in either read-only evidence tree is modified.
 */
export async function officialChatConsumer(ctx){
  const scratch=await mkdtemp(join(tmpdir(),'zcode-native-consumer-'));
  const conversation=join(sourceRoot,'packages/client/ui-conversation/src/client/conversation');
  const imports=[
    ['ConversationNodeAssembler',join(conversation,'assembler.ts')],
    ['inspectRequestPrompt',join(sourceRoot,'packages/client/ui-conversation/src/client/contract/request-inspection.ts')],
    ['ConversationEventRegistry',join(conversation,'event-registry.ts')],
    ['ConversationViewRegistry',join(conversation,'view-registry.ts')],
    ['ConversationGroupRegistry',join(conversation,'group-registry.ts')],
    ['registerConversationNodes',join(sourceRoot,'packages/client/ui-chat/src/client/conversation-nodes/register.ts')],
    ['ClientAssistantStream',join(sourceRoot,'packages/api/session-controller/src/client/sessions/assistant-stream.ts')],
    ['SessionAssistantStreamAccumulator',join(sourceRoot,'packages/api/session-controller/src/assistant-stream.ts')],
  ];
  const require=createRequire(join(npmRoot,'../official-consumer.cjs'));
  try{
    // Minimal assembler has no grouping: only the official notification helper
    // is reached. Preserve its exact source; reject any optional group-store use
    // rather than mocking Zustand/Immer behavior absent from the npm artifact.
    const store=await readFile(join(sourceRoot,'packages/client/store/src/index.ts'),'utf8');
    const start=store.indexOf('export function notifySubscribers'),end=store.indexOf('\n}',start)+2;
    if(start<0||end<2)throw new Error('official notification helper contract missing');
    const subset=join(scratch,'official-notify.ts');await writeFile(subset,store.slice(start,end)+'\nexport function createSnapshotStore(){throw new Error("optional grouping is excluded from the minimal official consumer")}');
    const result=await build({stdin:{contents:imports.map(([name,path])=>`export {${name}} from ${JSON.stringify(path)};`).join('\n'),resolveDir:scratch,sourcefile:'official-consumer-entry.mjs'},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent',plugins:[{name:'official-npm-runtime',setup(builder){builder.onResolve({filter:/^[^./]/},args=>args.path==='@deepseek-ai/dsh-client-store'?{path:subset}:args.path==='@deepseek-ai/dsh-util-values'?{path:join(sourceRoot,'packages/util/values/src/index.ts')}:({path:require.resolve(args.path),external:true}))}}]});
    const file=join(scratch,'consumer.mjs');await writeFile(file,result.outputFiles[0].contents);
    const api=await import(pathToFileURL(file));
    const events=new api.ConversationEventRegistry(ctx),views=new api.ConversationViewRegistry(ctx),groups=new api.ConversationGroupRegistry(ctx,views);
    ctx.provide('uiConversation',{events,views,groups,inspectRequestPrompt:api.inspectRequestPrompt});api.registerConversationNodes(ctx);
    const assembler=new api.ConversationNodeAssembler(events,views),client=new api.ClientAssistantStream(),server=new api.SessionAssistantStreamAccumulator();
    assembler.activateTarget('chat');
    const decisions=[];
    function apply(result){
      if(!result)return;decisions.push(result.type);
      if(result.type==='rebaseline')throw new Error('official consumer requested a rebaseline');
      if(result.type==='publish'){assembler.append(result.entry);if(result.retireAttemptId)assembler.settleAssistant(result.retireAttemptId)}
      if(result.type==='transient')assembler.append(result.entry);
      if(result.type==='settlement')assembler.settleAssistant(result.attemptId,result.entry);
      if(result.type==='abandonment')assembler.settleAssistant(result.attemptId);
      assembler.flush();
    }
    return {assembler,client,server,decisions,
      durable(event){apply(client.acceptDurable({type:'event',event}))},
      frame(frame,cursor){server.accept(frame,cursor);apply(client.acceptFrame(frame.type==='start'?{...frame,startedAfterSeq:cursor}:frame))},
      read(events){assembler.replaceWindow(client.replace(events.map(event=>({type:'event',event}))),false);assembler.flush();return assembler.snapshot('chat')},
      snapshot(){assembler.flush();return assembler.snapshot('chat')},
      async close(){await rm(scratch,{recursive:true,force:true})},
    };
  }catch(error){await rm(scratch,{recursive:true,force:true});throw error}
}
