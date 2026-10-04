// Produce Host-subtree identity from the pinned official ASAR header, not from arbitrary copies.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const archive=readFileSync('/Applications/ZCode.app/Contents/Resources/app.asar');
const archiveSha256=createHash('sha256').update(archive).digest('hex');
if(archiveSha256!=='232e913ea13d60bd0ecc86bf9f2f145328809608fe4d48e76685d61a8076aef0')throw Error('Official ASAR identity changed');
const header=JSON.parse(archive.subarray(16,16+archive.readUInt32LE(12)).toString());
const files=Object.entries(header.files.out.files.host.files).map(([name,node])=>({path:'out/host/'+name,sha256:node.integrity?.hash}));
if(files.some(f=>!f.sha256))throw Error('ASAR Host integrity missing');
writeFileSync('packages/host/launcher/official-host-identity.json',JSON.stringify({archiveSha256,files},null,2)+'\n');
console.log(JSON.stringify({archiveSha256,hostFiles:files.length}));
