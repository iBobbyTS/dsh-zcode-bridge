import {inboxProjectionDefinition} from './projections.mjs';
import {commandFault,rejectOperation,validateMessage} from './commands.mjs';

/** Only the standard durable splice log stores inbox state. No command settlement lives here. */
export class DriverInbox {
  constructor(agent){this.agent=agent;this.queueIds=new Map()}
  current(){
    let state=inboxProjectionDefinition.init();
    const session=this.agent.session;
    for(let seq=0;seq<session.seq;seq++)state=inboxProjectionDefinition.apply(state,session.eventAt(seq));
    return state;
  }
  get nextTurn(){return this.current()['next-turn']}
  get nextStep(){return this.current()['next-step']}
  locate(id){for(const target of ['next-turn','next-step']){const index=this.current()[target].findIndex(m=>m.id===id);if(index>=0)return {target,index}}}
  commit(target,start,removedCount,inserted,outcome){
    if(!removedCount&&!inserted.length)return [];
    const data={target,start,...(removedCount?{removedCount}:{}),inserted:structuredClone(inserted),...(outcome?{outcome}:{})};
    inboxProjectionDefinition.apply(this.current(),{type:'agent/inbox/spliced',data,seq:this.agent.session.seq});
    const removed=this.current()[target].slice(start,start+removedCount);
    this.agent.session.append('agent/inbox/spliced',data);
    for(const message of removed)if(outcome==='canceled')this.agent.dispatch.emit('agent/inbox/discarded',{message});
    for(const message of inserted)this.agent.dispatch.emit('agent/inbox/inserted',{message});
    return removed;
  }
  admit(target,message){
    validateMessage(message);
    if(!['next-turn','next-step'].includes(target))throw commandFault('official-inbox-target-invalid');
    if(this.locate(message.id))throw commandFault('official-message-already-pending');
    this.commit(target,this.current()[target].length,0,[message]);
  }
  append(target,message){this.agent.send(message,target,true)}
  prepend(){rejectOperation('prepend')}
  splice(){rejectOperation('splice')}
  remove(){rejectOperation('remove')}
  clear(){
    // There is no clear/delete command in the authenticated execution allowlist.
    if(this.agent.conversation?.state.snapshot?.queue.items.length)rejectOperation('clearQueue');
    if(this.agent.conversation?.state.commands.some(command=>command.type==='sendText'&&['sent-unconfirmed','accepted-awaiting-terminal','running','waiting','outcome-unknown'].includes(command.state)))rejectOperation('clearQueue');
    for(const target of ['next-step','next-turn'])this.commit(target,0,this.current()[target].length,[],'canceled');
  }
  replace(id,message){
    const location=this.locate(id);if(!location)return false;
    validateMessage(message);
    if(message.id!==id||message.content.some(part=>part.type!=='text'))throw commandFault('official-queue-edit-invalid');
    const queueItemId=this.queueIds.get(id);
    if(!queueItemId)throw commandFault('queue-item-unconfirmed');
    this.agent.submitControl({type:'editQueueItem',payload:{queueItemId,newText:message.content.map(part=>part.text).join('\n')}});
    return true;
  }
  sync(snapshot){
    const items=snapshot.queue.items;
    for(const [id,queueId] of this.queueIds){
      if(items.some(item=>item.queueItemId===queueId))continue;
      const location=this.locate(id);if(location)this.commit(location.target,location.index,1,[]);
      this.queueIds.delete(id);
    }
    for(const item of items){
      // Foreign attachment refs cannot be reconstructed as DSH store refs.
      const association=[...this.agent.inputs].find(([,input])=>input.commandId===item.sourceCommandId);
      if(item.kind!=='sendText'||item.attachments.length&&!association){
        this.agent.lastError=commandFault('official-queue-content-unavailable');continue;
      }
      const id=association?.[0]??`zcode-queue:${item.queueItemId}`;
      const existing=this.locate(id);
      const message=association?.[1].message??{id,role:'user',source:{kind:'user'},content:[{type:'text',text:item.text}]};
      const updated={...message,content:[{type:'text',text:item.text},...message.content.filter(part=>part.type!=='text')]};
      if(!existing)this.admit('next-turn',updated);
      else if(JSON.stringify(this.current()[existing.target][existing.index].content)!==JSON.stringify(updated.content))this.commit(existing.target,existing.index,1,[updated]);
      this.queueIds.set(id,item.queueItemId);
    }
    for(const [id,input] of this.agent.inputs){
      if(!snapshot.rows.window.some(row=>row.sourceCommandId===input.commandId))continue;
      const location=this.locate(id);if(location)this.commit(location.target,location.index,1,[]);
    }
  }
}
