import React,{useEffect,useSyncExternalStore} from 'react';
import {RuntimeControls} from './runtime.mjs';
export const ZCODE_PROVIDER='zcode';
const h=React.createElement;
/** Whale path from the official brand wordmark (decorative, currentColor). */
const WHALE_PATH='M23.0584 4.95203C22.8129 4.83203 22.7074 5.06103 22.5639 5.17704C22.5149 5.21454 22.4734 5.26354 22.4319 5.30854C22.0734 5.69155 21.6543 5.94306 21.1073 5.91306C20.3073 5.86806 19.6243 6.11957 19.0203 6.73158C18.8918 5.97706 18.4652 5.52655 17.8162 5.23754C17.4767 5.08753 17.1332 4.93703 16.8952 4.61052C16.7292 4.37801 16.6837 4.11901 16.6007 3.8635C16.5477 3.70949 16.4952 3.55199 16.3177 3.52549C16.1252 3.49549 16.0497 3.65699 15.9742 3.792C15.6722 4.34401 15.5552 4.95203 15.5667 5.56805C15.5932 6.95359 16.1782 8.05712 17.3407 8.84215C17.4727 8.93215 17.5067 9.02215 17.4652 9.15366C17.3857 9.42416 17.2917 9.68667 17.2087 9.95718C17.1557 10.1297 17.0767 10.1677 16.8917 10.0922C16.2537 9.82568 15.7027 9.43117 15.2156 8.95465C14.3891 8.15513 13.6416 7.2726 12.7096 6.58158C12.4906 6.42007 12.2716 6.27007 12.045 6.12707C11.094 5.20354 12.1696 4.44502 12.4186 4.35501C12.6791 4.26101 12.5091 3.938 11.6675 3.942C10.826 3.9455 10.056 4.22751 9.07446 4.60302C8.93096 4.65952 8.77995 4.70052 8.62545 4.73452C7.73492 4.56552 6.80989 4.52802 5.84386 4.63702C4.02481 4.83953 2.57177 5.69955 1.50373 7.1676C0.220694 8.93215 -0.0813148 10.9372 0.288196 13.0283C0.676708 15.2323 1.80174 17.0569 3.53029 18.4834C5.32285 19.9625 7.38741 20.6875 9.74298 20.5485C11.1735 20.466 12.7661 20.2745 14.5626 18.7539C15.0156 18.9795 15.4912 19.0695 16.2797 19.137C16.8872 19.1935 17.4722 19.107 17.9252 19.013C18.6347 18.8629 18.5857 18.2059 18.3292 18.0854C16.2497 17.1169 16.7062 17.5109 16.2912 17.1919C17.3477 15.9419 18.9618 13.7198 19.4598 10.6942C19.5088 10.3602 19.5713 9.88968 19.5638 9.61917C19.5598 9.45417 19.5978 9.39016 19.7863 9.37116C20.3073 9.31116 20.8128 9.16866 21.2773 8.91315C22.6249 8.17713 23.1684 6.96809 23.2964 5.51905C23.3154 5.29754 23.2924 5.06853 23.0584 4.95203ZM11.3165 17.9954C9.30097 16.4109 8.32344 15.8894 7.91992 15.9119C7.54241 15.9344 7.61042 16.3664 7.69342 16.6479C7.78042 16.9259 7.89342 17.1174 8.05193 17.3614C8.16143 17.5229 8.23694 17.7629 7.94243 17.9434C7.29341 18.3449 6.16487 17.8084 6.11187 17.7819C4.79833 17.0084 3.7003 15.9874 2.92628 14.5908C2.17875 13.2468 1.74474 11.8047 1.67324 10.2657C1.65424 9.89418 1.76374 9.76267 2.13375 9.69517C2.62077 9.60517 3.12278 9.58617 3.6093 9.65767C5.66636 9.95818 7.41741 10.8777 8.88545 12.3348C9.72348 13.1643 10.3575 14.1558 11.0105 15.1243C11.705 16.1529 12.4521 17.1329 13.4036 17.9364C13.7396 18.2179 14.0076 18.4319 14.2641 18.5899C13.4906 18.6764 12.1996 18.6949 11.3165 17.9964V17.9954ZM12.2826 11.7817C12.2826 11.6167 12.4146 11.4852 12.5806 11.4852C12.6181 11.4852 12.6521 11.4927 12.6826 11.5037C12.7241 11.5187 12.7621 11.5412 12.7921 11.5752C12.8451 11.6277 12.8751 11.7027 12.8751 11.7817C12.8751 11.9467 12.7431 12.0782 12.5771 12.0782C12.4111 12.0782 12.2826 11.9467 12.2826 11.7817ZM15.2831 13.3208C15.0906 13.3998 14.8981 13.4673 14.7131 13.4748C14.4261 13.4898 14.1131 13.3733 13.9431 13.2308C13.6791 13.0093 13.4901 12.8853 13.4111 12.4988C13.3771 12.3338 13.3961 12.0782 13.4261 11.9317C13.4941 11.6162 13.4186 11.4137 13.1961 11.2297C13.0151 11.0797 12.7846 11.0382 12.5316 11.0382C12.4371 11.0382 12.3506 10.9967 12.2861 10.9632C12.1806 10.9107 12.0936 10.7792 12.1766 10.6177C12.2031 10.5652 12.3316 10.4377 12.3616 10.4152C12.7051 10.2197 13.1011 10.2837 13.4676 10.4302C13.8071 10.5692 14.0641 10.8242 14.4336 11.1847C14.8111 11.6202 14.8791 11.7402 15.0941 12.0672C15.2641 12.3228 15.4186 12.5853 15.5247 12.8858C15.5887 13.0733 15.5057 13.2268 15.2831 13.3208Z';

/** Provider badge kind for one selection provider: mirrored ZCode vs built-in DeepSeek. */
export function providerBadgeKind(provider){return provider===ZCODE_PROVIDER?'zcode':'whale'}
function WhaleBadge(){return h('svg',{width:16,height:16,viewBox:'0 0 24 24',fill:'none',role:'img','aria-label':'DeepSeek','data-zcode-provider-badge':'whale',style:{flexShrink:0,color:'var(--dsw-alias-label-secondary)'}},h('path',{d:WHALE_PATH,fill:'currentColor'}))}
function ZBadge(){return h('svg',{width:16,height:16,viewBox:'0 0 24 24',fill:'none',role:'img','aria-label':'ZCode','data-zcode-provider-badge':'zcode',style:{flexShrink:0,color:'var(--dsw-alias-label-primary)'}},[h('rect',{key:'bg',x:1,y:1,width:22,height:22,rx:6,fill:'currentColor'}),h('path',{key:'z',d:'M7 6h10v2.2L10.4 16H17v2H7v-2.2L13.6 8H7z',fill:'var(--dsw-alias-label-primary-inverted,#fff)'})])}
/** Additive composer badge: reads the same per-session directory the official ModelSelect renders. */
export function ProviderBadge({store}){
  const state=store?useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot):null;
  if(!state)return null;
  return providerBadgeKind(state.current?.provider)==='zcode'?h(ZBadge):h(WhaleBadge);
}
/** Read-only per-session runtime display for the composer tool row. Native sessions show DSH;
 * mirrored ZCode sessions show the locked runtime and the D4 shared-GUI hint. */
export function RuntimeLockedLabel({controls,sessionId}){
  useSyncExternalStore(controls.subscribe,controls.getSnapshot,controls.getSnapshot);
  useEffect(()=>{void controls.info(sessionId).catch(()=>{})},[controls,sessionId]);
  const info=controls.infos.get(sessionId);
  if(!info)return null;
  if(info.runtime==='native')return h('span',{ 'data-zcode-runtime-locked':'native',title:'DSH native runtime'},'DSH');
  return h('span',{'data-zcode-runtime-locked':'zcode',role:'group','aria-label':'ZCode runtime',style:{display:'inline-flex',gap:6,alignItems:'center'}},[
    h('span',{key:'label'},'ZCode · locked'),
    h('span',{key:'hint',role:'note',style:{color:'var(--dsw-alias-label-secondary)'}},info.hint??'官方 GUI 可能正在运行本会话'),
    info.bindingHint?h('span',{key:'binding',role:'note','data-zcode-binding-hint':'',style:{color:'var(--dsw-alias-label-warning, var(--dsw-alias-label-secondary))'}},info.bindingHint):null,
  ]);
}

const RECEIPTS={pending:'等待官方回执',accepted:'官方已受理',queued:'官方已排队',rejected:'官方未受理', 'outcome-unknown':'结果未知（不自动重发）'};
/** Session-scoped official lifecycle presentation, with no local queue mutations. */
export function RuntimeLifecycleDock({controls,sessionId}){
  useSyncExternalStore(controls.subscribe,controls.getSnapshot,controls.getSnapshot);
  useEffect(()=>controls.watch(sessionId),[controls,sessionId]);
  const owner=React.useRef({sessionId});if(owner.current.sessionId!==sessionId)owner.current={sessionId};
  const [busy,setBusy]=React.useState(false),[error,setError]=React.useState(null),[editing,setEditing]=React.useState(null);
  useEffect(()=>{setBusy(false);setError(null);setEditing(null)},[sessionId]);
  const info=controls.infos.get(sessionId),state=info?.lifecycle;
  if(info?.runtime!=='zcode'||!state)return null;
  const act=async(operation,params)=>{const acting=owner.current;setBusy(true);setError(null);try{const result=await controls.control(sessionId,operation,params);if(acting!==owner.current)return;if(!['accepted','duplicate'].includes(result.ack?.status))setError(result.ack?.reasonCode??result.state);else setEditing(null)}catch(error){if(acting===owner.current)setError(error.code??error.message)}finally{if(acting===owner.current)setBusy(false)}};
  const ready=state.confirmed&&!busy;
  const receipts=state.receipts??[];
  return h('div',{'data-zcode-lifecycle':'',style:{display:'grid',gap:6}},[
    h('div',{key:'state',role:'status','data-zcode-connection':state.status},state.reason?`ZCode 不可用：${state.reason}；自动恢复后刷新官方状态`:`ZCode：${state.control?.phase??state.status} · ${state.control?.activeWorks?.length??0} 个活动任务`),
    h('button',{key:'stop',type:'button','aria-label':'Stop ZCode',disabled:!ready||!state.control?.canStop,onClick:()=>void act('cancel')},state.control?.stopState==='stopping'?'正在停止':'停止 ZCode'),
    h('div',{key:'queue','data-zcode-queue':'',role:'group','aria-label':'Official ZCode queue'},[
      h('span',{key:'label'},`官方队列：${state.queue.items.length} · ${state.queue.autoDrain?'自动执行':`已暂停${state.queue.pauseReason?'：'+state.queue.pauseReason:''}`}`),
      ...state.queue.items.map(item=>h('div',{key:item.queueItemId,'data-zcode-queue-item':item.queueItemId},[
        h('span',{key:'text'},item.text),
        h('span',{key:'status',role:'status'},` · ${item.dispatch.state} · ${item.steer.state}`),
        item.steer.reasonCode?h('span',{key:'reason'},` · ${item.steer.reasonCode}`):null,
        h('button',{key:'edit',type:'button',disabled:!ready||item.dispatch.state!=='queued'||item.kind==='compact'||!state.availability?.queueEdit.allowed,onClick:()=>setEditing({sessionId,id:item.queueItemId,text:item.text})},'编辑'),
        h('button',{key:'send',type:'button',disabled:!ready||item.dispatch.state!=='queued'||!state.availability?.sendQueuedNow.allowed,onClick:()=>void act('queue',{action:'sendNow',queueItemId:item.queueItemId})},'立即发送'),
      ])),
    ]),
    editing?.sessionId===sessionId?h('form',{key:'editor',onSubmit:event=>{event.preventDefault();void act('queue',{action:'edit',queueItemId:editing.id,newText:editing.text})}},[
      h('input',{key:'input','aria-label':'Official queue text',value:editing.text,onChange:event=>setEditing({...editing,text:event.target.value})}),h('button',{key:'save',type:'submit',disabled:!ready},'保存'),h('button',{key:'cancel',type:'button',onClick:()=>setEditing(null)},'取消编辑'),
    ]):null,
    ...receipts.map(receipt=>h('div',{key:receipt.commandId,role:receipt.receiptClass==='rejected'?'alert':'status','data-zcode-receipt':receipt.receiptClass,'data-zcode-command':receipt.commandId},`${RECEIPTS[receipt.receiptClass]??receipt.receiptClass}${receipt.reason?'：'+receipt.reason:''}`)),
    error?h('div',{key:'error',role:'alert'},error):null,
  ]);
}

export function RuntimeHero({controls,create}){
  const state=useSyncExternalStore(controls.subscribe,controls.getSnapshot,controls.getSnapshot);const [error,setError]=React.useState(null);
  return h('div',{'data-zcode-runtime-hero':'',role:'group','aria-label':'New session runtime'},[
    h('label',{key:'label'},'Runtime ',h('select',{'aria-label':'New session runtime',value:state.runtime,onChange:event=>controls.stage(event.target.value)},[h('option',{key:'zcode',value:'zcode'},'ZCode'),h('option',{key:'native',value:'native'},'DSH native')])),
    ' ',
    h('button',{key:'create',type:'button',onClick:()=>{setError(null);void create().catch(error=>setError(error.code??error.message))}},'新建会话'),
    error?h('span',{key:'error',role:'alert'},error):null,
  ]);
}
function directoryStore(models,sessionId){try{return {store:models?.directoryFor(sessionId)?.store??null}}catch{return {store:null}}}
async function waitForDirectory(models,sessionId){for(let attempt=0;attempt<40;attempt++){try{return models.directoryFor(sessionId)}catch{await new Promise(resolve=>setTimeout(resolve,50))}}throw Object.assign(new Error('model-selection-unavailable'),{code:'model-selection-unavailable'})}
/** Bind a freshly created ZCode Session to the first discovered ZCode account model through the
 * official selection service (which routes to the mirrored runtime via the session guards). */
export async function applyZCodeDefault(models,sessionId){
  if(!models)throw Object.assign(new Error('model-selection-unavailable'),{code:'model-selection-unavailable'});
  const directory=await waitForDirectory(models,sessionId);
  const state=await directory.load();
  const model=state.groups.find(group=>group.id===ZCODE_PROVIDER)?.models[0];
  if(!model)return null;
  return directory.select({provider:ZCODE_PROVIDER,model:model.id,...(model.reasoning?.defaultEffort?{reasoningEffort:model.reasoning.defaultEffort}:{})});
}
export function installRuntimeControls(ctx){
  const controls=new RuntimeControls(ctx.connection.rpc,{connectionGeneration:ctx.connection.generation});
  let models=null;
  // directoryFor() runs behind the caller-ctx tracker and needs the same remote faces the
  // official model seat declares; inject them so our badge/default share its exact store.
  ctx.inject(['slots','modelDirectories','remote','remote.session'],scope=>{
    models=scope.modelDirectories;
    // Additive badge left of the picker; official ModelSelect is never shadowed.
    scope.slots.inject('conversation.input.right',()=>scope.slots.register({name:'conversation.input.right',id:'zcode-runtime-badge',order:-1,registrant:'zcode-runtime-badge',inject:sessionId=>directoryStore(scope.modelDirectories,sessionId)},ProviderBadge));
  });
  const restore=controls.install(ctx.sessions,{defaultSelection:sessionId=>applyZCodeDefault(models,sessionId)});
  ctx.effect(()=>()=>{restore();controls.dispose()},'zcode-bridge: runtime controls');
  ctx.slots.inject('conversation.hero.agentPreset',()=>ctx.slots.register({name:'conversation.hero.agentPreset',priority:-1,inject:()=>({controls,create:async()=>{const id=await ctx.sessions.create();ctx.uiWorkspace.openSession(id);return id}})},RuntimeHero));
  // Read-only runtime display right of the Standard-mode cluster. No selection UI.
  ctx.slots.inject('conversation.input.left',()=>ctx.slots.register({name:'conversation.input.left',id:'zcode-runtime-locked',order:1,registrant:'zcode-runtime-locked',inject:sessionId=>({controls,sessionId})},RuntimeLockedLabel));
  ctx.slots.inject('conversation.input.dock',()=>ctx.slots.register({name:'conversation.input.dock',id:'zcode-lifecycle',order:21,registrant:'zcode-lifecycle',inject:sessionId=>({controls,sessionId})},RuntimeLifecycleDock));
  return controls;
}
