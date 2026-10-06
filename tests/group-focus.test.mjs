// CB5 rebind: grouping is now owned by the native Workspace tree, with no local group editor.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';import {createRequire} from 'node:module';import vm from 'node:vm';import {resolve} from 'node:path';
import {world,catalogRow,directory} from './helpers/conversation-runtime.mjs';
function nativeTree(){
 const root=resolve('../reference/deepseek-harness');const code=buildSync({entryPoints:[root+'/packages/client/ui-workspace/src/client/tree.ts'],bundle:true,write:false,platform:'node',format:'cjs',alias:{'@deepseek-ai/dsh-util-values':root+'/packages/util/values/src/index.ts','@deepseek-ai/dsh-util-workspace-path':root+'/packages/util/workspace-path/src/index.ts'}}).outputFiles[0].text;const mod={exports:{}};vm.runInThisContext('(function(require,module,exports){'+code+'\n})')(createRequire(import.meta.url),mod,mod.exports);return mod.exports;
}
test('CB5 rebind: official titles retain 🅩 through native workspace grouping and authoritative rename refresh',async()=>{
 let rows=[catalogRow('one','First'),catalogRow('two','Second','/shared')];const w=await world({catalog:async()=>directory(rows)});try{
 await w.runtime.refreshDirectory();assert.equal(w.runtime.agents.size,2);assert.equal(w.peer.calls.filter(call=>call.method==='v4/conversation/subscribe').length,0,'catalog publication does not hydrate every session');
 const native='native';const workspace=await w.ctx.workspaceRegistry.resolveByPath('/shared');workspace.sessionIds.push(native);
 const list={projectionsBySession:{},ids:[...w.runtime.agents.keys(),native],byId:{[native]:{id:native,title:'Native title',blank:false,updatedAt:0,retainedBy:{},running:false}}};for(const [id,agent] of w.runtime.agents)list.byId[id]={id,title:agent.record.events.findLast(event=>event.type==='session/title').data.title,blank:false,updatedAt:0,retainedBy:{},running:false};
 const workspaces=[...w.workspaces.values()].map(ws=>({workspaceId:ws.id,path:ws.path,title:ws.path,createdAt:new Date(0).toISOString(),sessionIds:ws.sessionIds}));const {deriveGroups,owningGroupKey}=nativeTree();
 const groups=deriveGroups(list,workspaces,{pinnedSessionIds:[],archivedSessionIds:[],archivedFilter:'default'},new Map(),{expandedGroups:workspaces.map(ws=>ws.workspaceId),ungroupedOrder:[]});const mixed=groups.find(group=>group.cwd==='/shared');assert.deepEqual(mixed.sessions.map(session=>session.title),['🅩 Second','Native title']);assert.equal(owningGroupKey(workspaces,native),mixed.key);
 rows=[catalogRow('one','🅩 Renamed'),catalogRow('two','Second','/shared')];await w.runtime.refreshDirectory();const record=[...w.store.records.values()].find(record=>record.officialId==='one');assert.equal(record.events.findLast(event=>event.type==='session/title').data.title,'🅩 Renamed');assert.equal(w.peer.calls.filter(call=>call.method==='v4/command').length,0);
 }finally{await w.runtime.dispose()}
});
