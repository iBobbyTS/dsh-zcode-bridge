/** The mirror accepts only official snapshots. A directory absence belongs to the last
 * confirmed read generation; it is not a durable local deletion record. */
export class MirrorState {
  snapshot=null;generation=0;directoryGeneration=0;directory=new Map();
  accept(snapshot){
    const old=this.snapshot;
    if(old&&old.logEpoch===snapshot.logEpoch&&(snapshot.seq<old.seq||snapshot.revision<old.revision))return {accepted:false,replaced:false};
    const replaced=!!old&&(old.logEpoch!==snapshot.logEpoch||old.rows.window.some(row=>{
      const next=snapshot.rows.window.find(value=>value.rowId===row.rowId);
      return next&&(next.kind!==row.kind||row.kind==='userInput'&&next.text!==row.text||row.kind==='assistantText'&&row.state==='complete'&&next.text!==row.text);
    }));
    this.snapshot=structuredClone(snapshot);if(replaced)this.generation++;
    return {accepted:true,replaced};
  }
  target(rowId){if(!this.snapshot)throw new Error('projection-unavailable');return {rowId,revision:this.snapshot.revision,logEpoch:this.snapshot.logEpoch,generation:this.generation}}
  assertTarget(target){if(!this.snapshot||target.generation!==this.generation||target.logEpoch!==this.snapshot.logEpoch||target.revision!==this.snapshot.revision)throw Object.assign(new Error('history-target-stale'),{code:'history-target-stale'})}
  acceptDirectory(generation,sessions){if(generation<=this.directoryGeneration)return false;this.directoryGeneration=generation;this.directory=new Map(sessions.map(session=>[session.sessionId,structuredClone(session)]));return true}
  hasSession(id){return this.directory.has(id)}
}
