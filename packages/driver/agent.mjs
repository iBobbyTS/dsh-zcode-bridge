const unavailable=()=>{throw Object.assign(new Error('ZCode driver command adapter is not installed'),{code:'driver-command-unavailable'})};
const empty=Object.freeze([]);

/** Idle runtime face. Input fails explicitly until the command adapter is installed. */
export class DriverAgent {
  status='idle';disposed=false;activity=null;
  constructor(ctx,session,options,zcodeConversationId,{createScope,agentEvents,parentAgent}){
    Object.assign(this,{id:session.id,session,options:Object.freeze({...options}),zcodeConversationId});
    this.scope=createScope(ctx,this,parentAgent?{parent:parentAgent}:undefined);
    this.ctx=this.scope.ctx;
    this.dispatch=agentEvents(ctx,this);
    this.inbox=Object.freeze({nextTurn:empty,nextStep:empty,clear(){},append:unavailable,prepend:unavailable,
      replace:()=>false,remove:()=>false,splice:unavailable});
  }
  cancel(cause,options={}){if(this.activity)this.activity.controller.abort(cause)}
  async whenIdle(){while(this.activity)await this.activity.done}
  runMaintenance(task){
    if(this.disposed)throw new Error('agent is disposed');
    if(this.activity)throw new Error('agent maintenance is already active');
    const controller=new AbortController();
    let finish;
    const activity={controller,done:new Promise(resolve=>{finish=resolve})};
    this.activity=activity;
    let result;
    try{result=task(controller.signal)}catch(error){result=Promise.reject(error)}
    return Promise.resolve(result).finally(()=>{this.activity=null;finish()});
  }
  send(){unavailable()}
  followup(message){this.send(message,'next-turn',true)}
  steer(message){this.send(message,'next-step',true)}
  inject(message){this.send(message,'next-step',false)}
  async stop(){this.disposed=true;this.cancel({kind:'disposed'});await this.whenIdle()}
}
