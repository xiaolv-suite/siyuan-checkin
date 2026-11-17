const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, file);
const original = Module._resolveFilename;
Module._resolveFilename = function(spec, parent, ...rest) {
    try { return original.call(this, spec, parent, ...rest); } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND' && spec.startsWith('.') && parent?.filename) {
            const file = path.resolve(path.dirname(parent.filename), spec + '.ts');
            if (fs.existsSync(file)) return file;
        }
        throw error;
    }
};
const sync = require('../src/features/occasion-siyuan-sync.ts');
const model = require('../src/model.ts');
const {createCheckinApi} = require('../src/api.ts');
const {parseProtyleCheckboxMutation} = require('../src/features/lifelog-append.ts');
const item = {id:'audit',name:'audit',kind:'scheduled',date:'2026-11-09',recurrence:'once',enabled:true,completedDates:[],blockId:'20261109090000-oldtask'};
const options = {notebookId:'notebook',todayKey:'2026-11-09',nowMs:Date.now(),bookDocId:'book'};
(async () => {
    for (const failure of ['attrs', 'update']) {
        const calls = [];
        const result = await sync.syncOccasionToSiyuanBlock(async (url, body) => {
            calls.push(url);
            if (url === '/api/query/sql') return {code:0,data:[{id:item.blockId,type:'i',subtype:'t'}]};
            if (url === '/api/block/updateBlock') return {code:failure==='update'?-1:0,data:[],msg:'unknown update result'};
            if (url === '/api/attr/setBlockAttrs') return {code:-1,msg:'disk failure'};
            return {code:0,data:[]};
        }, item, options);
        assert.equal(result.ok, false, failure+' must not report fully synced');
        assert.equal(calls.includes('/api/block/appendBlock'), false, 'unknown existing update must not create another task');
        assert.equal(result.blockId,item.blockId,'retain identity for safe retry');
    }
    assert.equal(parseProtyleCheckboxMutation({text:'custom-checkin-id="a" custom-checkin-date="2026-11-01"',checked:true},'2026-11-09').date,'2026-11-01');
    const now=new Date();now.setHours(12,0,0,0);
    const prior=new Date(now);prior.setDate(prior.getDate()-4);
    const start=new Date(now);start.setDate(start.getDate()-3);
    const end=new Date(now);end.setDate(end.getDate()-1);
    const store=model.createDefaultStore();
    const habit=model.normalizeItem({id:'a',name:'a',kind:'count',target:1,schedule:{type:'daily'},createdDate:model.dateKey(prior)});
    const limit=model.normalizeItem({id:'limit',name:'limit',kind:'count',target:3,direction:'atMost',schedule:{type:'daily'},createdDate:model.dateKey(prior)});
    store.items=[habit,limit];store.events=[prior,now].map((d,i)=>({id:'e'+i,itemId:'a',localDate:model.dateKey(d),occurredAt:d.toISOString(),value:1,source:'manual',kind:'count',unit:'次'}));
    const freeze=[{startDate:model.dateKey(start),endDate:model.dateKey(end)}];
    const api=createCheckinApi({store,streakFreezePeriods:freeze,acceptingOperations:true,disposed:false,disposing:false,initializationState:'ready'});
    assert.equal(api.getStreaks(['a'])[0].current,2,'public streak uses host freeze settings');
    assert.equal(api.getStreaks(['a'])[0].longest,2);
    const daily=api.getDailyProjection(model.dateKey(now));
    assert.equal(daily.items.find(x=>x.itemId==='limit').completed,true,'atMost comes from authoritative model');
    assert.equal(daily.totalItems,2);assert.equal(daily.truncated,false);
    console.log('audit-2026-11-09: failure receipts, identity, historical dates, freeze and authority passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
