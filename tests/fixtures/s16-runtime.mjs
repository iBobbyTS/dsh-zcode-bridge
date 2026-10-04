import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { realpathSync } from 'node:fs';

/** Deterministic fake official app-server for the S16 lifecycle/fail-safe checks.
 *  It speaks only the NDJSON carrier the real Host uses; it is not an official runtime oracle.
 *  `badSessionListOnCall` makes the Nth session/list response a non-array (post-connect drift). */
export function s16Runtime({ workspacePath, sessions = [], catalogResult = { mcp: { bogus: true } }, badSessionListOnCall = null } = {}) {
  const workspace = realpathSync(workspacePath);
  const child = new EventEmitter();
  child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
  const requests = [];
  let sessionListCalls = 0;
  child.stdin.on('data', buffer => {
    const request = JSON.parse(buffer.toString());
    requests.push(request);
    let result;
    if (request.method === 'runtime/capabilities') result = { independentPlanState: true };
    else if (request.method === 'session/list') {
      sessionListCalls += 1;
      if (badSessionListOnCall !== null && sessionListCalls === badSessionListOnCall) result = { sessions: 'not-an-array' };
      else result = { sessions: sessions.map(session => ({ sessionId: session.sessionId, title: session.title ?? session.sessionId, workspace: { workspacePath: workspace, workspaceKey: workspace }, status: session.status ?? 'idle' })) };
    }
    else if (request.method === 'mcp/list') result = catalogResult.mcp;
    else result = {};
    child.stdout.write(JSON.stringify({ id: request.id, result }) + '\n');
  });
  child.stdin.once('finish', () => { child.stdout.end(); child.stderr.end(); child.emit('close', 0) });
  child.kill = () => { throw new Error('S16 fixture must exit through the stdin EOF barrier') };
  return { child, requests, workspace };
}

export const s16Installation = {
  appPath: '/fixture/ZCode.app', version: '3.14.4', build: '3.14.4.7912',
  sha256: 'fad4c35c4c36ec210d8a06d3fa0e77de23c8545e2eb6ff90aea1eb38d1e6275f',
  launcher: process.execPath, cjs: 'fixture', providerConfig: 'fixture', verified: true,
  runtime: { execPath: process.execPath, node: process.versions.node, electron: 'fixture', arch: process.arch },
};
