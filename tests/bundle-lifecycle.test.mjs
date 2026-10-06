import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { BridgeHost } from '../packages/host/runtime.mjs';
import { bundleRuntime, bundleInstallation } from './fixtures/installable-bundle-runtime.mjs';

test('unload releases every transport listener and leaves no pending catalog work', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 'bundle-unload-'));
  const runtime = bundleRuntime({ workspacePath });
  const host = new BridgeHost({ workspacePath, inspect: async () => bundleInstallation, spawnProcess: () => runtime.child });
  try {
    await host.connect();
    assert.ok(runtime.child.stdout.listenerCount('data') > 0, 'the peer is attached while connected');
    await host.dispose();
    assert.equal(runtime.child.stdout.listenerCount('data'), 0, 'stdout data listener removed');
    assert.equal(runtime.child.stdout.listenerCount('end'), 0, 'stdout end listener removed');
    assert.equal(runtime.child.stdout.listenerCount('close'), 0, 'stdout close listener removed');
    assert.equal(runtime.child.stdin.listenerCount('drain'), 0, 'stdin drain listener removed');
    assert.equal(host.status.connected, false);
    assert.equal(host.catalogState().operations.length, 0, 'no pending catalog operation survives unload');
  } finally { runtime.child.stdin.end(); await host.dispose(); await rm(workspacePath, { recursive: true, force: true }) }
});

test('reload of the bridge does not create a second session store and recovers the official session', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 'bundle-reload-'));
  const before = await readdir(workspacePath);
  const first = bundleRuntime({ workspacePath, sessions: [{ sessionId: 'bundle-session', title: 'official session' }] });
  const firstHost = new BridgeHost({ workspacePath, inspect: async () => bundleInstallation, spawnProcess: () => first.child });
  try {
    await firstHost.connect();
    const listing = await firstHost.listSessions({});
    assert.deepEqual(listing.sessions.map(session => session.address.sessionId), ['bundle-session']);
    assert.equal(listing.catalog.lifetime, 'process');
    assert.equal(listing.catalog.sharedGui, 'unverified');
    await firstHost.dispose();
    assert.deepEqual(await readdir(workspacePath), before, 'the bridge writes no session store of its own');
    assert.equal(first.requests.some(request => request.method === 'session/close'), false, 'unload never sends session/close');
  } finally { first.child.stdin.end(); await firstHost.dispose() }

  // A fresh bridge (the "updated" plugin) reads the same official session; it owns no copy.
  const second = bundleRuntime({ workspacePath, sessions: [{ sessionId: 'bundle-session', title: 'official session' }] });
  const secondHost = new BridgeHost({ workspacePath, inspect: async () => bundleInstallation, spawnProcess: () => second.child });
  try {
    await secondHost.connect();
    const listing = await secondHost.listSessions({});
    assert.deepEqual(listing.sessions.map(session => session.address.sessionId), ['bundle-session']);
    assert.deepEqual(await readdir(workspacePath), before, 'update/reload writes no session data');
  } finally { second.child.stdin.end(); await secondHost.dispose(); await rm(workspacePath, { recursive: true, force: true }) }
});

test('owned process is reaped on dispose and an unrelated process is untouched', async () => {
  const { spawn } = await import('node:child_process');
  const workspacePath = await mkdtemp(join(tmpdir(), 'bundle-orphan-'));
  const unrelated = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore' });
  const code = `let b='';process.stdin.on('data',c=>{b+=c;let n;while((n=b.indexOf('\\n'))>=0){const m=JSON.parse(b.slice(0,n));b=b.slice(n+1);process.stdout.write(JSON.stringify({id:m.id,result:m.method==='runtime/capabilities'?{independentPlanState:true}:{sessions:[]}})+'\\n')}});process.stdin.on('end',()=>process.exit(0));`;
  const host = new BridgeHost({ workspacePath, inspect: async () => bundleInstallation, spawnProcess: () => spawn(process.execPath, ['-e', code], { stdio: ['pipe', 'pipe', 'pipe'] }) });
  try {
    const status = await host.connect();
    assert.equal(status.connected, true);
    const pid = status.pid;
    await host.dispose();
    let alive = true;
    try { process.kill(pid, 0) } catch { alive = false }
    assert.equal(alive, false, 'the owned runtime process is gone after dispose');
    process.kill(unrelated.pid, 0);
    assert.equal(host.status.connected, false);
  } finally { unrelated.kill(); await host.dispose(); await rm(workspacePath, { recursive: true, force: true }) }
});
