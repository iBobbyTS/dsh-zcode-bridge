import { readFile, writeFile, mkdir } from 'node:fs/promises';
const official=JSON.parse(await readFile('tests/fixtures/s11/official.json','utf8'));
const context={requestId:'s11-list',sessionId:'s11-session',workspaceKey:'/fixture/s11-workspace',workspacePath:'/fixture/s11-workspace',clientMode:'web-remote-replayable',sessionContext:'live'};
const base={eventId:'s11-event',sequenceNumber:1,sessionId:'s11-session',timestamp:1000};
const requests={list:{id:'server-s11-list',method:'interaction/browserList',params:context},execute:{id:'server-s11-execute',method:'interaction/browserExecute',params:{...context,requestId:'s11-execute',browserId:'iab:fixture',browserGeneration:7,command:{method:'getState'}}}};
const lifecycle={
 provenance:{kind:'injected-fixture',officialSource:'reference/ZCode@29628c9 shared browser-use and CUA schemas',note:'All browser request/result and CUA event/permission frames below are synthetic. No real browser/CUA action or permission probe occurred.'},
 requests,
 results:{listEmpty:{browsers:[]},missing:{ok:false,error:{code:'backend_unavailable',message:'Official browser host executor is unavailable',sideEffect:'none'},elapsedMs:0},targetClosed:{ok:false,error:{code:'renderer_unreachable',message:'Fixture target closed',sideEffect:'none'},elapsedMs:1},permissionDenied:{ok:false,error:{code:'capability_unsupported',message:'Fixture permission denied',sideEffect:'none'},elapsedMs:1},cancelled:{ok:false,error:{code:'cancelled',message:'Fixture cancelled',sideEffect:'uncertain'},elapsedMs:1},screenshot:{ok:true,elapsedMs:1,image:{mimeType:'image/png',base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jHioAAAAASUVORK5CYII='},meta:{browserUse:true,backendType:'iab',browserId:'iab:fixture',browserGeneration:7,tabId:'tab-fixture',openTabIds:['tab-fixture'],currentUrl:'https://example.test/',lifecycle:'active'}}},
 notifications:{scheduled:{method:'computer-use/operation-event',params:{...base,kind:'tool-scheduled',turnId:'turn-fixture',toolCallId:'tool-fixture',toolName:'mcp__node_repl__js',computerUse:true}},started:{method:'computer-use/operation-event',params:{...base,eventId:'s11-started',sequenceNumber:2,kind:'tool-started',turnId:'turn-fixture',toolCallId:'tool-fixture',toolName:'mcp__node_repl__js'}},failed:{method:'computer-use/operation-event',params:{...base,eventId:'s11-failed',sequenceNumber:3,kind:'turn-failed',turnId:'turn-fixture'}},permission:{method:'v4/cua/permission-observation',params:{schemaVersion:1,eventId:'s11-permission',eventSeq:1,occurredAt:1000,sessionId:'s11-session',turnId:'turn-fixture',toolCallId:'tool-fixture',permissionStatus:{schemaVersion:1,platform:'darwin',grantOwner:'Fixture Helper',accessibility:'denied',screenRecording:'unknown'}}}},
};
const baseline=JSON.parse(await readFile('tests/fixtures/s03a/success.json','utf8'));
const projection=structuredClone(baseline.initial);
const rowBase={kind:'toolCall',turnId:'turn-fixture',createdAt:1000,createdAtSeq:1,toolName:'mcp__node_repl__js',inputText:'fixture-only',status:'success'};
projection.frame.payload.snapshot.rows={window:[
 {...rowBase,rowId:1,toolCallId:'image-fixture',display:{kind:'node_repl_images',images:[lifecycle.results.screenshot.image],app:{appKey:'fixture-app',displayName:'Fixture App'}}},
 {...rowBase,rowId:2,toolCallId:'permission-fixture',status:'error',error:{code:'permission_denied',message:'Fixture permission denied'},output:{text:'Fixture denied',display:{kind:'cua',schemaVersion:1,toolName:'request_access',status:'failed',errorCode:'permission_denied',permissionStatus:lifecycle.notifications.permission.params.permissionStatus,media:[{mimeType:'image/png',artifactUri:'fixture-only://screenshot'}]}}},
],totalCount:2,firstRowId:1};
lifecycle.projection=projection;lifecycle.ack=baseline.ack;
lifecycle.provenance.projectionInjection='two synthetic toolCall rows in real S03A empty snapshot envelope';
await mkdir('tests/fixtures/s11',{recursive:true});
await writeFile('tests/fixtures/s11/lifecycle.json',JSON.stringify(lifecycle,null,2)+'\n');
await writeFile('tests/fixtures/s11/empty.json',JSON.stringify({provenance:{kind:'derived-real-capture',source:'official.json',injectedFields:[]},plugins:official.probes.plugins.result,mcpStatus:official.probes.mcpStatus.result,projection:official.probes.projection.result},null,2)+'\n');
console.log('S11 real empty-state projection and explicitly injected host fixtures written');
