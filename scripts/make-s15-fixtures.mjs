import { readFile, writeFile } from 'node:fs/promises';
const official = JSON.parse(await readFile('tests/fixtures/s15/official.json', 'utf8'));
if (official.status !== 'PASS') throw Error('official-capture-required');
const save = (name, value) => writeFile(`tests/fixtures/s15/${name}.json`, JSON.stringify(value, null, 2)+'\n');
await save('empty', { provenance: { kind: 'official-capture-projection', source: 'official.json', injectedFields: [] }, localSessions: official.probes.localSessionList.result, remote: official.productionOracle });
await save('restricted', { provenance: { kind: 'injected-semantic-fixture', source: 'official.json', injectedFields: ['admission.reason', 'scope'] }, remote: { ...official.productionOracle, scope: null, admission: { allowed: false, reason: 'host-unreachable' } } });
await save('unknown', { provenance: { kind: 'injected-semantic-fixture', source: 'official.json', injectedFields: ['targets[0].kind'] }, remote: { ...official.productionOracle, targets: official.productionOracle.targets.map((target, index) => index === 0 ? { ...target, kind: 'future_transport' } : target) } });
console.log('S15 fixtures: real local empty list; remote unreadable; injected disconnect and unknown kind. No remote rows created.');
