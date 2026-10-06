import {mkdir, readFile, writeFile, rename} from 'node:fs/promises';
import {join} from 'node:path';

const fault=code=>Object.assign(new Error(code),{code});

/** Driver-owned durable state: the one-shot native-archive snapshot and the per-session legacy
 * backfill state machine. Kept separate from the host mirror RuntimeStore so the driver never
 * depends on the retiring mirror identity layer. One atomic writer serializes local persistence. */
export class DriverStateStore {
  value={version:1,nativeArchive:null,legacy:{}};writing=Promise.resolve();
  constructor(root){this.file=join(root,'zcode-bridge','driver-state.json')}
  async load(){
    try{
      const data=JSON.parse(await readFile(this.file,'utf8'));
      if(data.version!==1||typeof data!=='object'||data.legacy!==undefined&&typeof data.legacy!=='object')throw fault('driver-state-invalid');
      this.value={version:1,nativeArchive:data.nativeArchive??null,legacy:data.legacy??{}};
    }catch(error){if(error.code!=='ENOENT')throw error}
    return this.value;
  }
  save(){
    const bytes=JSON.stringify(this.value);
    this.writing=this.writing.then(async()=>{await mkdir(join(this.file,'..'),{recursive:true,mode:0o700});const temporary=this.file+'.tmp';await writeFile(temporary,bytes,{mode:0o600});await rename(temporary,this.file)});
    return this.writing;
  }
}
