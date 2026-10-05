import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
/** Only the background directory preference is local; official runtime state stays official. */
export class BridgeSettings {
  value={catalogSync:true};writing=Promise.resolve();
  constructor(file){this.file=file}
  async load(){if(!this.file)return;try{const value=JSON.parse(await readFile(this.file,'utf8'));this.validate(value);this.value=value}catch(error){if(error.code!=='ENOENT')throw error}}
  validate(value){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==1||typeof value.catalogSync!=='boolean')throw Object.assign(new Error('settings-invalid'),{code:'settings-invalid'})}
  async update(value){this.validate(value);const next={...value};const save=this.writing.catch(()=>{}).then(async()=>{if(this.file){await mkdir(dirname(this.file),{recursive:true,mode:0o700});await writeFile(this.file+'.tmp',JSON.stringify(next),{mode:0o600});await rename(this.file+'.tmp',this.file)}this.value=next});this.writing=save;await save}
}
