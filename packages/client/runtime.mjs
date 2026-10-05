const fault=code=>Object.assign(new Error(code),{code});
/** Generation-fenced control plane. Transcript, streaming and approval presentation remain owned
 * by official DSH Session bindings; this store owns only runtime selectors and operation receipts. */
export class RuntimeControls {
  snapshot={runtime:'zcode',selection:null};listeners=new Set();infos=new Map();bindings=new Map();owners=new Map();usages=new Map();generation=0;disposed=false;
  constructor(rpc,{connectionGeneration}={}){this.rpc=rpc;this.off=connectionGeneration?.subscribe(()=>{this.generation++;this.infos.clear();this.publish()})}
  subscribe=listener=>{this.listeners.add(listener);return ()=>this.listeners.delete(listener)};
  getSnapshot=()=>this.snapshot;
  publish(){this.snapshot={...this.snapshot};for(const listener of this.listeners)listener()}
  stage(runtime){if(!['native','zcode'].includes(runtime))throw fault('runtime-invalid');this.snapshot={...this.snapshot,runtime};this.publish()}
  async call(payload){const result=await this.rpc.call('/zcode-bridge','runtime',payload,new AbortController().signal);if(!result.ok)throw fault(result.error.code);return result.value}
  async info(id){const generation=this.generation;const value=await this.call({operation:'info',sessionId:id});if(!this.disposed&&generation===this.generation){this.infos.set(id,value);this.publish()}return value}
  install(sessions,{defaultSelection}={}){const original=sessions.create;const controls=this;
    async function create(options={}){
      if(options.sessionId){const info=await controls.info(options.sessionId);if(info.runtime==='zcode'){await controls.open(options.sessionId);return original.call(this,options);}if(this.list.getSnapshot().byId[options.sessionId])return original.call(this,options)}
      if(controls.snapshot.runtime==='native')return original.call(this,options);
      const created=await controls.call({operation:'create',...options,...(controls.snapshot.selection?{selection:controls.snapshot.selection}:{})});
      // A ZCode Session always binds to the launcher execution workspace; the picker's workspaceId/cwd
      // is dropped here so the official create cwd matches the mirror Agent header (no session/conflict).
      const {workspaceId:_pickedWorkspace,cwd:_pickedCwd,...rest}=options;
      const attempt=extra=>original.call(this,{...rest,sessionId:created.sessionId,...extra});
      let id;
      if(created.workspaceId)id=await attempt({workspaceId:created.workspaceId}).catch(error=>{if((error?.rpcError?.code??error?.code)==='workspace/not-found'&&created.workspacePath)return attempt({cwd:created.workspacePath});throw error});
      else if(created.workspacePath)id=await attempt({cwd:created.workspacePath});
      else id=await attempt({});
      await controls.info(id);
      // Default model binding runs after the official binding exists (the Hero opens the session
      // synchronously); a bounded wait in the callback absorbs the materialization tick.
      if(defaultSelection){const binding=Promise.resolve().then(()=>defaultSelection(id));controls.bindings.set(id,binding);await binding;}
      return id;
    }
    sessions.create=create;return ()=>{if(sessions.create===create)sessions.create=original};
  }
  async open(id){const owner={};this.owners.set(id,owner);this.usages.delete(id);const value=await this.call({operation:'open',sessionId:id});if(this.owners.get(id)===owner){this.infos.set(id,value);this.publish()}return value}
  async usage(id){const owner=this.owners.get(id),generation=this.generation;const value=await this.call({operation:'usage',sessionId:id});if(!this.disposed&&generation===this.generation&&this.owners.get(id)===owner){this.usages.set(id,value);this.publish()}return value}
  async select(id,selection){const result=await this.call({operation:'select',sessionId:id,selection});await this.info(id);return result}
  dispose(){this.disposed=true;this.generation++;this.off?.();this.listeners.clear()}
}
