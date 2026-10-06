// Verified against reference 29628c9 and official 3.14.4.7912 (remote workspace).
// These are outer-host carriers, NOT methods to forward to the NDJSON app-server.
const desktop = [
  ['connect', 'zcode:connect-remote'],
  ['cancelConnect', 'zcode:cancel-pending-remote-connection'],
  ['bindWorkspace', 'zcode:bind-remote-workspace-session-context'],
  ['disposeSession', 'zcode:dispose-remote-session'],
  ['sshAliases', 'zcode:list-ssh-config-aliases'],
  ['wslDistros', 'zcode:list-wsl-distros'],
  ['dockerAvailable', 'zcode:is-docker-available'],
  ['dockerContainers', 'zcode:list-docker-containers'],
  ['connectionLog', 'zcode:remote-connection-log'],
  ['sessionClosed', 'zcode:remote-session-closed'],
  ['botReconnected', 'zcode:bot-remote-workspace-reconnected'],
];
export const REMOTE_CARRIERS = Object.freeze([
  ...desktop.map(([name, method], index) => Object.freeze({ name, method, owner: 'desktop-main', transport: 'electron-ipc', direction: index < 8 ? 'request' : 'notification', requestable: false, deprecated: false })),
  ...[['connectHttp', '/api/connect-remote'], ['remoteChannel', '/ws/remote/:id'], ['serverInfo', '/api/server-info'], ['hostCapability', '/api/rpc-host-capability'], ['terminalChannel', '/ws'], ['hostChannel', '/ws/host']].map(([name, method]) => Object.freeze({ name, method, owner: 'independent-server', transport: 'http-ws', direction: 'request', requestable: false, deprecated: false })),
]);
export const REMOTE_REASON = 'remote-connection-carrier-not-exposed';
/** No inventory exists on this carrier. null means unreadable, never an official empty list.
 * Scope is the current LOCAL process, not a fabricated remote authority or connection. */
export function remoteState({ connected = false, authority, workspace, reason = 'not-connected' } = {}) {
  const unavailable = { available: false, state: 'unknown', reason: REMOTE_REASON, items: null };
  return {
    schemaVersion: 1, hostPlatform: process.platform, transport: 'app-server-stdio',
    scope: connected ? { authority, workspace } : null,
    connection: { available: false, state: 'unavailable', reason: REMOTE_REASON, remoteAuthority: null, remoteSessionId: null },
    workspaces: { ...unavailable }, sessions: { ...unavailable },
    targets: ['ssh', 'wsl', 'docker'].map(kind => ({ kind, available: false, state: 'unknown', reason: kind === 'wsl' ? 'wsl-requires-windows-host' : REMOTE_REASON })),
    carriers: REMOTE_CARRIERS,
    admission: { allowed: false, reason: connected ? REMOTE_REASON : reason },
  };
}
