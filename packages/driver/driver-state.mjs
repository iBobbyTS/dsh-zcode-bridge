import {mkdir, readFile, writeFile, rename} from 'node:fs/promises';
import {join} from 'node:path';

const validBinding=value=>typeof value==='string'||value!==null&&typeof value==='object'&&!Array.isArray(value)&&typeof value.sessionId==='string';
export const validModelCatalog=value=>{
  if(value===null||typeof value!=='object'||Array.isArray(value))return false;
  if(!Array.isArray(value.providers))return false;
  for(const provider of value.providers){
    if(provider===null||typeof provider!=='object'||Array.isArray(provider))return false;
    if(typeof provider.id!=='string'||!provider.id)return false;
    if(!Array.isArray(provider.models))return false;
    for(const model of provider.models){
      if(model===null||typeof model!=='object'||Array.isArray(model))return false;
      if(typeof model.id!=='string'||!model.id)return false;
      if(model.reasoningLevels!==undefined&&!Array.isArray(model.reasoningLevels))return false;
      if(model.defaultReasoningLevel!==undefined&&typeof model.defaultReasoningLevel!=='string')return false;
    }
  }
  if(value.refreshedAt!==undefined&&typeof value.refreshedAt!=='number')return false;
  return true;
};
const fault=code=>Object.assign(new Error(code),{code});
const validRecoveryEntry=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
  &&typeof value.replacements==='object'&&value.replacements!==null&&!Array.isArray(value.replacements)
  &&Array.isArray(value.completedInputs)&&value.completedInputs.every(id=>typeof id==='string');

/** Per-session recovery keys: replacement input identities and completed-input fingerprints.
 * These must live outside session events — the host persistence vocabulary refuses unknown
 * event types on cold read and Session.append cannot stamp the envelope `ignorable` — so the
 * driver keeps them in its own durable file next to the binding index. */
export class RecoveryKeyIndex {
  // Internal maps keep arbitrary message ids safe from prototype members (`constructor`,
  // `toString`, `__proto__`); plain objects exist only at the JSON file boundary.
  #sessions=new Map();#store=null;#pending=[];
  attach(store){
    if(this.#store)return;
    this.#store=store;
    const recovery=store.value.recovery??{};
    store.value.recovery=recovery;
    for(const [sessionId,entry] of Object.entries(recovery)){
      if(this.#sessions.has(sessionId)||!validRecoveryEntry(entry))continue;
      this.#sessions.set(sessionId,{replacements:new Map(Object.entries(entry.replacements)),completedInputs:new Set(entry.completedInputs)});
    }
    if(this.#pending.length){
      for(const op of this.#pending)op();
      this.#pending=[];
      // The drain must serialize the buffered keys into the store value before saving:
      // memory alone would leave a rebuilt index empty on the next cold start.
      // The drain must serialize the buffered keys into the store value before saving:
      // memory alone would leave a rebuilt index empty on the next cold start.
      const write=this.#persist();
      void (write?write.catch(()=>{}):Promise.resolve());
    }
  }
  #entry(sessionId){
    let entry=this.#sessions.get(sessionId);
    if(!entry){entry={replacements:new Map(),completedInputs:new Set()};this.#sessions.set(sessionId,entry)}
    return entry;
  }
  #persist(){
    if(!this.#store)return;
    this.#store.value.recovery=Object.fromEntries([...this.#sessions]
      .map(([sessionId,{replacements,completedInputs}])=>[sessionId,{replacements:Object.fromEntries(replacements),completedInputs:[...completedInputs]}]));
    return this.#store.save();
  }
  /** Current replacement commandIds by message id for one session (copy for read-only use). */
  replacementsOf(sessionId){return new Map(this.#sessions.get(sessionId)?.replacements??[])}
  /** Completed-input fingerprints recorded for one session (copy for read-only use). */
  completedInputsOf(sessionId){return new Set(this.#sessions.get(sessionId)?.completedInputs)}
  /** Durably record a discard-replacement identity; resolves once the key is persisted. */
  recordReplacement(sessionId,messageId,commandId){
    if(typeof sessionId!=='string'||!sessionId||typeof messageId!=='string'||!messageId||typeof commandId!=='string'||!commandId)return Promise.resolve();
    const op=()=>{this.#entry(sessionId).replacements.set(messageId,commandId)};
    if(!this.#store){this.#pending.push(op);op();return Promise.resolve()}
    op();
    return this.#persist()??Promise.resolve();
  }
  /** Append-only completed-input fingerprint; best-effort persistence like the binding index. */
  recordCompletion(sessionId,sourceCommandId){
    if(typeof sessionId!=='string'||!sessionId||typeof sourceCommandId!=='string'||!sourceCommandId)return;
    const op=()=>{this.#entry(sessionId).completedInputs.add(sourceCommandId)};
    if(!this.#store){this.#pending.push(op);op();return}
    op();
    void this.#persist().catch(()=>{});
  }
}

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
      this.value={
        version:1,
        nativeArchive:data.nativeArchive??null,
        legacy:data.legacy??{},
        bindings:Object.fromEntries(Object.entries(data.bindings??{}).filter(([,value])=>validBinding(value))),
        ...(typeof data.executionWorkspace==='string'?{executionWorkspace:data.executionWorkspace}:{}),
        ...(validModelCatalog(data.modelCatalog)?{modelCatalog:data.modelCatalog}:{}),
        ...(data.recovery!==undefined&&data.recovery!==null&&typeof data.recovery==='object'&&!Array.isArray(data.recovery)
          ?{recovery:Object.fromEntries(Object.entries(data.recovery).filter(([,value])=>validRecoveryEntry(value)))}:{})
      };
    }catch(error){if(error.code!=='ENOENT')throw error}
    return this.value;
  }
  ensureLoaded(){return this.loading??=this.load()}
  readModelCatalog(){return this.value.modelCatalog}
  writeModelCatalog(catalog){
    this.value.modelCatalog=catalog;
    return this.save();
  }
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
