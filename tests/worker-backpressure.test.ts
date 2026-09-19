import { describe, expect, it } from 'vitest';
import { WorkerAnalyticalPort, type WorkerTransport } from '../src/atlas/ports/WorkerAnalyticalPort.ts';
import { KernelUnavailableError } from '../src/wasm/runtime/RuntimeState.ts';

function transport(): WorkerTransport & { postedMessages: any[]; result(r:any):void } {
  const t:any={postedMessages:[],onmessage:null,onerror:null,postMessage(m:any){this.postedMessages.push(m)},terminate(){},result(r:any){this.onmessage?.({data:{type:'RESULT',result:r}})}};
  return t;
}
const req=(id:string,generation=1)=>({requestId:id,operation:'tda.persistence',dataset:{fingerprint:'fp',version:1},generation,params:{}} as any);

describe('UXR3-S1 worker admission backpressure',()=>{
 it('caps same-generation executions and releases capacity after completion',async()=>{
  const t=transport(); const p=new WorkerAnalyticalPort(t,null,null,{maxPendingExecutions:2});
  const a=p.execute(req('a')), b=p.execute(req('b'));
  await expect(p.execute(req('c'))).rejects.toBeInstanceOf(KernelUnavailableError);
  t.result({requestId:'a',generation:1,datasetVersion:1,datasetFingerprint:'fp',value:1});
  await expect(a).resolves.toMatchObject({value:1});
  const c=p.execute(req('c')); expect(t.postedMessages.filter((m:any)=>m.type==='EXECUTE')).toHaveLength(3);
  t.result({requestId:'b',generation:1,datasetVersion:1,datasetFingerprint:'fp',value:2});
  t.result({requestId:'c',generation:1,datasetVersion:1,datasetFingerprint:'fp',value:3});
  await Promise.all([b,c]);
 });
 it('supersession releases stale execution capacity and late stale result cannot corrupt fresh request',async()=>{
  const t=transport(); const p=new WorkerAnalyticalPort(t,null,null,{maxPendingExecutions:1});
  const stale=p.execute(req('stale',1)); p.supersede({generation:2}); await expect(stale).resolves.toMatchObject({value:null});
  const fresh=p.execute(req('fresh',2));
  t.result({requestId:'stale',generation:1,datasetVersion:1,datasetFingerprint:'fp',value:'bad'});
  t.result({requestId:'fresh',generation:2,datasetVersion:1,datasetFingerprint:'fp',value:'good'});
  await expect(fresh).resolves.toMatchObject({value:'good'});
 });
 it('caps distinct registrations while preserving duplicate registration deduplication',async()=>{
  const t=transport(); const p=new WorkerAnalyticalPort(t,null,null,{maxPendingRegistrations:1});
  const r:any={registrationId:'r1',dataset:{fingerprint:'fp1',version:1},payload:{type:'json',data:{name:'a',columns:[],rows:[]}}};
  const first=p.registerDataset(r); const duplicate=p.registerDataset({...r,registrationId:'r1-duplicate'});
  expect(duplicate).toBe(first);
  const second:any={...r,registrationId:'r2',dataset:{fingerprint:'fp2',version:1}};
  await expect(p.registerDataset(second)).rejects.toBeInstanceOf(KernelUnavailableError);
  t.onmessage?.(new MessageEvent('message',{data:{type:'REGISTERED',registrationId:'r1',generation:r.generation,datasetVersion:1,datasetFingerprint:'fp1'}}));
  await expect(first).resolves.toBeUndefined();
  expect(t.postedMessages.filter((m:any)=>m.type==='REGISTER')).toHaveLength(1);
 });
});

describe('UXR3-S1 hard worker cancellation', () => {
 it('recycles a worker when supersession makes every outstanding item stale', async () => {
  const first:any=transport(); first.terminated=false; first.terminate=()=>{first.terminated=true};
  const second:any=transport();
  const p=new WorkerAnalyticalPort(first,null,null,{maxPendingExecutions:1},()=>second);
  const stale=p.execute(req('stale-hard',1));
  p.supersede({generation:2});
  await expect(stale).resolves.toMatchObject({value:null});
  expect(first.terminated).toBe(true);
  const fresh=p.execute(req('fresh-hard',2));
  expect(second.postedMessages.some((m:any)=>m.type==='EXECUTE'&&m.request.requestId==='fresh-hard')).toBe(true);
  first.result({requestId:'stale-hard',generation:1,datasetVersion:1,datasetFingerprint:'fp',value:'bad'});
  second.result({requestId:'fresh-hard',generation:2,datasetVersion:1,datasetFingerprint:'fp',value:'good'});
  await expect(fresh).resolves.toMatchObject({value:'good'});
 });
 it('fails soft when replacement construction throws', async () => {
  const first:any=transport(); first.terminated=false; first.terminate=()=>{first.terminated=true};
  const p=new WorkerAnalyticalPort(first,null,null,{maxPendingExecutions:1},()=>{throw new Error('replacement failed')});
  const stale=p.execute(req('replacement-failure',1));
  expect(()=>p.supersede({generation:2})).not.toThrow();
  await expect(stale).resolves.toMatchObject({value:null});
  expect(first.terminated).toBe(false);
 });
 it('does not recycle when supersession leaves any outstanding item current', async () => {
  const first:any=transport(); first.terminated=false; first.terminate=()=>{first.terminated=true};
  const p=new WorkerAnalyticalPort(first,null,null,{maxPendingExecutions:3},()=>transport());
  const stale=p.execute(req('old',1));
  const current=p.execute(req('current',2));
  p.supersede({generation:2});
  await expect(stale).resolves.toMatchObject({value:null});
  expect(first.terminated).toBe(false);
  first.result({requestId:'current',generation:2,datasetVersion:1,datasetFingerprint:'fp',value:'kept'});
  await expect(current).resolves.toMatchObject({value:'kept'});
 });
});

describe('UXR3-S1 worker lifecycle outcomes', () => {
 it('records cancellation only when a stale worker is actually recycled', async () => {
  const first:any=transport(); const second:any=transport();
  const p=new WorkerAnalyticalPort(first,null,null,{maxPendingExecutions:1},()=>second);
  const stale=p.execute(req('cancelled',1)); p.supersede({generation:2}); await stale;
  expect(p.drainOutcomes()).toEqual([expect.objectContaining({id:'cancelled',outcome:'cancelled-by-worker-recycle'})]);
 });
 it('records a mismatched result as discarded rather than completed', async () => {
  const t:any=transport(); const p=new WorkerAnalyticalPort(t,null,null,{maxPendingExecutions:1});
  const pending=p.execute(req('mismatch',2));
  t.result({requestId:'mismatch',generation:1,datasetVersion:1,datasetFingerprint:'fp',value:'wrong'}); await expect(pending).rejects.toBeInstanceOf(KernelUnavailableError);
  expect(p.drainOutcomes()).toEqual([expect.objectContaining({id:'mismatch',outcome:'discarded-stale-result'})]);
 });
 it('records completed work but does not call a supersession request a cancellation', async () => {
  const t:any=transport(); const p=new WorkerAnalyticalPort(t,null,null,{maxPendingExecutions:2});
  const current=p.execute(req('completed',2)); p.supersede({generation:2});
  t.result({requestId:'completed',generation:2,datasetVersion:1,datasetFingerprint:'fp',value:1}); await current;
  expect(p.drainOutcomes()).toEqual([expect.objectContaining({id:'completed',outcome:'completed'})]);
 });
});
