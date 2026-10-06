import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {BridgeHost} from '../packages/host/runtime.mjs';
import {bundleRuntime,bundleInstallation} from './fixtures/installable-bundle-runtime.mjs';
import {CompatibilityStore} from '../packages/client/compatibility.mjs';
const require=createRequire(import.meta.url);
const code=require('esbuild').buildSync({entryPoints:[resolve('packages/client/client.jsx')],bundle:true,write:false,platform:'node',format:'cjs',external:['react']}).outputFiles[0].text;
const module={exports:{}};
vm.runInThisContext('(function(require,module,exports){'+code+'\n})')(require,module,module.exports);
export const {StatusCard,BridgeParityPage,ZCodeVersionBanner,BridgeSettingsPanel}=module.exports;
const controller=status=>({subscribe:()=>()=>{},getSnapshot:()=>({status})});
export function renderStatus(status){return renderToStaticMarkup(React.createElement(StatusCard,{controller:controller(status)}))}
function renderPage(status){return renderToStaticMarkup(React.createElement(BridgeParityPage,{controller:controller(status),rpc:{call:()=>{throw Error('SSR must issue no requests')}},StatusComponent:StatusCard}))}
const changedDigest='0'.repeat(64);
async function withHost(overrides,options,check){
  const fixture=bundleRuntime({workspacePath:tmpdir(),...options});
  const host=new BridgeHost({workspacePath:tmpdir(),inspect:async()=>({...bundleInstallation,...overrides}),spawnProcess:()=>fixture.child});
  try{await host.connect();await check(host,fixture)}finally{await host.dispose()}
}

test('Protocol upgrade measured baseline status renders its version without upgrade or identity warnings',async()=>{
  await withHost({}, {},async(host,fixture)=>{
    assert.equal(host.status.compatibility.state,'verified');
    assert.equal(host.status.compatibility.highestVerified,'3.14.4');
    const html=renderPage(host.status);
    assert.match(html,/3\.14\.4/);
    assert.doesNotMatch(html,/zcode-version-banner|zcode-version-identity|zcode-failsafe-core|<details open/);
    assert.ok(fixture.requests.every(r=>['runtime/capabilities','session/list'].includes(r.method)));
  });
});

test('Protocol upgrade same-version digest upgrade opens the existing details and renders unverified identity',async()=>{
  await withHost({sha256:changedDigest,verified:false},{},async(host,fixture)=>{
    const status=host.status;
    assert.equal(status.compatibility.state,'identity-mismatch');
    assert.equal(status.compatibility.verified,false);
    assert.equal(status.compatibility.digestMatches,false);
    assert.equal(status.failSafe.incompatible,false,'identity drift alone is not a protocol failure');
    const html=renderPage(status);
    assert.match(html,/<details open=""/);
    assert.match(html,/data-testid="zcode-version-identity"/);
    assert.match(html,/unverified build or digest/);
    assert.doesNotMatch(html,/data-testid="zcode-version-banner"|zcode-failsafe-core/);
    assert.ok(fixture.requests.every(r=>['runtime/capabilities','session/list'].includes(r.method)));
  });
});

test('Protocol upgrade newer version and digest warn against highestVerified without promoting the tuple',async()=>{
  await withHost({version:'3.15.0',build:'3.15.0.1',sha256:changedDigest,verified:false},{},async host=>{
    const status=host.status;
    assert.equal(status.compatibility.state,'newer-unverified');
    assert.equal(status.compatibility.highestVerified,'3.14.4');
    assert.equal(status.compatibility.incompatible,false);
    assert.match(renderPage(status),/data-testid="zcode-version-banner"/);
    const store=new CompatibilityStore({storage:null});
    try{store.dismiss('this-version','3.15.0');assert.doesNotMatch(renderToStaticMarkup(React.createElement(ZCodeVersionBanner,{compatibility:status.compatibility,store})),/zcode-version-banner/)}finally{store.dispose()}
    assert.equal(host.status.compatibility.verified,false,'local dismissal cannot verify an installation');
  });
});

test('Protocol upgrade upgraded digest plus core shape drift renders incompatible and blocks writes before dispatch',async()=>{
  await withHost({sha256:changedDigest,verified:false},{badSessionListOnCall:2},async(host,fixture)=>{
    await assert.rejects(host.listSessions(),{code:'sessions-invalid'});
    assert.equal(host.status.compatibility.state,'identity-mismatch');
    assert.equal(host.status.failSafe.incompatible,true);
    assert.equal(host.status.failSafe.blocksNewSideEffects,true);
    const html=renderPage(host.status);
    assert.match(html,/zcode-version-identity/);
    assert.match(html,/zcode-failsafe-core/);
    assert.match(html,/new side effects are stopped/);
    const count=fixture.requests.length;
    await assert.rejects(host.conversationOperation({operation:'command',handle:'unused',command:{type:'sendText',payload:{text:'must not dispatch'}}}),{code:'runtime-incompatible'});
    assert.equal(fixture.requests.length,count);
  });
});
