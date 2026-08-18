"""Export the trained MLP weights to ONNX and write the model card.

Builds the graph with the `onnx` package directly (no torch): Gemm/Relu/Softmax
over the trained numpy weights, validates with onnx.checker, and emits both
assets/gesture_classifier.onnx and assets/model_card.json.
"""

import hashlib
import json
import pathlib

import numpy as np
import onnx
from onnx import TensorProto, helper

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "_output"
ASSETS = HERE.parent / "assets"

CLASSES = ["idle", "pinchTogether", "pinchApart", "scoopUp", "pushForward", "bothPinched"]
FEATURE_SPEC = (
    "56-dim: [0..15] left speed mag (|v|/2 clamp1), [16..18] left disp xyz (d/0.5 clamp), "
    "[19] left pinch fraction, [20..35] right speed mag, [36..38] right disp xyz, "
    "[39] right pinch fraction, [40..55] inter-hand distance series (/1.0), "
    "window decimated to 16 frames"
)


def main():
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
    print(f"wrote {onnx_path} ({onnx_path.stat().st_size} bytes)")
    print(f"sha256={card['sha256']}")
    print(json.dumps(card["metrics"], indent=2))


if __name__ == "__main__":
    main()
