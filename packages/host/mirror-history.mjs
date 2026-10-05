/** Keep the native append-only audit log and live identity intact while exposing the current
 * confirmed official history segment to DSH's ordinary history window consumer. */
export function currentHistory(frame,record){
  const start=record.historyStartSeq??0;
  const records=frame.records.filter(entry=>entry.event.seq>=start);
  return {...frame,records,hasMore:frame.hasMore&&records.length>0&&records[0].event.seq>start};
}
export function installMirrorHistory(ctx,runtime){
  ctx.inject(['sessionController'],scope=>{
    const controller=scope.sessionController,follow=controller.follow,page=controller.page;
    const mirrored=request=>request?.address?.kind==='session'?runtime.store.records.get(request.address.sessionId):undefined;
    const wrappedFollow=async function*(request,signal){
      const record=mirrored(request);if(!record){yield* follow.call(this,request,signal);return}
      // Close this physical follow generation only. Native RemoteStream treats an accepted
      // end as carrier loss, retaining the resident window until a fresh opening replaces it.
      while(!signal?.aborted){
        const generation=record.historyGeneration??0,changed=new AbortController();
        const lifetime=signal?AbortSignal.any([signal,changed.signal]):changed.signal;
        const release=runtime.subscribeHistory(record.id,()=>changed.abort());let opened=false;
        try{
          for await(const frame of follow.call(this,request,lifetime)){
            if(generation!==(record.historyGeneration??0))break;
            opened=true;yield frame.type==='snapshot'?currentHistory(frame,record):frame;
          }
        }catch(error){if(!changed.signal.aborted)throw error}
        finally{release();changed.abort()}
        // A replacement racing initial acquisition retries locally before publishing an opening.
        // After an opening, end the carrier so the native client advances its physical generation.
        if(opened||signal?.aborted||generation===(record.historyGeneration??0))return;
      }

    };
    const wrappedPage=async function(request,signal){const result=await page.call(this,request,signal);const record=mirrored(request);return record?currentHistory(result,record):result};
    controller.follow=wrappedFollow;controller.page=wrappedPage;
    scope.effect(()=>()=>{if(Object.getOwnPropertyDescriptor(controller,'follow')?.value===wrappedFollow)controller.follow=follow;if(Object.getOwnPropertyDescriptor(controller,'page')?.value===wrappedPage)controller.page=page},'zcode-bridge: confirmed mirror history segment');
  });
}
