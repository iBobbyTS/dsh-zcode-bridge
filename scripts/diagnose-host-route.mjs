// Read-only DSH product probe: only disposable contexts and loopback sockets.
// The counterfactual changes a getter in this process, never upstream files.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { apply, inject } from '../packages/host/index.mjs';

const dsh=resolve(process.env.DSH_CHECKOUT??'../dsh');
const [{Context,getTraceable},{HostConnectionService},{default:WebServer}]=await Promise.all([
  import(pathToFileURL(resolve(dsh,'vendor/cordis/lib/index.js')).href),
  import(pathToFileURL(resolve(dsh,'packages/client/connection/lib/index.js')).href),
  import(pathToFileURL(resolve(dsh,'packages/host/webserver/lib/index.js')).href),
]);
const descriptor=Object.getOwnPropertyDescriptor(HostConnectionService.prototype,'rpc');
const auth={isAuthenticated:request=>request.headers.cookie==='route-probe=allowed'};

async function probe(counterfactual) {
  const ctx=new Context();
  if(counterfactual){
    Object.defineProperty(HostConnectionService.prototype,'rpc',{...descriptor,get(){
      const shadow=this.ctx;
      const owner=getTraceable(shadow,shadow);
      return descriptor.get.call(Object.create(this,{ctx:{value:owner}}));
    }});
  }
  try{
    await ctx.plugin(owner=>{new HostConnectionService(owner,[],auth)});
    const host=await ctx.plugin({inject,apply});
    await ctx.plugin(WebServer,{host:'127.0.0.1',port:0});
    // Capture failed child fibers below; their rejection is the probe evidence.
    for(const runtime of ctx.registry.values())for(const fiber of runtime.fibers)await fiber.await().catch(()=>{});
    const url=`http://127.0.0.1:${ctx.get('webServer').port}/zcode-bridge/status`;
    const options={method:'POST',headers:{cookie:'route-probe=allowed','content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:'route-probe',method:'status',payload:{}})};
    const response=await fetch(url,options);
    const body=await response.text();
    const childFibers=[...ctx.registry.values()].flatMap(runtime=>[...runtime.fibers])
      .filter(fiber=>fiber.parent.fiber===host).map(fiber=>({inject:Object.keys(fiber.inject),state:fiber.state,error:fiber._error?.message??null}));
    const beforeUnload=response.status;
    const hostStateBeforeUnload=host.state;
    await host.dispose();
    const afterUnload=(await fetch(url,options)).status;
    return {counterfactual,hostStateBeforeUnload,childFibers,status:beforeUnload,body,afterUnload,modelCalls:0};
  }finally{
    try{await ctx.fiber.dispose()}finally{Object.defineProperty(HostConnectionService.prototype,'rpc',descriptor)}
  }
}

const actual=await probe(false);
const control=await probe(true);
console.log(JSON.stringify({actual,control},null,2));
if(actual.status!==200||control.status!==200||control.afterUnload!==404)process.exitCode=1;
