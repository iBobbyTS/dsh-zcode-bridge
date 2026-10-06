import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const dir=resolve(process.argv[2]??'tests/fixtures/transport-v4');
const official=JSON.parse(await readFile(join(dir,'official.json'),'utf8'));
const clone=structuredClone;
const initial=official.notifications.find(x=>x.params.deliveryKind==='initial'&&x.params.subscriptionId==='fixture-subscription').params;
const online=official.notifications.find(x=>x.params.deliveryKind==='online').params;
const recovery=official.notifications.find(x=>x.params.deliveryKind==='recovery').params;
const ack=official.exchanges.find(x=>x.method==='v4/conversation/subscribe').result;
const accepted=official.exchanges.find(x=>x.params.type==='setFollowupMode'&&x.result?.status==='accepted');
if(!initial||!online||!recovery||!accepted)throw Error('Incomplete official capture; do not synthesize a missing live oracle');
const snapshotAt=(wire,seq)=>{const w=clone(wire);w.frame.toSeq=seq;w.frame.payload.snapshot.seq=seq;return w};
const deltaAt=(from,to,ordinal)=>{const w=clone(online);w.frame.fromSeq=from;w.frame.toSeq=to;w.logicalFrameOrdinal=ordinal;w.logicalFrameId='injected-lf-'+ordinal;return w};
const initial10=snapshotAt(initial,10),advance=deltaAt(10,12,2),gap=deltaAt(13,14,3);
const repaired=snapshotAt(recovery,14);repaired.logicalFrameOrdinal=4;repaired.logicalFrameId='injected-lf-4';
const late=deltaAt(14,1000,5);late.subscriptionId=late.frame.subscriptionId='old-subscription';
const prefix={source:'official.json',runtimeSha256:official.provenance.sha256,paidModelCalls:0};
const fixtures={
 success:{provenance:{...prefix,kind:'captured',changes:[]},ack,initial,online,recovery,accepted},
 failure:{provenance:{...prefix,kind:'captured',changes:[]},commands:official.exchanges.filter(x=>['rejected','failed','stale'].includes(x.result?.status))},
 gap:{provenance:{...prefix,kind:'fault-injection',changes:['snapshot watermark -> 10','real empty delta interval -> (10,12] then (13,14]','logical frame ids/ordinals -> monotonic fixture ids','recovery watermark -> 14']},ack,initial:initial10,advance,gap,recovery:repaired,expectedGap:{fromSeq:12,toSeq:13}},
 lateframe:{provenance:{...prefix,kind:'fault-injection',changes:['real online delta subscription replaced by old-subscription','interval -> (14,1000]','ordinal/id -> 5/injected-lf-5']},frame:late},
};
for(const [name,data] of Object.entries(fixtures))await writeFile(join(dir,name+'.json'),JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({fixtures:Object.keys(fixtures),source:prefix.source}));
