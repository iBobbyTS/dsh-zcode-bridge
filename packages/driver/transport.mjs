import {randomUUID} from 'node:crypto';
import {LauncherPeer} from '../host/launcher/execution.mjs';
import {V4Conversation,negotiatedClientHello} from '../host/conversation.mjs';
import {commandAckSchema,parseCommandEnvelope} from '../host/vendor/zcode/v4.mjs';

const fault=code=>Object.assign(new Error(code),{code});
/** Reuses the host-owned launcher. It owns only its protocol listeners, never the host. */
export class DriverTransport {
  constructor(host){this.host=host}
  async ready(cwd,signal){
    signal.throwIfAborted();
    await this.host.connect();
    signal.throwIfAborted();
    const state=this.host.launcher?.state;
    if(state?.phase!=='ready'||state.auth!=='authenticated'||!state.executionWorkspace)throw fault('execution-unavailable');
    if(cwd!==undefined&&cwd!==state.executionWorkspace)throw fault('driver-workspace-mismatch');
    if(!this.peer){
      this.peer=new LauncherPeer(this.host.launcher);
      this.offRecovery=this.host.launcher.subscribe(state=>{if(state.phase!=='ready')this.handshake=null});
    }
    if(!this.handshake){
      const flight=(async()=>{const hello=await this.peer.request('hello',undefined,{signal});await this.peer.request('initialize',negotiatedClientHello(hello,{clientId:'dsh-zcode-driver',appVersion:'0.1.0'}),{signal})})().catch(error=>{if(this.handshake===flight)this.handshake=null;throw error});
      this.handshake=flight;
    }
    await this.handshake;
    signal.throwIfAborted();
    return state.executionWorkspace;
  }
  async create({cwd,signal,firstInput,modelSelection,mode}){
    const workspace=await this.ready(cwd,signal),commandId=randomUUID();
    const envelope={
      commandId,clientId:'dsh-zcode-driver',sessionId:null,type:'createSession',issuedAt:Date.now(),
      payload:{workspaceId:workspace,...(firstInput?{firstInput:{...firstInput,...(modelSelection?{modelSelection}:{}),...(mode?{mode}:{})}}:{}),
        ...(!firstInput&&(modelSelection||mode)?{config:{...(modelSelection?{modelSelection}:{}),...(mode?{mode}:{})}}:{})},
    };
    const parsed=parseCommandEnvelope(envelope);
    if(!parsed.ok)throw fault('command-invalid');
    let ack;
    try{ack=commandAckSchema.parse(await this.peer.request('v4/command',{...parsed.envelope,workspace:{workspacePath:workspace,workspaceKey:workspace}},{signal}))}
    catch(error){throw Object.assign(error,{commandId,state:error.sent===false?'not-sent':'outcome-unknown'})}
    if(ack.commandId!==commandId)throw Object.assign(fault('command-receipt-mismatch'),{commandId,state:'outcome-unknown'});
    if(!['accepted','duplicate'].includes(ack.status))throw Object.assign(fault(ack.reasonCode??'driver-create-unconfirmed'),{commandId,ack,state:ack.status});
    if(ack.result?.type!=='createSession'||!ack.result.sessionId)throw Object.assign(fault('driver-create-unconfirmed'),{commandId,ack,state:'outcome-unknown'});
    return ack.result.sessionId;
  }
  conversation({zcodeConversationId,cwd}){
    if(!this.peer)throw fault('execution-unavailable');
    const workspace=cwd??this.host.launcher.state.executionWorkspace;
    return new V4Conversation(this.peer,{
      address:{runtime:'zcode',authority:this.host.status?.sessionAuthority??'official-host',workspace,sessionId:zcodeConversationId},
      workspace:{workspacePath:workspace,workspaceKey:workspace},connectionId:this.peer.connectionId,
      clientId:'dsh-zcode-driver',clientMode:'desktop-continuous',runnable:true,managementAllowed:true,reconnectable:true,
    });
  }
  async resume({zcodeConversationId,cwd,signal}){await this.ready(cwd,signal);return zcodeConversationId}
  dispose(){this.offRecovery?.();this.peer?.close()}
}
