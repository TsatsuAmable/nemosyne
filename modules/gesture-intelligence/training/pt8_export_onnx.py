"""Export a PT8 candidate gesture model without mutating runtime assets.

The output directory is owned by the reproducible training job. Promotion and
runtime activation happen later through the PT7 registry and signed deployment
manifests, never from this script.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import pathlib

import numpy as np
import onnx
from onnx import TensorProto, helper

CLASSES = ["idle", "pinchTogether", "pinchApart", "scoopUp", "pushForward", "bothPinched"]
FEATURE_SPEC = (
    "56-dim frozen PT6 gesture feature schema; exact schema identity is bound by the PT8 job manifest and feature dataset"
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", required=True, type=pathlib.Path)
    parser.add_argument("--output-dir", required=True, type=pathlib.Path)
    parser.add_argument("--model-version", required=True)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    weights = np.load(args.input_dir / "weights.npz")
    trainer_report = json.loads((args.input_dir / "trainer_report.json").read_text(encoding="utf-8"))

    def tensor(name: str, array: np.ndarray):
        return helper.make_tensor(name, TensorProto.FLOAT, array.shape, array.astype(np.float32).flatten().tolist())

    W1, b1 = weights["W1"], weights["b1"]
    W2, b2 = weights["W2"], weights["b2"]
    W3, b3 = weights["W3"], weights["b3"]
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
        [
            tensor("W1", W1), tensor("b1", b1), tensor("W2", W2),
            tensor("b2", b2), tensor("W3", W3), tensor("b3", b3),
        ],
    )
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 17)])
    model.ir_version = 8
    onnx.checker.check_model(model, full_check=True)

    model_path = args.output_dir / "gesture_classifier.onnx"
    model_path.write_bytes(model.SerializeToString())
    model_digest = hashlib.sha256(model_path.read_bytes()).hexdigest()
    card = {
        "schemaVersion": 2,
        "name": "gesture_classifier",
        "version": args.model_version,
        "inputName": "trajectory",
        "outputName": "probs",
        "featureDim": 56,
        "classes": CLASSES,
        "featureSpec": FEATURE_SPEC,
        "validationMetrics": trainer_report["validation"],
        "testMetrics": trainer_report["test"],
        "sha256": model_digest,
        "promotionDecision": None,
    }
    (args.output_dir / "model_card.json").write_text(json.dumps(card, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"model": str(model_path), "sha256": model_digest, "version": args.model_version}))


if __name__ == "__main__":
    main()
