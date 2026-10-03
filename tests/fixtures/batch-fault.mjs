import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

/** Deterministic parser/cleanup fixture; no official runtime or authentication. */
export function batchFaultChild(failOn='session/list') {
  const child=new EventEmitter();
  child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();
  const requests=[];
  const eof=Promise.withResolvers();
  child.stdin.once('finish',()=>eof.resolve());
  child.stdin.on('data',buffer=>{
    const request=JSON.parse(buffer.toString());requests.push(request);
    const result=request.method==='runtime/capabilities'?{independentPlanState:true}:{sessions:[]};
    // One stdout data event fulfills the request and then terminates the peer.
    child.stdout.write(JSON.stringify({id:request.id,result})+'\n'+(request.method===failOn?'{bad-frame}\n':''));
  });
  child.kill=()=>{throw new Error('Fixture must exit through the cleanup barrier')};
  let closed=false;
  return {
    child,requests,eof:eof.promise,
    finishClose(){if(closed)return;closed=true;child.stdout.end();child.stderr.end();child.emit('close',0)},
  };
}

export const batchFaultInstallation={
  appPath:'/fixture/ZCode.app',version:'fixture',build:'fixture',sha256:'fixture',
  launcher:process.execPath,cjs:'fixture',providerConfig:'fixture',verified:true,
  runtime:{execPath:process.execPath,node:process.versions.node,electron:'fixture',arch:process.arch},
};
