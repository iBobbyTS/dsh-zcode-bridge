// CB14 rebind: native Agent session identity remains resident; control-plane reopen owns usage.
import {test} from 'node:test';import assert from 'node:assert/strict';import {RuntimeControls} from '../packages/client/runtime.mjs';
test('CB14 rebind: a late usage reply from a prior reopen cannot overwrite the same session owner',async()=>{
 const reads=[];const controls=new RuntimeControls({call:async(_c,_e,p)=>p.operation==='usage'?new Promise(resolve=>reads.push(resolve)):{ok:true,value:{runtime:'zcode',officialAddress:{sessionId:'official'}}}});
 try{await controls.open('same');const old=controls.usage('same');await controls.open('same');const current=controls.usage('same');reads[1]({ok:true,value:{usage:{totalTokens:0}}});await current;assert.equal(controls.usages.get('same').usage.totalTokens,0);reads[0]({ok:true,value:{usage:{totalTokens:4200}}});await old;assert.equal(controls.usages.get('same').usage.totalTokens,0)}finally{controls.dispose()}
});
