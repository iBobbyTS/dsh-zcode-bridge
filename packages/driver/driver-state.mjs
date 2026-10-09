import {mkdir, readFile, writeFile, rename} from 'node:fs/promises';
import {join} from 'node:path';

const validBinding=value=>typeof value==='string'||value!==null&&typeof value==='object'&&!Array.isArray(value)&&typeof value.sessionId==='string';
const fault=code=>Object.assign(new Error(code),{code});

/** Driver-owned durable state: the one-shot native-archive snapshot, the per-session legacy
 * backfill state machine and the conversation binding index. Kept separate from the host mirror
 * RuntimeStore so the driver never depends on the retiring mirror identity layer. One atomic
 * writer serializes local persistence. */
export class DriverStateStore {
  value={version:1,nativeArchive:null,legacy:{},bindings:{}};writing=Promise.resolve();
  constructor(root){this.file=join(root,'zcode-bridge','driver-state.json')}
  async load(){
    try{
      const data=JSON.parse(await readFile(this.file,'utf8'));
      if(data.version!==1||typeof data!=='object'||data.legacy!==undefined&&typeof data.legacy!=='object'||data.bindings!==undefined&&typeof data.bindings!=='object')throw fault('driver-state-invalid');
      this.value={version:1,nativeArchive:data.nativeArchive??null,legacy:data.legacy??{},bindings:Object.fromEntries(Object.entries(data.bindings??{}).filter(([,value])=>validBinding(value))),...(typeof data.executionWorkspace==='string'?{executionWorkspace:data.executionWorkspace}:{})};
    }catch(error){if(error.code!=='ENOENT')throw error}
    return this.value;
  }
  ensureLoaded(){return this.loading??=this.load()}
  save(){
    const bytes=JSON.stringify(this.value);
    this.writing=this.writing.then(async()=>{await mkdir(join(this.file,'..'),{recursive:true,mode:0o700});const temporary=this.file+'.tmp';await writeFile(temporary,bytes,{mode:0o600});await rename(temporary,this.file)});
    return this.writing;
  }
}

/** zcode-conversation → DSH-session binding index. The binding event itself lives inside each
 * session log where the 5s catalog poll cannot afford to read it, and headers carry no binding,
 * so without this index every catalog row a DSH-created session materializes at its first turn
 * looks unowned and imports as a second, zcode-id-keyed record. The factory records each binding
 * (create, fork, resume); the legacy directory consults it before creating a placeholder.
 * The factory is callable before the legacy wiring loads the state file, so writes buffer until
 * `attach` and then persist through the store's serialized atomic save. */
export class ConversationBindingIndex {
  #entries=new Map();#store=null;#pending=[];
  attach(store){
    if(this.#store)return;
    this.#store=store;
    for(const [zcodeConversationId,value] of Object.entries(store.value.bindings??{}))if(validBinding(value)&&!this.#entries.has(zcodeConversationId))this.#entries.set(zcodeConversationId,value);
    if(this.#pending.length){
      for(const entry of this.#pending)this.#apply(entry);
      void store.save().catch(()=>{});
      this.#pending=[];
    }
  }
  bind(zcodeConversationId,sessionId,workspace){
    if(typeof zcodeConversationId!=='string'||!zcodeConversationId||typeof sessionId!=='string'||!sessionId)return;
    // Identity is the imported-session case: the record itself keys the zcode id, so there is
    // no separate DSH owner to index.
    if(zcodeConversationId===sessionId)return;
    const value=typeof workspace==='string'?{sessionId,workspace}:sessionId;
    if(this.ownerOf(zcodeConversationId)===sessionId&&this.workspaceOf(zcodeConversationId)===workspace)return;
    this.#entries.set(zcodeConversationId,value);
    if(!this.#store){this.#pending.push([zcodeConversationId,value]);return}
    this.#apply([zcodeConversationId,value]);
    void this.#store.save().catch(()=>{});
  }
  /** The DSH session id that owns this zcode conversation, when it is a different record. */
  ownerOf(zcodeConversationId){
    const value=this.#entries.get(zcodeConversationId),sessionId=typeof value==='string'?value:value?.sessionId;
    return typeof sessionId==='string'&&sessionId!==zcodeConversationId?sessionId:undefined;
  }
  workspaceOf(zcodeConversationId){const value=this.#entries.get(zcodeConversationId);return typeof value?.workspace==='string'?value.workspace:undefined}
  #apply([zcodeConversationId,sessionId]){this.#store.value.bindings[zcodeConversationId]=sessionId}
}
