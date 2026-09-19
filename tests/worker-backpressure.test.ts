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
