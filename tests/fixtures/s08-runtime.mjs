import { readFileSync } from 'node:fs';
import { PassThrough } from 'node:stream';
import { resolve } from 'node:path';
import { ProtocolPeer } from '../../packages/host/protocol.mjs';
import { V4Conversation } from '../../packages/host/conversation.mjs';
/** Explicitly injected server. Only this test port owns optional fixture file mutation, never bridge/DSH code. */
export function s08Runtime(name = 'success', { runnable = true, fixtureRoot = resolve('tests/fixtures/s08'), authority = 'fixture-s08', sessionId = 'fixture-session', timeoutMs = 100 } = {}) {
  const fixture = JSON.parse(readFileSync(resolve(fixtureRoot, `${name}.json`), 'utf8'));
  fixture.initial.topic = fixture.initial.frame.topic = `conversation/${sessionId}`;
  fixture.initial.frame.payload.snapshot.sessionId = sessionId;
  const input = new PassThrough(), output = new PassThrough(), sent = [];
  output.on('data', data => sent.push(JSON.parse(data.toString())));
  const peer = new ProtocolPeer(input, output, { timeoutMs });
  const conversation = new V4Conversation(peer, { address: { runtime: 'zcode', authority, workspace: '/fixture/workspace', sessionId }, workspace: { workspacePath: '/fixture/workspace', workspaceKey: '/fixture/workspace' }, clientId: 'fixture-s08', connectionId: 'fixture-s08', runnable, managementAllowed: true });
  let ordinal = 1;
  const response = (request, result) => input.write(JSON.stringify({ id: request.id, result }) + '\n');
  function ack(request = sent.at(-1), result, status = 'accepted', reasonCode) { response(request, { commandId: request.params.commandId, status, revisionAtDecision: conversation.state.snapshot.revision, ...(result ? { result } : {}), ...(reasonCode ? { reasonCode } : {}) }); }
  async function open() { const promise = conversation.connect(); response(sent.at(-1), fixture.ack); input.write(JSON.stringify({ method: 'v4/conversation/frame', params: fixture.initial }) + '\n'); await promise; }
  function update(change, { recovery = false } = {}) {
    const snapshot = structuredClone(conversation.state.snapshot); change(snapshot); snapshot.seq++; snapshot.revision++;
    const frame = structuredClone(fixture.initial); frame.deliveryKind = recovery ? 'recovery' : 'online'; frame.logicalFrameOrdinal = ++ordinal; frame.logicalFrameId = `s08-${ordinal}`; frame.frame.toSeq = snapshot.seq; frame.frame.payload.snapshot = snapshot;
    input.write(JSON.stringify({ method: 'v4/conversation/frame', params: frame }) + '\n');
  }
  async function replaceEpoch(epoch, change=()=>{}) { const p=conversation.resync({forceSnapshot:true}); response(sent.at(-1), {ack:{...fixture.ack.ack,logEpoch:epoch}}); update(s=>{s.logEpoch=epoch;change(s);},{recovery:true}); await p; }
  return { replaceEpoch, fixture, conversation, peer, sent, response, ack, open, update, dispose: () => peer.close() };
}
