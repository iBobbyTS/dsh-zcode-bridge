import { access, readFile, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { VERIFIED_VERSIONS } from './compatibility.mjs';
const exec = promisify(execFile);
// Single source of truth for the exact verified tuple; see compatibility.mjs.
const verifiedBaseline = VERIFIED_VERSIONS[0];
export const VERIFIED = {version:verifiedBaseline.version,build:verifiedBaseline.build,sha256:verifiedBaseline.bundleSha256};
export class BridgeError extends Error { constructor(code) { super(code); this.code=code; } }
export async function inspectInstallation(appPath, {platform=process.platform}={}) {
  if(platform!=='darwin') throw new BridgeError('unsupported-platform');
  let discovered=[];
  try {const {stdout}=await exec('/usr/bin/mdfind',['kMDItemCFBundleIdentifier == "dev.zcode.app"'],{timeout:3000}); discovered=stdout.trim().split('\n').filter(Boolean);} catch {}
  const candidate=appPath ?? (discovered.length===1?discovered[0]:undefined);
  if(!candidate) throw new BridgeError(discovered.length>1?'installation-ambiguous':'installation-missing');
  let app;try{app=await realpath(candidate)}catch{throw new BridgeError('installation-missing')}
  const plist=join(app,'Contents/Info.plist');
  async function field(key) {try{const {stdout}=await exec('/usr/libexec/PlistBuddy',['-c',`Print:${key}`,plist],{timeout:3000});return stdout.trim()}catch{throw new BridgeError('installation-metadata-invalid')}}
  const bundleId=await field('CFBundleIdentifier');
  if(bundleId!=='dev.zcode.app') throw new BridgeError('installation-metadata-invalid');
  const version=await field('CFBundleShortVersionString'),build=await field('CFBundleVersion');
  const launcher=join(app,'Contents/Frameworks/ZCode Helper.app/Contents/MacOS/ZCode Helper');
  const cjs=join(app,'Contents/Resources/glm/zcode.cjs');
  const providerConfig=join(app,'Contents/Resources/config/provider/zcode-builtin.json');
  for(const [path,code,mode] of [[launcher,'helper-missing',constants.X_OK],[cjs,'runtime-missing',constants.R_OK],[providerConfig,'provider-config-missing',constants.R_OK]]){try{await access(path,mode)}catch{throw new BridgeError(code)}}
  const sha256=createHash('sha256').update(await readFile(cjs)).digest('hex');
  let runtime;
  try {const {stdout}=await exec(launcher,['-e','console.log(JSON.stringify({execPath:process.execPath,node:process.versions.node,electron:process.versions.electron,arch:process.arch}))'],{env:runtimeEnv(providerConfig),timeout:5000,maxBuffer:4096}); runtime=JSON.parse(stdout.trim()); if(await realpath(runtime.execPath)!==await realpath(launcher)||!runtime.electron)throw Error();}catch{throw new BridgeError('launcher-unusable')}
  return {appPath:app,bundleId,version,build,cjs,sha256,launcher,providerConfig,runtime,discovered,verified:version===VERIFIED.version&&build===VERIFIED.build&&sha256===VERIFIED.sha256};
}
/** Credentials and third-party API settings are deliberately not inherited. */
export function runtimeEnv(providerConfig) {
  const env={ELECTRON_RUN_AS_NODE:'1',ZCODE_BUILTIN_PROVIDER_CONFIG_FILE:providerConfig};
  for(const key of ['HOME','PATH','TMPDIR','LANG']) if(process.env[key]) env[key]=process.env[key];
  return env;
}
