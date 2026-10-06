import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
const defaultResult={};
/**
 * Controlled official stdio store for catalog management. Catalog payloads are injected fixtures, never a live runtime.
 * `responses[method]` may be a value, an Error (→ protocol error), or a function
 * `(request, api) => value|undefined`. Returning undefined holds the request for `release`/`respondError`.
 */
export function catalogStore({responses={}}={}){
  const requests=[],pending=new Map(),children=[];let next=0;
  const write=proc=>message=>proc.stdout.write(JSON.stringify(message)+'\n');
  function child(){
    const proc=new EventEmitter();proc.stdin=new PassThrough();proc.stdout=new PassThrough();proc.stderr=new PassThrough();proc.pid=9000+next++;
    children.push(proc);
    proc.stdin.on('data',data=>{for(const line of data.toString().trim().split('\n')){
      if(!line)continue;
      const request=JSON.parse(line);requests.push(request);
      let result=Object.hasOwn(responses,request.method)?responses[request.method]:defaultResult;
      if(typeof result==='function')result=result(request,{write:write(proc),release:id=>release(id)});
      if(request.method==='runtime/capabilities')result={independentPlanState:true};
      else if(request.method==='session/list')result={sessions:[]};
      if(result instanceof Error)write(proc)({id:request.id,error:{code:-32603,message:result.message}});
      else if(result&&typeof result==='object'&&result.protocolError)write(proc)({id:request.id,error:{code:result.protocolError.code??-32603,message:result.protocolError.message??'protocol error'}});
      else if(result===undefined)pending.set(request.id,{proc});
      else write(proc)({id:request.id,result});
    }});
    proc.stdin.once('finish',()=>{proc.stdout.end();proc.stderr.end();proc.emit('close',0)});
    proc.kill=()=>{throw Error('fixture must finish by EOF')};
    return proc;
  }
  function release(requestOrId,result){const id=typeof requestOrId==='object'?requestOrId.id:requestOrId;const entry=pending.get(id);if(!entry)throw Error(`no pending request ${id}`);pending.delete(id);write(entry.proc)({id,result})}
  function respondError(requestOrId,code,message){const id=typeof requestOrId==='object'?requestOrId.id:requestOrId;const entry=pending.get(id);if(!entry)throw Error(`no pending request ${id}`);pending.delete(id);write(entry.proc)({id,error:{code,message}})}
  function notify(method,params){if(!children.length)throw Error('no child');write(children.at(-1))({method,params})}
  return {requests,pending,child,release,respondError,notify};
}
