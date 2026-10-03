// Derives S07 snapshot fixtures from the already-real S06 empty/busy capture. The upload wire
// itself is captured for real by scripts/capture-s07.mjs; the user row attachments and the
// shared-context import state cannot exist without a model turn, so they are injected through the
// official snapshot schema and each fixture records exactly what was injected.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const base = JSON.parse(readFileSync('tests/fixtures/s06/busy.json', 'utf8'));
const directory = 'tests/fixtures/s07';
mkdirSync(directory, { recursive: true });

const attachments = [
  { ref: 'zcode-artifact://fixture-session/tool-result-image-1', fileName: 'diagram.png', mime: 'image/png', bytes: 2048, previewRef: 'zcode-artifact://fixture-session/tool-result-image-1' },
  { ref: 'zcode-artifact://fixture-session/tool-result-doc-1', fileName: 'notes.txt', mime: 'text/plain', bytes: 12 },
];

function withRow(snapshot) {
  snapshot.rows.window.push({
    rowId: 3,
    turnId: 'turn-input-1',
    entityId: 'entity-input-1',
    createdAt: 1700000000500,
    createdAtSeq: 4,
    kind: 'userInput',
    text: 'Injected attachment input',
    origin: 'realUser',
    sourceCommandId: 'command-input-1',
    attachments: JSON.parse(JSON.stringify(attachments)),
  });
  snapshot.rows.totalCount = snapshot.rows.window.length;
  return snapshot;
}

function fixture(overrides) {
  const document = JSON.parse(JSON.stringify(base));
  document.provenance = {
    kind: 'derived-from-official-s06-snapshot',
    base: 'tests/fixtures/s06/busy.json (real official empty/projection capture)',
    injected: ['snapshot.rows.window userInput row + attachments', 'snapshot.sharedContextImport', 'readResult/statResult sample payloads'],
    note: 'Upload wire responses are real-captured in official-attachment.json; a sent-attachment row requires a model turn and is therefore injected, never claimed as live.',
  };
  const snapshot = document.initial.frame.payload.snapshot;
  withRow(snapshot);
  Object.assign(snapshot, overrides.snapshot ?? {});
  Object.assign(document, overrides.extra ?? {});
  return document;
}

writeFileSync(`${directory}/success.json`, JSON.stringify(fixture({
  snapshot: {
    sharedContextImport: { contextId: 'ctx-fixture-1', title: 'Shared plan', shareUrl: 'https://zcode.example/cn/share/ABC123', status: 'pending' },
  },
  extra: {
    readResult: { dataBase64: Buffer.from('S07 preview bytes').toString('base64'), mediaType: 'image/png', totalBytes: 2048, nextOffset: null },
    statResult: { mediaType: 'text/plain', totalBytes: 12, mtimeMs: 1700000000000 },
  },
}), null, 2) + '\n');

writeFileSync(`${directory}/attached.json`, JSON.stringify(fixture({
  snapshot: {
    sharedContextImport: { contextId: 'ctx-fixture-2', title: 'Already attached plan', shareUrl: 'https://zcode.example/cn/share/DEF456', status: 'attached' },
  },
}), null, 2) + '\n');

writeFileSync(`${directory}/discarded.json`, JSON.stringify(fixture({
  snapshot: {
    sharedContextImport: { contextId: 'ctx-fixture-3', title: 'Withdrawn plan', shareUrl: 'https://zcode.example/cn/share/GHI789', status: 'discarded' },
  },
}), null, 2) + '\n');

const legacy = fixture({});
const legacySnapshot = legacy.initial.frame.payload.snapshot;
legacySnapshot.sharedContextImport = { title: 'Legacy import without identity' };
legacySnapshot.rows.window.at(-1).attachments.push({ ref: 'zcode-artifact://fixture-session/tool-result-unknown-1', fileName: 'weird.zzz', mime: 'application/x-unknown-thing', bytes: 4 });
legacy.provenance.injected.push('legacy shared-context shape (title only) + unknown-MIME attachment');
writeFileSync(`${directory}/legacy.json`, JSON.stringify(legacy, null, 2) + '\n');

console.log(JSON.stringify({ written: ['success.json', 'attached.json', 'discarded.json', 'legacy.json'] }));
