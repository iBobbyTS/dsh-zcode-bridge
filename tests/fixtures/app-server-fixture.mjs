import {createInterface} from 'node:readline';

// Real NDJSON JSON-RPC process. Controls are injected by the spawning test only.
const requests=[];
const send=frame=>process.stdout.write(JSON.stringify(frame)+'\n');
const respond=(request,result)=>send({jsonrpc:'2.0',id:request.id,result});
let stdoutEnded=false;
if(process.env.FIXTURE_IGNORE_EOF==='1'||process.env.FIXTURE_EOF_HANG==='1')setInterval(()=>{},1000);
const lines=createInterface({input:process.stdin});
lines.on('line',line=>{
  if(stdoutEnded)return;
  const request=JSON.parse(line);requests.push(request);
  if(request.method==='runtime/capabilities'){
    send({method:'fixture/handshake',params:{pid:process.pid}});
    if(process.env.FIXTURE_SUICIDE_HANDSHAKE==='1'){setTimeout(()=>process.exit(17),10);return}
    setTimeout(()=>respond(request,{independentPlanState:process.env.FIXTURE_BAD_CAPABILITIES==='1'?'invalid':true}),Number(process.env.FIXTURE_HANDSHAKE_DELAY_MS??0));
  }else if(request.method==='session/list'){
    respond(request,{sessions:process.env.FIXTURE_BAD_SESSIONS==='1'?null:[]});
  }else if(request.method==='fixture/block'){
    send({method:'fixture/blocked',params:{pid:process.pid}});
  }else if(request.method==='fixture/suicide'&&process.env.FIXTURE_SUICIDE==='1'){
    setTimeout(()=>process.exit(17),Number(process.env.FIXTURE_SUICIDE_DELAY_MS??10));
  }else if(request.method==='fixture/eof'&&process.env.FIXTURE_EOF_HANG==='1'){
    stdoutEnded=true;process.stdout.end();
  }else if(request.method==='fixture/notify'){
    // A single stdout batch proves that onResult runs before notification delivery.
    process.stdout.write(JSON.stringify({id:request.id,result:{pid:process.pid}})+'\n'+JSON.stringify({method:'fixture/event',params:{pid:process.pid,value:request.params}})+'\n');
  }else if(request.method==='fixture/delay'){
    send({method:'fixture/blocked',params:{pid:process.pid}});
    setTimeout(()=>respond(request,{pid:process.pid}),request.params.delayMs);
  }else if(request.method==='fixture/requests'){
    respond(request,requests);
  }else if(request.method==='fixture/reject'){
    send({id:request.id,error:{code:-32602,message:'fixture rejection'}});
  }else{
    respond(request,{pid:process.pid,cwd:process.cwd(),params:request.params});
  }
});
if(process.env.FIXTURE_STDERR)process.stderr.write(process.env.FIXTURE_STDERR);
lines.on('close',()=>{if(process.env.FIXTURE_IGNORE_EOF!=='1'&&process.env.FIXTURE_EOF_HANG!=='1')process.exit(0)});
