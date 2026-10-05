import { isAbsolute } from 'node:path';
import { fault } from './config.mjs';

// Q6: ordinary configuration validation, with no operator-document authorization gate.
// Credential values are never read; a custom cipher override is rejected by presence only.
export function validateRouteBOptions({sharedDatabaseRoot,desktopHome,customCipher=Object.hasOwn(process.env,'ZCODE_CREDENTIAL_SECRET')}={}) {
  if(sharedDatabaseRoot!==undefined)throw fault('route-b-shared-probe-denied');
  if(customCipher)throw fault('route-b-custom-cipher-env-unsupported');
  if(desktopHome!==undefined&&desktopHome!==null&&(typeof desktopHome!=='string'||!desktopHome.trim()||!isAbsolute(desktopHome)))throw fault('route-b-desktop-home-invalid');
  return {allowed:true,desktopHome:desktopHome??null};
}
