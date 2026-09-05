"""Legacy bootstrap exporter for the original gesture-intelligence demo assets.

PT8 product model updates MUST use pt8_export_onnx.py plus the governed PT7/PT8
registry/deployment path. This file is retained only to reproduce the historical
bootstrap asset and refuses live-asset mutation unless an operator explicitly
opts into that legacy/research-only action.
"""

import hashlib
import json
import os
import pathlib
import sys

import numpy as np
import onnx
from onnx import TensorProto, helper

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "_output"
ASSETS = HERE.parent / "assets"
LEGACY_OVERRIDE = "NEMOSYNE_ALLOW_LEGACY_GESTURE_ASSET_OVERWRITE"

CLASSES = ["idle", "pinchTogether", "pinchApart", "scoopUp", "pushForward", "bothPinched"]
FEATURE_SPEC = (
    "56-dim: [0..15] left speed mag (|v|/2 clamp1), [16..18] left disp xyz (d/0.5 clamp), "
    "[19] left pinch fraction, [20..35] right speed mag, [36..38] right disp xyz, "
    "[39] right pinch fraction, [40..55] inter-hand distance series (/1.0), "
    "window decimated to 16 frames"
)


def main():
    if os.environ.get(LEGACY_OVERRIDE) != "1":
        print(
            "REFUSED: legacy exporter would overwrite live demo/runtime assets. "
            "Use the PT8 governed trainer/exporter and signed registry path. "
            f"Set {LEGACY_OVERRIDE}=1 only to reproduce the historical bootstrap asset.",
            file=sys.stderr,
        )
        sys.exit(3)

    w = np.load(OUT / "weights.npz")
    metrics = json.loads((OUT / "metrics.json").read_text(encoding="utf-8"))

    def tensor(name, arr):
        return helper.make_tensor(name, TensorProto.FLOAT, arr.shape, arr.flatten().tolist())

    W1 = w["W1"].astype(np.float32)
    b1 = w["b1"].astype(np.float32)
    W2 = w["W2"].astype(np.float32)
    b2 = w["b2"].astype(np.float32)
    W3 = w["W3"].astype(np.float32)
    b3 = w["b3"].astype(np.float32)

    nodes = [
        helper.make_node("Gemm", ["trajectory", "W1", "b1"], ["h1_pre"], alpha=1.0, beta=1.0),
        helper.make_node("Relu", ["h1_pre"], ["h1"]),
        helper.make_node("Gemm", ["h1", "W2", "b2"], ["h2_pre"], alpha=1.0, beta=1.0),
        helper.make_node("Relu", ["h2_pre"], ["h2"]),
        helper.make_node("Gemm", ["h2", "W3", "b3"], ["logits"], alpha=1.0, beta=1.0),
        helper.make_node("Softmax", ["logits"], ["probs"], axis=1),
    ]
    graph = helper.make_graph(
        nodes,
        "gesture_classifier",
        [helper.make_tensor_value_info("trajectory", TensorProto.FLOAT, [1, 56])],
        [helper.make_tensor_value_info("probs", TensorProto.FLOAT, [1, 6])],
        [tensor("W1", W1), tensor("b1", b1), tensor("W2", W2), tensor("b2", b2),
         tensor("W3", W3), tensor("b3", b3)],
    )
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 17)])
    model.ir_version = 8
    onnx.checker.check_model(model, full_check=True)

    ASSETS.mkdir(exist_ok=True)
    onnx_path = ASSETS / "gesture_classifier.onnx"
    onnx_path.write_bytes(model.SerializeToString())

    card = {
        "name": "gesture_classifier",
        "version": "1.0.0",
        "inputName": "trajectory",
        "outputName": "probs",
        "featureDim": 56,
        "classes": CLASSES,
        "featureSpec": FEATURE_SPEC,
        "metrics": {
            "heldOutAccuracy": metrics["held_out_accuracy"],
            "macroF1": metrics["macro_f1"],
            "samples": metrics["train_size"] + metrics["test_size"],
            "confusion": metrics["confusion"],
        },
        "sha256": hashlib.sha256(onnx_path.read_bytes()).hexdigest(),
    }
    (ASSETS / "model_card.json").write_text(json.dumps(card, indent=2), encoding="utf-8")
    (ASSETS / "training_report.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(f"LEGACY BOOTSTRAP ONLY: wrote {onnx_path} ({onnx_path.stat().st_size} bytes)")
    print(f"sha256={card['sha256']}")
    print(json.dumps(card["metrics"], indent=2))


if __name__ == "__main__":
    main()
