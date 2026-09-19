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
  t.result({requestId:'c',generation:1,datasetVersion:1,datasetFingerprint:'fp',value:'must-be-ignored'});
  expect((p as any)._pending.has('c')).toBe(false);
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


describe('UXR3-S1 worker admission lifecycle falsifiers',()=>{
 it('supersede/result race settles exactly once without leaking pending state',async()=>{
  const t=transport(); const p=new WorkerAnalyticalPort(t,null,null,{maxPendingExecutions:1});
  const pending=p.execute(req('race',1));
  p.supersede({generation:2});
  t.result({requestId:'race',generation:1,datasetVersion:1,datasetFingerprint:'fp',value:'late'});
  await expect(pending).resolves.toMatchObject({value:null});
  expect((p as any)._pending.size).toBe(0);
 });
 it('dispose under saturation settles admitted promises and clears admission state',async()=>{
  const t=transport(); const p=new WorkerAnalyticalPort(t,null,null,{maxPendingExecutions:1,maxPendingRegistrations:1});
  const execution=p.execute(req('busy'));
  const registration:any={registrationId:'reg',generation:1,dataset:{fingerprint:'reg-fp',version:1},payload:{type:'json',data:{name:'a',columns:[],rows:[]}}};
  const registered=p.registerDataset(registration);
  p.dispose();
  await expect(execution).rejects.toBeInstanceOf(KernelUnavailableError);
  await expect(registered).rejects.toBeInstanceOf(KernelUnavailableError);
  expect((p as any)._pending.size).toBe(0); expect((p as any)._pendingRegistrations.size).toBe(0); expect((p as any)._registrationPromises.size).toBe(0);
 });
 it('analytical payload contents cannot alter generic count-based admission',async()=>{
  const t=transport(); const p=new WorkerAnalyticalPort(t,null,null,{maxPendingExecutions:1});
  const first=p.execute({...req('first'),params:{score:-Infinity,priority:'discard-me'}} as any);
  await expect(p.execute({...req('second'),params:{score:Infinity,priority:'prefer-me'}} as any)).rejects.toBeInstanceOf(KernelUnavailableError);
  expect(t.postedMessages.filter((m:any)=>m.type==='EXECUTE').map((m:any)=>m.request.requestId)).toEqual(['first']);
  t.result({requestId:'first',generation:1,datasetVersion:1,datasetFingerprint:'fp',value:'kept'});
  await expect(first).resolves.toMatchObject({value:'kept'});
 });
});
