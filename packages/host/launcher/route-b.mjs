import { readFileSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isAbsolute,basename } from 'node:path';
import { fault } from './config.mjs';

// Operator-supplied, pinned public evidence only. Never discover authorization from credentials.
export function verifyRouteBArtifacts(artifacts) {
  if (!artifacts || Object.keys(artifacts).sort().join(',') !== 'plan,s01') throw fault('route-b-artifacts-required');
  const read = key => {
    const a = artifacts[key];
    if (!a || !isAbsolute(a.path ?? '') || basename(a.path)!==({s01:'AUTH-PHASE2-S01.md',plan:'PLAN-PHASE2.md'})[key] || !/^[a-f0-9]{64}$/.test(a.sha256 ?? '') || !lstatSync(a.path).isFile() || lstatSync(a.path).isSymbolicLink()) throw fault('route-b-artifact-invalid');
    const bytes = readFileSync(a.path);
    if (createHash('sha256').update(bytes).digest('hex') !== a.sha256) throw fault('route-b-artifact-hash-mismatch');
    return bytes.toString('utf8');
  };
  try {
    const s01 = read('s01'), plan = read('plan');
    if (!s01.includes('## 路线判定') || !s01.includes('真实 HOME') || !s01.includes('credentials.json')) throw fault('route-b-s01-verdict-missing');
    const line = id => plan.split('\n').find(l => l.startsWith('| '+id+' |')) ?? '';
    if (!line('P20').includes('路线 B：真实 HOME 复用') || !line('P24').includes('「好了。」') || !line('P24').includes('备份')) throw fault('route-b-user-confirmation-missing');
    if (!line('P21').includes('复核 **CLEAN**') || !line('P22').includes('Route B 解锁生效') || !line('P25').includes('首启有界 GO') || !line('P25').includes('双覆盖闭合')) throw fault('route-b-clean-prerequisite-missing');
    return {allowed:true, hashes:{s01:artifacts.s01.sha256,plan:artifacts.plan.sha256}, ledger:['P20','P21','P22','P24','P25']};
  } catch (e) { throw fault(e.code?.startsWith('route-b-') ? e.code : 'route-b-artifact-unavailable'); }
}
