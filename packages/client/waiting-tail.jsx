import React,{useSyncExternalStore} from 'react';
import { ParityController } from './parity.mjs';

const KIND_LABELS={subagent:'后台Subagent',bash:'后台终端命令',workflow:'后台Workflow'};
const STATUS_LABELS={running:'运行中',resultPending:'已完成待投递',failed:'失败',cancelled:'已取消'};
const WAITING_PHASES=new Set(['completedSuccess','completedInterrupted']);
// The probe faults with these codes for every dsh session the bridge does not own; polling
// them forever would be noise, so one hit retires the store until the bundle reloads.
const DEAD_CODES=new Set(['runtime-identity-locked','official-session-required','disposed']);
const POLL_MS=2000;

/** Local, browser-persisted preference (Zcode Bridge settings row). Defaults to on so the
 *  shipped behavior keeps the waiting line; the settings toggle is the single off switch. */
const PREFERENCE_KEY='zcodeBridge.waitingTail';
const readPreference=()=>{try{const raw=globalThis.localStorage?.getItem?.(PREFERENCE_KEY);return raw==null?true:raw==='true'}catch{return true}};
class WaitingPreference{
  #listeners=new Set();#enabled=readPreference();
  subscribe=listener=>{this.#listeners.add(listener);return ()=>this.#listeners.delete(listener)}
  getSnapshot=()=>this.#enabled
  setEnabled(enabled){
    enabled=enabled===true;
    if(enabled===this.#enabled)return;
    this.#enabled=enabled;
    try{globalThis.localStorage?.setItem?.(PREFERENCE_KEY,String(enabled))}catch{/* preference stays session-local when storage is unavailable */}
    for(const listener of [...this.#listeners])listener();
  }
}
export const waitingPreference=new WaitingPreference();

function elapsedLabel(startedAt,now){
  const seconds=Math.max(0,Math.floor((now-startedAt)/1000));
  const hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60);
  return hours>0?`${hours}h ${minutes}m`:`${minutes}m`;
}

/** One poller per session, shared by every turn-tail occurrence of that session. The interval
 *  idles without listeners, so closed or background chats cost nothing. */
class WaitingStore{
  #controller;#listeners=new Set();#snapshot={ready:false,dead:false,phase:null,lastTurn:null,works:[]};#timer;#inFlight=false;
  constructor(rpc,connectionGeneration,sessionId){
    this.#controller=new ParityController(rpc,{sessionId,connectionGeneration});
    this.#timer=setInterval(()=>{void this.#poll()},POLL_MS);
  }
  subscribe=listener=>{this.#listeners.add(listener);if(this.#listeners.size===1)void this.#poll();return ()=>this.#listeners.delete(listener)}
  getSnapshot=()=>this.#snapshot
  #publish(next){this.#snapshot=next;for(const listener of [...this.#listeners])listener()}
  async #poll(){
    if(this.#snapshot.dead||this.#inFlight||!this.#listeners.size||!waitingPreference.getSnapshot())return;
    this.#inFlight=true;
    try{
      const value=await this.#controller.call('waiting','read');
      this.#publish({ready:true,dead:false,phase:value?.phase??null,lastTurn:value?.lastTurn??null,
        works:Array.isArray(value?.works)?value.works:[]});
    }catch(error){
      if(DEAD_CODES.has(error?.code)){this.#publish({...this.#snapshot,dead:true});return}
      // Transient (projection-unconfirmed, reconnect): hide the line, keep polling.
      this.#publish({ready:true,dead:false,phase:null,lastTurn:null,works:[]});
    }finally{this.#inFlight=false}
  }
  dispose(){clearInterval(this.#timer);this.#controller.dispose();this.#listeners.clear()}
}

const stores=new Map();
/** Session-keyed store cache; stores live for the bundle lifetime but only poll while some
 *  turn tail of that session is subscribed. */
export function waitingSession(ctx,sessionId){
  let entry=stores.get(sessionId);
  if(!entry){entry={store:new WaitingStore(ctx.connection.rpc,ctx.connection.generation,sessionId),ref:0};stores.set(sessionId,entry)}
  entry.ref++;
  let released=false;
  return {
    subscribe:entry.store.subscribe,
    getSnapshot:entry.store.getSnapshot,
    release(){
      if(released)return;released=true;
      if(--entry.ref===0){stores.delete(sessionId);entry.store.dispose()}
    },
  };
}

/** Turn-tail waiting line: below the last turn's content, above its actions row. Renders only
 *  while the official conversation rests between turns with undelivered background works; the
 *  wake marker of the next origin=backgroundResult turn replaces it. */
export function ZCodeWaitingTail({turn,waiting}){
  const state=useSyncExternalStore(waiting.subscribe,waiting.getSnapshot,waiting.getSnapshot);
  const enabled=useSyncExternalStore(waitingPreference.subscribe,waitingPreference.getSnapshot,waitingPreference.getSnapshot);
  const turnNumber=turn?.turn;
  if(!enabled||state.dead||!state.works.length||!WAITING_PHASES.has(state.phase))return null;
  if(turnNumber==null||state.lastTurn==null||turnNumber!==state.lastTurn)return null;
  const now=Date.now();
  return <div data-zcode-waiting-tail style={{display:'flex',flexDirection:'column',gap:'2px',padding:'2px 0',
      color:'var(--dsw-alias-label-tertiary)',fontSize:'var(--dsh-content-font-size-secondary,13px)'}}>
    <span style={{display:'inline-flex',alignItems:'center',gap:'6px'}}>
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{color:'var(--dsw-static-neutral-bluish-600,#81858c)'}}>
        <path d="M13.5 8A5.5 5.5 0 1 1 11.9 4.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M13.9 1.6v3h-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      ZCode 待机 · 等待 {state.works.length} 个后台任务
    </span>
    {state.works.map(work=><span key={work.workId} data-zcode-waiting-work={work.workId}>
      {KIND_LABELS[work.kind]??'后台任务'}《{work.title||work.workId}》{STATUS_LABELS[work.status]??work.status}
      {work.status==='running'&&typeof work.startedAt==='number'?` ${elapsedLabel(work.startedAt,now)}`:''}
      {work.turn!=null&&work.turn!==state.lastTurn?`（第 ${work.turn} 轮启动）`:''}
    </span>)}
  </div>;
}

/** List slots are additive, but the registration still needs the slot DECLARED by ui-chat.
 *  The plugin-facing slots facade exposes no declaration probe, so the declaration is detected
 *  the same way as the trigger icon: attempt the registration, fall back to subscribe until
 *  ui-chat's own registration notifications make it legal. */
export function installWaitingTail(ctx){
  const KEY='conversation.chat.turnTail';
  ctx.effect(()=>{
    let dispose;
    const attempt=()=>{
      if(dispose)return true;
      try{
        dispose=ctx.slots.register({name:KEY,id:'zcode-waiting',order:50,registrant:'zcode-waiting',
          inject:sessionId=>({waiting:waitingSession(ctx,sessionId)})},ZCodeWaitingTail);
        return true;
      }catch(error){
        if(!/is not declared/.test(String(error?.message??error)))throw error;
        return false;
      }
    };
    if(!attempt()){
      const unsubscribe=ctx.slots.subscribe(KEY,()=>{if(attempt())unsubscribe()});
      return ()=>{unsubscribe();dispose?.()};
    }
    return ()=>{dispose?.()};
  },'zcode-bridge: waiting tail');
}
