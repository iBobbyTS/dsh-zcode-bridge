// S04: the single bridge-owned model turn. This is a one-shot, explicitly bounded dispatch:
// it creates exactly one new official session inside the bridge's own scratch workspace and sends
// exactly one minimal prompt. It never targets a caller-supplied session, never resumes or closes a
// session, and never retries. The claim is recorded before the first side effect so a crash or a
// second call within the same launcher run cannot produce a second turn. The marker is scoped to the
// run root, so a launcher restarted with a fresh run root re-arms it; this is an observational
// budget guard (per-attempt accounting plus the UI single-turn path), not a durable hard gate.
export const MINIMAL_PROMPT='Reply with exactly: ok';
// Mode yolo is the official non-interactive permission mode; the minimal prompt must not stall on a
// permission interaction that no operator is watching.
export const MINIMAL_TURN_MODE='yolo';
// Hidden automation creators stay hidden: this turn must not create persistent cron/off-peak tasks.
export const MINIMAL_TURN_TOOL_DENYLIST=Object.freeze(['CronCreate','OffPeakCreate']);
/** The only official calls this dispatch may make; both are write calls, tracked separately. */
export const MINIMAL_TURN_CALLS=Object.freeze(['zcode-task.createTask','zcode-task.sendPrompt']);
const fault=code=>Object.assign(new Error(code),{code});
export function createMinimalTurn({call,usage,readTasks,workspacePath,recordClaim,hasClaimed=()=>false,now=Date.now}){
  if(typeof call!=='function'||typeof usage!=='function'||typeof readTasks!=='function'||typeof workspacePath!=='string'||!workspacePath||typeof recordClaim!=='function')throw fault('minimal-turn-config-invalid');
  let claimed=hasClaimed()===true;
  return {
    get claimed(){return claimed},
    /** One-shot dispatch. A second call is rejected before any side effect. */
    async run(){
      if(claimed)throw fault('minimal-turn-already-claimed');
      claimed=true;
      recordClaim();
      const usageBefore=await usage();
      const tasksBefore=await readTasks();
      // New session only: no draftSessionId, no resume, no caller-provided task id.
      const created=await call('zcode-task','createTask',[{workspacePath,mode:MINIMAL_TURN_MODE,deferPersistenceUntilFirstPrompt:true}]);
      if(!created||typeof created.taskId!=='string'||!created.taskId)throw fault('minimal-turn-create-invalid');
      const sendParams={taskId:created.taskId,content:MINIMAL_PROMPT,clientMode:'desktop-continuous',toolDenylist:[...MINIMAL_TURN_TOOL_DENYLIST]};
      if(typeof created.traceId==='string'&&created.traceId)sendParams.traceId=created.traceId;
      await call('zcode-task','sendPrompt',[sendParams]);
      return {taskId:created.taskId,workspacePath,traceId:typeof created.traceId==='string'?created.traceId:null,prompt:MINIMAL_PROMPT,mode:MINIMAL_TURN_MODE,usageBefore,tasksBefore,at:now(),calls:[...MINIMAL_TURN_CALLS]};
    },
  };
}
