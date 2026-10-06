import {z} from 'zod';

// Standard rc.2 fold versions. Registered only AFTER factory occupation succeeds.
export const turnBoundaryProjectionDefinition={
  key:'turnBoundary',stateVersion:2,
  stateSchema:z.object({openTurnStartSeq:z.number().int().nonnegative().nullable(),
    lastStepStartSeq:z.number().int().nonnegative().nullable(),
    lastStepBoundary:z.object({kind:z.enum(['start','end']),seq:z.number().int().nonnegative()}).nullable(),
    lastTurn:z.number().int().nonnegative()}),
  init:()=>({openTurnStartSeq:null,lastStepStartSeq:null,lastStepBoundary:null,lastTurn:0}),
  apply(state,event){
    switch(event.type){
      case 'turn/start':return {...state,openTurnStartSeq:event.seq,lastTurn:event.data.turn};
      case 'turn/end':return {...state,openTurnStartSeq:null};
      case 'step/start':return {...state,lastStepStartSeq:event.seq,lastStepBoundary:{kind:'start',seq:event.seq}};
      case 'step/end':return {...state,lastStepBoundary:{kind:'end',seq:event.seq}};
      default:return state;
    }
  },
};
const inboxSchema=z.object({'next-turn':z.array(z.custom()).readonly(),'next-step':z.array(z.custom()).readonly()}).readonly();
export const inboxProjectionDefinition={
  key:'inbox',stateVersion:1,stateSchema:inboxSchema,
  init:()=>({'next-turn':[],'next-step':[]}),
  apply(state,event){
    if(event.type!=='agent/inbox/spliced')return state;
    const {target,start,removedCount=0,inserted}=event.data;
    const list=state[target];
    if(!list||!Number.isSafeInteger(start)||start<0||start>list.length||!Number.isSafeInteger(removedCount)||removedCount<0||start+removedCount>list.length)throw new Error(`invalid persisted inbox splice at session seq ${event.seq}`);
    const next=list.toSpliced(start,removedCount,...inserted);
    const all=target==='next-turn'?[...next,...state['next-step']]:[...state['next-turn'],...next];
    if(new Set(all.map(message=>message.id)).size!==all.length)throw new Error(`invalid persisted inbox splice at session seq ${event.seq}`);
    return {...state,[target]:next};
  },
  wire:{viewSchema:inboxSchema,view:state=>state},
};
