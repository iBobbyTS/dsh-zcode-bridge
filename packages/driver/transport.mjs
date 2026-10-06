import {randomUUID} from 'node:crypto';
import {LauncherPeer} from '../host/launcher/execution.mjs';
import {negotiatedClientHello} from '../host/conversation.mjs';
import {commandAckSchema} from '../host/vendor/zcode/v4.mjs';

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
  async create({cwd,signal}){
    const workspace=await this.ready(cwd,signal),commandId=randomUUID();
    const ack=commandAckSchema.parse(await this.peer.request('v4/command',{
      commandId,clientId:'dsh-zcode-driver',sessionId:null,type:'createSession',issuedAt:Date.now(),
      workspace:{workspacePath:workspace,workspaceKey:workspace},payload:{workspaceId:workspace},
    },{signal}));
    if(ack.commandId!==commandId)throw fault('command-receipt-mismatch');
    if(!['accepted','duplicate'].includes(ack.status)||ack.result?.type!=='createSession'||!ack.result.sessionId)throw fault('driver-create-unconfirmed');
    return ack.result.sessionId;
  }
  async resume({zcodeConversationId,cwd,signal}){await this.ready(cwd,signal);return zcodeConversationId}
  dispose(){this.offRecovery?.();this.peer?.close()}
}
