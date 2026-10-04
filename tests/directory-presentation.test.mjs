import test from 'node:test';
import assert from 'node:assert/strict';
import {projectTaskCatalog} from '../packages/host/launcher/task-catalog.mjs';
import {sortDirectoryRows,directorySections} from '../packages/client/directory-presentation.mjs';

test('task catalog keeps pinned membership, removes deleted rows and merges overlap without new reads',()=>{
  const task={taskId:'one',workspacePath:'/one',title:'Custom',titleOverridden:true,updatedAt:10};
  const rows=projectTaskCatalog([task,{...task,taskId:'deleted',deleted:true}],[task,{...task,workspacePath:'/two'}]);
  assert.equal(rows.length,2);assert.ok(rows.every(row=>row.pinned&&row.titleOverridden));
  assert.deepEqual(rows.map(row=>row.workspacePath),['/one','/two']);
  assert.throws(()=>projectTaskCatalog({},[]),/route-b-tasks-invalid/);
});

test('318 unsorted tasks page after pinned-first updated DESC sorting and workspace partitioning',()=>{
  const rows=Array.from({length:318},(_,i)=>({key:String(i).padStart(3,'0'),address:{workspace:i%2?'/one':'/two'},sharedTask:{lastActivityAt:i,pinned:i===1}}));
  const sorted=sortDirectoryRows(rows),page=sorted.slice(0,20);
  assert.equal(sorted[0].key,'001');assert.equal(sorted[1].key,'317');assert.equal(sorted.at(-1).key,'000');
  const sections=directorySections(page);assert.equal(sections[0].pinned,true);
  assert.equal(sections.flatMap(section=>section.rows).length,20);
  assert.ok(sections.every(section=>section.rows.every(row=>row.address.workspace===section.workspace)));
  assert.deepEqual(sortDirectoryRows([{key:'b'},{key:'a'}]).map(row=>row.key),['a','b']);
  assert.deepEqual(rows.map(row=>row.key),Array.from({length:318},(_,i)=>String(i).padStart(3,'0')));
});
