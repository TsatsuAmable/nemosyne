import { describe, expect, it } from "vitest";
import { calibrationObservationFromEpisode, calibrationObservationFromGuidedUx } from "../../dev/xr-lab/EvidenceCalibrationAdapters.ts";

describe("XR calibration adapters", () => {
  it("maps simulator failures without upgrading evidence tier", () => {
    const result = calibrationObservationFromEpisode({ schemaVersion:"1", evaluationId:"e1", buildHash:"a".repeat(40), scenarioId:"s1", environment:{mode:"desktop-simulator",browser:"chromium",device:null,xrRuntime:"iwer",refreshRateHz:90}, agent:{id:"sim",kind:"simulator"}, capabilityGrant:[], consentRecordId:null, startedAt:"2026-09-11T00:00:00Z", finishedAt:"2026-09-11T00:01:00Z", steps:[{stepId:"select",sequence:1,description:"select",outcome:"FAILED"}], measurements:[], observations:[], suggestions:[], screenshots:[], uxTraceReference:null, investigationReference:null, outcome:"FAILED" });
    expect(result).toMatchObject({tier:"S2",kind:"simulator",outcome:"FAIL",failureClasses:["step:select"]});
  });
  it("maps governed guided UX into S4 physical evidence", () => {
    const tasks = ["select-commit-cancel","direct-touch-commit","near-retreat-ray","capture-cancel-recovery","dense-precision-escape","panel-spatial-controls","representation-semantic-stability","disabled-reason-comprehension","accessibility-treatment","error-recovery-first-insight"];
    const result = calibrationObservationFromGuidedUx({schemaVersion:"1",sessionId:"q1",sessionLabel:"q",buildId:"b".repeat(40),deviceBuildFingerprint:"quest",evidenceKind:"guided-physical-ux",results:tasks.map((taskId)=>({taskId,outcome:taskId==="direct-touch-commit"?"fail":"pass",inputModality:"controller",modalityBasis:"investigator-selected",recordedAt:"2026-09-11T00:00:00Z",note:null})),comfortObservation:{outcome:"comfortable",recordedAt:"2026-09-11T00:00:00Z",note:null},completedAt:"2026-09-11T00:01:00Z"} as any,"s1");
    expect(result).toMatchObject({tier:"S4",kind:"physical-device",outcome:"FAIL",failureClasses:["ux:direct-touch-commit"]});
  });
});
