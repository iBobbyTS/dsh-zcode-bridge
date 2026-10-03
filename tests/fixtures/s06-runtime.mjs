import { readFileSync } from 'node:fs';
import { PassThrough } from 'node:stream';
import { resolve } from 'node:path';
import { ProtocolPeer } from '../../packages/host/protocol.mjs';
import { V4Conversation } from '../../packages/host/conversation.mjs';

/** Injected server boundary; the producer is the actual V4Conversation and vendored schemas. */
export function s06Runtime(name = 'busy', { runnable = true, fixtureRoot = resolve('tests/fixtures/s06') } = {}) {
  const fixture = JSON.parse(readFileSync(resolve(fixtureRoot, `${name}.json`), 'utf8'));
  const input = new PassThrough(), output = new PassThrough(), sent = [];
  output.on('data', data => sent.push(JSON.parse(data.toString())));
  const peer = new ProtocolPeer(input, output, { timeoutMs: 100 });
  const conversation = new V4Conversation(peer, {
    address: { runtime: 'zcode', authority: 'fixture-s06', workspace: '/fixture/workspace', sessionId: 'fixture-session' },
    workspace: { workspacePath: '/fixture/workspace', workspaceKey: '/fixture/workspace' },
    clientId: 'fixture-s06', connectionId: 'fixture-s06', runnable, managementAllowed: true,
  });
  let ordinal = 1;
  function response(request, result) { input.write(JSON.stringify({ id: request.id, result }) + '\n'); }
  function ack(request = sent.at(-1), status = 'accepted', reasonCode) {
    response(request, { commandId: request.params.commandId, status, revisionAtDecision: conversation.state.snapshot.revision, ...(reasonCode ? { reasonCode } : {}) });
  }
  async function open() {
    const promise = conversation.connect();
    response(sent.at(-1), fixture.ack);
    input.write(JSON.stringify({ method: 'v4/conversation/frame', params: fixture.initial }) + '\n');
    await promise;
  }
  function update(change) {
    const snapshot = structuredClone(conversation.state.snapshot);
    change(snapshot); snapshot.seq++; snapshot.revision++;
    const frame = structuredClone(fixture.initial);
    frame.deliveryKind = 'online'; frame.logicalFrameOrdinal = ++ordinal; frame.logicalFrameId = `s06-${ordinal}`;
    frame.frame.toSeq = snapshot.seq; frame.frame.payload.snapshot = snapshot;
    input.write(JSON.stringify({ method: 'v4/conversation/frame', params: frame }) + '\n');
  }
  return { fixture, conversation, peer, sent, open, ack, response, update, dispose: () => peer.close() };
}
