# UXR3-S1 finite closure review

**Specimen:** `4c05b3038c843ba43875226fa22744bba2a1dfa1`  
**Scope:** production asynchronous chunk, Worker/WASM transfer, presentation-materialisation and teardown producer/consumer paths.  
**Disposition:** **PASS / STOP for UXR3-S1 software scope.** Proceed to UXR3-E1. This does not establish physical memory release timing, latency, Quest fitness, human comprehension, or analytical/scientific performance.

## Closure criteria

S1 requires bounded queues/admission, explicit refusal/backpressure or safe cancellation where demand can outrun consumption, generation/revision invalidation for analytical Worker work, and observable software lifecycle outcomes. Ordinary synchronous serialization buffers are not producer/consumer queues and are not made S1 defects merely because they append chunks.

## Inventory and findings

| Path | Classification | Closure evidence |
| --- | --- | --- |
| `WorkerAnalyticalPort` execution | BOUNDED | Pending executions have finite admission; saturation fails closed; supersession fences stale generations; wholly stale work can recycle the Worker; bounded outcomes distinguish completed, recycled-before-response, and stale/mismatched result disposition. |
| `WorkerAnalyticalPort` dataset registration | BOUNDED | Distinct registrations have finite admission while duplicate identity shares the admitted promise; supersession/recycle releases stale capacity. |
| `analytical.worker.ts` | CONSUMER / NO SECOND QUEUE | Worker consumes `REGISTER`, `EXECUTE`, and `SUPERSEDE`; it does not introduce a second application queue. Main-thread admission is authoritative for outstanding requests. Synchronous WASM cannot process a queued supersede mid-call, which is why the owner-supported Worker recycle path exists for wholly stale work. |
| `SemanticMaterialisationGovernor` | BOUNDED | `maxQueued`, `maxResident`, per-tick materialisation budget and optional retained-byte/semantic-element/render-batch/work-unit limits provide explicit presentation admission and bounded consumption. |
| representation resource disposal | BOUNDED WORK SCHEDULING | Cooling performs incremental shallow disposal and the resource lifecycle governor owns the bounded lifecycle. The object traversal stack is derived from one already-admitted representation, not an independent demand queue. |
| GitHub corpus body reader | BYTE-BOUNDED STREAM | Streaming body accumulation enforces `maxBytes`, cancels the reader on overflow, and releases the reader lock. |
| Nemosyne package decompression | BYTE-BOUNDED ACCUMULATION | Uncompressed package/file limits are checked before retaining further decoded content. This is bounded ingestion, not an ungoverned async work queue. |
| `FlatBuffersSerializer` chunk array | NOT S1 QUEUE | Synchronous serialization of an already-admitted dataset. Chunk appends are construction of one output buffer, not producer/consumer backlog. Dataset-scale admission remains a separate scale concern and is not falsely claimed closed here. |
| signalling offline queue | BOUNDED / OUTSIDE ANALYTICAL S1 | Queue is capped at 100 and drops oldest while disconnected; existing resiliency tests cover the cap. Collaboration signalling is not analytical Worker/WASM authority. |
| governance/crypto `chunks.push` sites | NOT S1 QUEUES | Deterministic encoding/hash construction, not asynchronous semantic/analytical producer-consumer pipelines. |
| persistence `Promise.all` | NOT S1 QUEUE | Fixed fan-out initialization reads, not accumulating demand. |

## Adversarial challenge

**Producer outruns consumer:** analytical execution/registration and semantic materialisation refuse excess demand at finite bounds. Corpus/package ingestion has byte ceilings. No second production analytical queue was found.

**Cancellation race / stale completion:** Worker generation/version/fingerprint fences and result-identity checks prevent stale or mismatched output from becoming current work. Hard Worker recycling is intentionally limited to the case where all outstanding work is stale, so unrelated current work is not killed.

**Telemetry inflation:** lifecycle outcomes are bounded software observations only. They do not become analytical evidence, training data, or physical-resource claims.

**Payload retention/privacy:** S1 outcome records retain identifiers/fence metadata, not source rows or analytical payloads. Semantic governor stores caller-provided presentation values within its resident bound; the review does not broaden retention.

**False genericity:** synchronous serializers and deterministic chunk builders were explicitly rejected as evidence of queue/backpressure defects. This avoids adding a second scheduling mechanism where no producer/consumer imbalance exists.

## Residuals moved forward

1. UXR3-E1 must test the generic bounded semantic contract across every production family actually using it, including hostile imbalance and refine/collapse/evict/reconstruct identity preservation.
2. Physical memory/resource-release timing remains downstream evidence, not inferred from queue cardinality.
3. Dataset serializer peak allocation can be revisited under measured UXR4/resource evidence if it becomes a demonstrated bottleneck; it is not an S1 streaming queue finding.
4. Physical Quest and human claims remain open.

## Decision

No material unbounded production streaming/Worker/WASM transfer producer remains that justifies another UXR3-S1 mechanism slice. **STOP S1. Start UXR3-E1 cross-family qualification.**
