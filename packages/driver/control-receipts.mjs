import {AsyncLocalStorage} from 'node:async_hooks';

// The native Inbox/cancel contracts are synchronous. Their owning async Remote
// seam waits only for control requests issued within that exact invocation.
const invocations=new AsyncLocalStorage();
export function captureControlReceipt(agent,type,task){
  const invocation=invocations.getStore();
  if(invocation?.active&&invocation.agent===agent&&invocation.type===type)invocation.tasks.push(task);
  return task;
}
export async function withControlReceipts(agent,type,operation){
  const invocation={agent,type,active:true,tasks:[]};
  return invocations.run(invocation,async()=>{
    try{
      const result=await operation();
      await Promise.all(invocation.tasks);
      return result;
    }finally{invocation.active=false}
  });
}
