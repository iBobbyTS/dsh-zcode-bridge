export {forkBoundary,forkProjection,FORK_PROJECTION_EVENT} from './fork.mjs';
export {compactAgent,installCompactCommand} from './compact.mjs';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {installDriver} from './factory.mjs';
import {installZCodeLlm} from '../host/zcode-llm.mjs';
import {DriverTransport} from './transport.mjs';
import {installSessionCommandSeams} from './session-commands.mjs';
import {installDefaultModelCover,installModelSeat} from './model-seat.mjs';
import {DriverStateStore} from './driver-state.mjs';
import {runNativeArchive} from './legacy-archive.mjs';
import {installLegacyDirectory} from './legacy-directory.mjs';
export {DriverFactory,installDriver,BINDING_EVENT,boundConversationId} from './factory.mjs';
export {DriverAgent} from './agent.mjs';
export {DriverTransport} from './transport.mjs';
export {COMMAND_REJECTIONS,ROUTED_COMMANDS,requestedDelivery} from './commands.mjs';
export {installSessionCommandSeams} from './session-commands.mjs';
export {coverDefaultModel,installDefaultModelCover,installModelSeat} from './model-seat.mjs';
export {ConversationEventTranslator,mergeEventWindows,turnEndReason} from './events.mjs';
export {HISTORY_MUTATION_COMMANDS,historyOperation} from './history.mjs';
export {DriverStateStore} from './driver-state.mjs';
export {runNativeArchive} from './legacy-archive.mjs';
export {LegacyDirectory,installLegacyDirectory} from './legacy-directory.mjs';
export {collectHistoryPages,historySnapshots,historyAttachmentReader,HISTORY_PAGE_LIMIT} from './history-backfill.mjs';
export const inject=['agents','sessions','sessionProjections','zcodeBridgeHost'];
/** Wait for the host's async model discovery, then re-announce the registered route exactly once.
 * `replace` is the official handle's route swap: it emits `llm/adapters-updated` like a first
 * registration, so the catalog cache and the default-model cover see the same wakeup. Deterministic
 * timer injection keeps this offline-testable. */
export function armLlmRouteReadiness({replace,isReady,onReady=()=>{},intervalMs=200,maxAttempts=150,setTimeoutImpl=setTimeout,clearTimeoutImpl=clearTimeout}={}){
  if(isReady()){onReady();return ()=>{}}
  let attempts=0,timer=null,disposed=false;
  const finish=error=>{if(disposed)return;disposed=true;if(timer!==null)clearTimeoutImpl(timer);timer=null;onReady(error)};
  const tick=()=>{
    if(disposed)return;
    if(isReady()){
      try{replace?.(['zcode'])}catch(error){finish(error);return}
      finish();return;
    }
    if(++attempts>=maxAttempts){finish(Object.assign(new Error('llm route discovery did not become ready'),{code:'llm-route-readiness-timeout'}));return}
    timer=setTimeoutImpl(tick,intervalMs);timer?.unref?.();
  };
  timer=setTimeoutImpl(tick,intervalMs);timer?.unref?.();
  return ()=>{disposed=true;if(timer!==null)clearTimeoutImpl(timer);timer=null};
}
export async function apply(ctx){
  const [{createScope},{agentEvents},{interruptedTurnClosers}]=await Promise.all([import('@deepseek-ai/dsh-scope'),import('@deepseek-ai/dsh-agent'),import('@deepseek-ai/dsh-session')]);
  const host=ctx.zcodeBridgeHost;
  const driver=installDriver(ctx,{createScope,agentEvents,interruptedTurnClosers,transport:new DriverTransport(host)});
  host.driverState=driver.state;
  if(driver.state.state==='occupied'){
    // Synchronously barrier the legacy write gate before any await below: the factory is already
    // callable, and a resume in this installation window must wait rather than publish a placeholder.
    driver.factory.claimWriteGate();
    const gateTimeout=setTimeout(()=>driver.factory.failWriteGate(Object.assign(new Error('legacy write gate initialization timed out'),{code:'legacy-write-gate-timeout'})),30000);
    gateTimeout.unref?.();
    ctx.effect(()=>()=>clearTimeout(gateTimeout),'zcode-driver: legacy write gate timeout');
    // The zcode llm route is registered here, not in the retired host mirror wiring: the picker
    // catalog and the deployment-default cover both depend on the adapter being present whenever
    // the driver occupies the factory.
    // Discovery is a lazy callback: the host assigns `zcodeModels` asynchronously at the end of
    // `installZCodeRuntime`, which the parent fiber does not await. Judging its presence once at
    // install time would race and leave the route unregistered; resolve it on every catalog query
    // instead and let an empty discovery simply advertise nothing until the host is ready.
    const llmSeam=ctx.inject(['llm'],llmCtx=>{
      try{
        const route=installZCodeLlm(llmCtx,{discover:()=>typeof host.zcodeModels==='function'?host.zcodeModels():[]});
        host.llmRouteState={state:'registered',discovery:()=>typeof host.zcodeModels==='function'};
        // Discovery readiness emits no event of its own. When it first becomes available, re-announce
        // the route through the official handle so `llm/adapters-updated` fires once and wakes both
        // the official catalog cache and the default-model cover listener in the same turn.
        const stop=armLlmRouteReadiness({
          replace:route.replace,
          isReady:()=>typeof host.zcodeModels==='function',
          onReady:error=>{host.llmRouteState=error?{state:'failed',error:error?.code??String(error)}:{state:'registered',discovery:()=>true,announced:true}},
        });
        if(typeof llmCtx.effect==='function')llmCtx.effect(()=>stop,'zcode-driver: llm route readiness');
      }
      catch(error){host.llmRouteState={state:'failed',error:error?.code??String(error)}}
    });
    if(ctx.get('llm'))await llmSeam.await();
    // The model seat lives beside the S02 command seams on the same official controller object,
    // but does not need the title service; resolve it from the already-injected scope.
    const seams=ctx.inject(['sessionController','sessionTitle'],async seamCtx=>{
      const [{normalizeSessionTitle},{RemoteError}]=await Promise.all([import('@deepseek-ai/dsh-session-title'),import('@deepseek-ai/dsh-typert-protocol')]);
      seamCtx.fiber.assertActive();
      if(driver.factory.accepting){
        installSessionCommandSeams(seamCtx,driver.factory,{normalizeSessionTitle,RemoteError});
        installModelSeat(seamCtx,driver.factory);
      }
    });
    if(ctx.get('sessionController')&&ctx.get('sessionTitle'))await seams.await();
    installDefaultModelCover(ctx);
    // Legacy migration + catalog import: the native archive is one-shot (snapshot semantics), the
    // directory eagerly backfills each ZCode catalog row before it becomes readable, and resume is
    // gated on that backfill. The host mirror publication chain is not touched.
    const legacy=ctx.inject(['sessionPersistence','sessionQuery','sessions','workspaceRegistry'],async legacyCtx=>{
      const persistence=legacyCtx.get('sessionPersistence'),sessionQuery=legacyCtx.get('sessionQuery');
      const sessions=legacyCtx.get('sessions'),workspaceRegistry=legacyCtx.get('workspaceRegistry');
      if(!persistence||!sessionQuery||!sessions||!workspaceRegistry){
        host.legacyState={state:'unavailable',reason:'legacy-services-missing'};
        clearTimeout(gateTimeout);
        driver.factory.failWriteGate(Object.assign(new Error('legacy write gate is unavailable: legacy services are not mounted'),{code:'legacy-write-gate-unavailable'}));
        return;
      }
      legacyCtx.fiber.assertActive();
      const store=new DriverStateStore(process.env.DSH_HOME??join(homedir(),'.dsh'));
      await store.load();
      try{
        const archive=await runNativeArchive({
          store,
          listSessionIds:async()=>(await sessionQuery.listSessions()).map(record=>record.header.id),
          readEvents:async id=>(await sessionQuery.readSession(id)).events,
          archive:id=>workspaceRegistry.archiveSession(id),
        });
        host.nativeArchiveState=archive.outcome;
      }catch(error){host.nativeArchiveState={state:'archive-failed',error:error?.code??String(error)}}
      const directory=installLegacyDirectory(legacyCtx,{
        store,persistence,sessions,
        attachments:()=>legacyCtx.get('attachments'),
        listCatalog:signal=>typeof host.zcodeCatalog==='function'?host.zcodeCatalog(signal):[],
        listPersistedIds:async()=>new Set((await sessionQuery.listSessions()).map(record=>record.header.id)),
        request:(method,params,options)=>{
          const peer=driver.factory.transport.peer;
          if(!peer)throw Object.assign(new Error('execution-unavailable'),{code:'execution-unavailable'});
          return peer.request(method,params,options);
        },
        onError:(error,row)=>legacyCtx.logger?.warn?.(`zcode-driver: legacy backfill for ${row?.sessionId??'unknown'} failed: ${error?.code??error}`),
      });
      clearTimeout(gateTimeout);
      driver.factory.setWriteGate((id,signal)=>directory.ensureReadable(id,{signal}));
      host.legacyState={state:'ready'};
    });
    if(ctx.get('sessionPersistence')&&ctx.get('sessionQuery'))await legacy.await();
  }
  ctx.effect(()=>async()=>{try{await driver.dispose()}finally{if(host.driverState===driver.state)host.driverState={state:'unavailable',reason:'driver-unloaded'}}},'zcode-driver: factory lifecycle');
}
