import {readFile,writeFile} from 'node:fs/promises';
const official=JSON.parse(await readFile('tests/fixtures/s04/official.json'));
const initial=JSON.parse(await readFile('tests/fixtures/s03a/success.json')).initial;
const list=official.exchanges.find(e=>e.method==='session/list').result;
const provenance={kind:'official-capture-with-explicit-injections',sources:['s04/official.json','s03a/success.json'],paidModelCalls:0};
const pages={provenance:{...provenance,changes:['duplicate first captured catalog row into 65 distinct session IDs/titles for stored-prefix limit=50 boundary','search is local title filtering, no official search carrier']},sessions:Array.from({length:65},(_,i)=>({...structuredClone(list.sessions[0]),sessionId:'s'+i,title:'Title '+i}))};
const late={provenance:{...provenance,changes:['change source snapshot session/title/revision/seq and subscription identity','hold online snapshot until after an accepted deletion; no actual official online deletion race is claimed']},frame:structuredClone(initial)};
late.frame.deliveryKind='online';late.frame.logicalFrameOrdinal=2;late.frame.logicalFrameId='s04-late';late.frame.frame.toSeq=late.frame.frame.payload.snapshot.seq=9;late.frame.frame.payload.snapshot.revision=9;late.frame.frame.payload.snapshot.meta={title:'late title',titleSource:'custom'};
for(const [name,value] of Object.entries({pages,conflict:{provenance:{kind:'official-runtime-capture',source:'s04/official.json',changes:[]},stale:official.oracle.stale,rename:official.oracle.rename},lateframe:late}))await writeFile('tests/fixtures/s04/'+name+'.json',JSON.stringify(value,null,2)+'\n');
