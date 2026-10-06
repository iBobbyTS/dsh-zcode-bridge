import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const repo=fileURLToPath(new URL('..',import.meta.url));
const coverage=readFileSync(resolve(repo,'PROTOCOL-COVERAGE.md'),'utf8');
const expected={'legacy-methods':74,'legacy-notifications':7,'v4-methods':31,'v4-notifications':4,'v4-commands':34};
const rows=[];let section;
for(const line of coverage.split('\n')){
  if(line.startsWith('## '))section=line.slice(3);
  if(Object.hasOwn(expected,section)&&line.startsWith('| `')){
    const cells=line.split('|').slice(1,-1).map(value=>value.trim());
    if(cells.length!==10)throw Error('Invalid coverage columns: '+line);
    const [entry,sourceLine,oldOwner,boundary,exposed,gui,mandatory,owner,status,evidence]=cells;
    rows.push({section,entry,name:entry.slice(1,-1),sourceLine,oldOwner,boundary,exposed,gui,mandatory,owner,status,evidence});
  }
}
for(const [section,count] of Object.entries(expected))if(rows.filter(row=>row.section===section).length!==count)throw Error('Declaration count changed: '+section);
if(new Set(rows.map(row=>row.section+':'+row.name)).size!==150)throw Error('Duplicate declarations');
const mandatory=rows.filter(row=>row.mandatory==='Y'),gaps=mandatory.filter(row=>!row.status.startsWith('已实现'));
function deferredReason(name){
  if(['session/resume','session/read','session/messages','v4/conversation/rowsRange'].includes(name))return ['history-hydration','Full pagination/config hydration needs native transcript merge, ordering and recovery oracles; merely enabling the query would leave the mandatory behavior incomplete.'];
  if(['session/subagents','session/cancelBackgroundTask','v4/conversation/backgroundBashOutput','cancelBackgroundWork'].includes(name))return ['background-work','Needs a session-bound Bash/subagent directory, work identity, output paging and cancel lifecycle UI; current cancellation covers workflow runs only.'];
  if(name==='session/debug')return ['session-diagnostics','No active debug consumer/carrier exists; requires installed-version handler/result verification and a typed diagnostic view, rather than unbounded raw RPC.'];
  if(name==='automation/create'||name==='automation/update')return ['automation-fields','Host facade rejects targetTaskId/botDeliveryTarget/interval/intervalUnit. Requires authoritative DTO/entitlement and binding/delivery semantics plus GUI fields; existing cron subset remains available.'];
  if(['interaction/requestUserInput','resolveInteraction','snoozeInteractionAutoResolution'].includes(name))return ['interaction-mapping','Needs native multi-question/free-text/timeout UI and interaction cancellation/winner semantics; permission-only mapping cannot be relabeled complete.'];
  if(name.startsWith('workspace/hooks/')||name.includes('WorkspaceHook'))return ['hook-trust','Trust/review requires official item identity, grant result translation, stale-item and revocation semantics, and a current review UI; adding an allowlist entry alone would bypass missing admission work.'];
  if(['session/fork','session/compact','createSelectionSideSession','compact','forkAssistant','applyFileRewind','editUserQuery','retryTurn','discardSharedContext'].includes(name))return ['history-mutations','Requires official history replacement/fork identity adoption, native guard integration, attachment/shared-context authority and durable lost-ACK recovery traces. Helpers/relay permission alone do not close the native consumer contract.'];
  throw Error('Missing deferral reason for '+name);
}
function location(row){
  const n=row.name;
  if(row.owner.startsWith('延期'))return 'No DSH entry · '+row.owner;
  if(row.gui.startsWith('N'))return 'Internal carrier/event of its owning feature; no independent GUI button';
  if(['session/setMode','switchCollaborationMode'].includes(n))return 'ZCode session → composer dock → ZCode collaboration mode';
  if(n==='v4/conversation/plans')return 'ZCode session → composer dock → Read official plans';
  if(n==='v4/conversation/fileChanges')return 'ZCode session → composer dock → Read file changes · turn row';
  if(n==='v4/conversation/fileRewindPreview')return 'ZCode session → composer dock → Preview file rewind · eligible turn row';
  if(row.status.startsWith('未实现'))return 'No current DSH entry; successor handoff';
  if(gaps.includes(row)){
    const group=deferredReason(n)[0];
    if(group==='history-hydration')return 'Sidebar → open mirrored session (current window only); full history/config hydration absent';
    if(group==='automation-fields')return 'Plugins → @dsh-zcode/bridge → Automations (cron subset); missing binding/bot/interval fields';
    if(group==='background-work'&&['cancelBackgroundWork','session/cancelBackgroundTask'].includes(n))return 'ZCode session → composer dock → workflow run Cancel (subset); Bash/subagent directory absent';
    if(n==='resolveInteraction')return 'Native approval UI (permissions only); multi-question/free-text absent';
    return 'No current DSH entry for remaining gap; retained helpers are not GUI consumers';
  }
  if(n.includes('workflow')||/Workflow/.test(n))return 'Plugins → @dsh-zcode/bridge → Workflows; session composer dock → workflow runs/resources';
  if(/automation|offPeak/.test(n))return 'Plugins → @dsh-zcode/bridge → Automations';
  if(/plugins|skills|mcp/.test(n))return 'Plugins → @dsh-zcode/bridge → task catalog';
  if(/attachment/i.test(n)||n==='sendGoalCommand'||n==='session/goal')return 'ZCode session → composer dock → attachments/input/goal';
  if(/usage|childProcesses|Connectivity/.test(n))return 'Plugins → @dsh-zcode/bridge → Diagnostics; session dock → session usage';
  if(n==='workspace/readPresentation')return 'Plugins → @dsh-zcode/bridge → Workspace presentations';
  if(/Preferences/.test(n))return 'Plugins → @dsh-zcode/bridge → Official interaction preferences';
  if(/Feedback/.test(n))return 'ZCode session → composer dock → Message feedback';
  if(/Model|setConfig/.test(n))return 'ZCode session → official native model/effort picker';
  if(/Queue|AutoDrain|Followup|Goal|goal|session\/cancel/.test(n))return 'ZCode session → composer lifecycle/queue dock';
  if(/list|subscribeTask|rename|readTitle/.test(n))return 'Native workspace sidebar → mirrored title/open/rename';
  if(/Interaction|interaction/.test(n))return 'Native conversation approval UI → permission question';
  if(n==='stop')return 'Native Stop and ZCode session → lifecycle dock → Stop';
  if(/create|prompt|sendText/.test(n))return 'Hero → ZCode runtime; native conversation composer → input';
  if(row.section.endsWith('notifications'))return 'Native conversation transcript/status and bridge projection consumers';
  return 'ZCode session → native conversation transcript/projection';
}
const lines=['# Closure per-entry acceptance report skeleton','',
  'Generated from `PROTOCOL-COVERAGE.md` by `node scripts/generate-closure-report.mjs`. All 150 declaration rows are retained by table and name. Status is implementation evidence, not live acceptance. Mandatory flags/approved owners remain unchanged. All browser evidence/result columns are intentionally empty for the parent. Writes remain human-owned; this file is not a manual execution checklist. Internal entries are subordinate carriers, not invented GUI buttons.','',
  '| Table | App-server entry | Implementation status | Mandatory / owner | DSH-side entry location | Code / gap evidence | Browser read-only evidence | Browser result |',
  '|---|---|---|---|---|---|---|---|'];
for(const row of rows){
  const legacyIdx = '(#protocol-coverage-index)', closureIdx = '(#closure-evidence)';
  const evidence=row.evidence.replaceAll(legacyIdx,'(../PROTOCOL-COVERAGE.md#protocol-coverage-index)').replaceAll(closureIdx,'(../PROTOCOL-COVERAGE.md#closure-evidence)');
  lines.push(`| ${row.section} | ${row.entry} | ${row.status}${gaps.includes(row)?' · deferred to successor':''} | ${row.mandatory} / ${row.owner} | ${location(row)} | ${evidence} |  |  |`);
}
writeFileSync(resolve(repo,'docs/closure-entry-report.md'),lines.join('\n')+'\n');
const handoff=['# Closure mandatory-gap successor handoff','',
  'Worker-support reconciliation from accepted protocol `c151d76`: 31 partial + 2 unimplemented = 33 declaration rows. Closure closes 5 rows (mode legacy/v4, plans, file changes, rewind preview); 28 rows transfer to successor work: 26 partial + 2 unimplemented. No full-parity completion is claimed. Original mandatory/approved-owner fields stay in PROTOCOL-COVERAGE; this explicit handoff does not grant plan acceptance or waive a blocking requirement. Parent owns final requirement-level closure and admission.','',
  'Successor groups below are proposed work packets, not invented accepted plans. They inherit the unchanged no-delete/no-removal-entry rule, official storage authority, sandbox/HOME/process isolation, and no automatic replay. No real writes were executed.','',
  '| App-server entry | Approved owner | Retained implementation status | Successor group | Remaining work / reason | Evidence |',
  '|---|---|---|---|---|---|'];
for(const row of gaps){const [group,reason]=deferredReason(row.name);handoff.push(`| ${row.entry} | ${row.owner} | ${row.status} | ${group} | ${reason} | [Coverage row](../PROTOCOL-COVERAGE.md) · ${row.evidence.replace(/\[E\d+\]\([^)]*\)；?/,'')} |`)}
handoff.push('', 'Acceptance boundary: npm release seams and cross-process queue/approval winner detection remain separate constraints, not NITs. Existing deletion/deferral decisions remain approved as recorded; these 28 mandatory residuals remain partial/unimplemented and must not be counted as implemented or not applicable.');
writeFileSync(resolve(repo,'docs/closure-gap-handoff.md'),handoff.join('\n')+'\n');
console.log(JSON.stringify({declarations:rows.length,mandatory:mandatory.length,implemented:mandatory.length-gaps.length,deferred:gaps.length,partial:gaps.filter(row=>row.status.startsWith('部分')).length,unimplemented:gaps.filter(row=>row.status.startsWith('未实现')).length}));
