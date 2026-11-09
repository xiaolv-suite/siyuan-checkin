// Actual production graph loader shared with the first audit regressions.
require('./audit-2026-11-09-regressions.test.cjs');
const assert=require('node:assert/strict');
const {createOccasionMirrorCoordinator,withOccasionMirrorLock,readMirrorJournal,assertMirrorRestore}=require('../src/features/occasion-mirror-coordinator.ts');
const {syncOccasionToSiyuanBlock}=require('../src/features/occasion-siyuan-sync.ts');
const item={id:'a',name:'a',kind:'scheduled',date:'2026-11-09',recurrence:'once',enabled:true,completedDates:[]};
const opts={bookDocId:'book',notebookId:'notebook',todayKey:'2026-11-09',nowMs:Date.now()};
(async()=>{
 let appended=0,journal=null,current={...item},failBind=true;
 const post=async(url,body)=>{if(url==='/api/query/sql'){if(body.stmt.includes("WHERE id ="))return{code:0,data:[{id:current.blockId||'task',type:'i',subtype:'t'}]};if(body.stmt.includes('WITH RECURSIVE'))return{code:0,data:[{id:'task'}]};return{code:0,data:[]};}if(url==='/api/block/appendBlock'){appended++;return{code:0,data:[{doOperations:[{id:'task'}]}]};}return{code:0,data:[]};};
 const deps={post,lock:withOccasionMirrorLock,freshItem:async()=>({...current}),readJournal:async()=>journal,saveJournal:async value=>{journal=structuredClone(value);},bind:async(_,id)=>{if(failBind)throw Error('disk');current.blockId=id;}};
 const run=createOccasionMirrorCoordinator(deps);
 const first=await run('a',opts);assert.equal(first.reason,'binding-persist-not-confirmed');assert.equal(appended,1);assert.equal(journal.entries[0].blockId,'task');
 failBind=false;await Promise.all([run('a',opts),createOccasionMirrorCoordinator(deps)('a',opts)]);assert.equal(appended,1,'two instances reload persisted identity under origin lock');assert.equal(current.blockId,'task');
 await assert.rejects(async()=>assertMirrorRestore(readMirrorJournal(journal),readMirrorJournal(null)));
 const before=appended;const unavailable=await syncOccasionToSiyuanBlock(async(url)=>url==='/api/query/sql'?{code:-1}:post(url,{}),{...item,blockId:'task'},opts);assert.equal(unavailable.ok,false);assert.equal(appended,before);
 journal={v:1,entries:[{itemId:'a',phase:'reserved'}]};current={...item};const unknown=await run('a',opts);assert.equal(unknown.reason,'creation-result-unknown');assert.equal(appended,before);
 console.log('mirror recovery: query failure, persisted identities, concurrent retry, binding failure and old restore passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
