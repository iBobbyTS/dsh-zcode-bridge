import { isAbsolute } from 'node:path';
import { fault } from './config.mjs';

// Ordinary configuration validation, with no operator-document authorization gate.
// Credential values are never read; a custom cipher override is rejected by presence only.
export function validateLiveHttpOptions({sharedDatabaseRoot,desktopHome,customCipher=Object.hasOwn(process.env,'ZCODE_CREDENTIAL_SECRET')}={}) {
  if(sharedDatabaseRoot!==undefined)throw fault('live-http-shared-probe-denied');
  if(customCipher)throw fault('live-http-custom-cipher-env-unsupported');
  if(desktopHome!==undefined&&desktopHome!==null&&(typeof desktopHome!=='string'||!desktopHome.trim()||!isAbsolute(desktopHome)))throw fault('live-http-desktop-home-invalid');
  return {allowed:true,desktopHome:desktopHome??null};
}
