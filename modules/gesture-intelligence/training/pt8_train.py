"""PT8 governed gesture trainer.

Consumes exact PT8-resolved train/validation/test JSONL files. The validation
split alone controls early stopping; the test split is evaluated exactly once
after the selected weights are frozen. No metric is a deployment authority and
this script never writes the runtime asset directory.
"""

from __future__ import annotations

import argparse
import json
import pathlib
from dataclasses import dataclass

import numpy as np

CLASSES = ["idle", "pinchTogether", "pinchApart", "scoopUp", "pushForward", "bothPinched"]
CLASS_TO_INDEX = {name: index for index, name in enumerate(CLASSES)}
FEATURE_DIM = 56


@dataclass(frozen=True)
class LoadedSplit:
    features: np.ndarray
    labels: np.ndarray
    records: list[dict]


def load_split(path: pathlib.Path) -> LoadedSplit:
    rows: list[dict] = []
    features: list[list[float]] = []
    labels: list[int] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            row = json.loads(line)
            expected = {"recordId", "profilePseudonymId", "features", "label"}
            if set(row) != expected:
                raise ValueError(f"{path}:{line_number}: unexpected row keys")
            vector = row["features"]
            label = row["label"]
            if not isinstance(vector, list) or len(vector) != FEATURE_DIM:
                raise ValueError(f"{path}:{line_number}: expected {FEATURE_DIM} features")
            if label not in CLASS_TO_INDEX:
                raise ValueError(f"{path}:{line_number}: unknown gesture label")
            clean = [float(value) for value in vector]
            if not all(np.isfinite(clean)) or not all(-1.0 <= value <= 1.0 for value in clean):
                raise ValueError(f"{path}:{line_number}: invalid feature value")
            rows.append(row)
            features.append(clean)
            labels.append(CLASS_TO_INDEX[label])
    if not rows:
        raise ValueError(f"{path}: split is empty")
    return LoadedSplit(
        features=np.asarray(features, dtype=np.float32),
        labels=np.asarray(labels, dtype=np.int64),
        records=rows,
    )


class MLP:
    def __init__(self, rng: np.random.Generator):
        self.W1 = rng.normal(0, 0.05, (FEATURE_DIM, 64)).astype(np.float32)
        self.b1 = np.zeros(64, dtype=np.float32)
        self.W2 = rng.normal(0, 0.05, (64, 32)).astype(np.float32)
        self.b2 = np.zeros(32, dtype=np.float32)
        self.W3 = rng.normal(0, 0.05, (32, len(CLASSES))).astype(np.float32)
        self.b3 = np.zeros(len(CLASSES), dtype=np.float32)

    @property
    def params(self):
        return [self.W1, self.b1, self.W2, self.b2, self.W3, self.b3]

    def forward(self, inputs: np.ndarray):
        hidden1 = np.maximum(inputs @ self.W1 + self.b1, 0)
        hidden2 = np.maximum(hidden1 @ self.W2 + self.b2, 0)
        logits = hidden2 @ self.W3 + self.b3
        logits -= logits.max(axis=1, keepdims=True)
        probs = np.exp(logits)
        probs /= probs.sum(axis=1, keepdims=True)
        return hidden1, hidden2, probs

    def backward(self, inputs, hidden1, hidden2, probs, labels):
        count = inputs.shape[0]
        dlogits = probs.copy()
        dlogits[np.arange(count), labels] -= 1.0
        dlogits /= count
        grad_W3 = hidden2.T @ dlogits
        grad_b3 = dlogits.sum(axis=0)
        d_hidden2 = dlogits @ self.W3.T
        d_hidden2 *= hidden2 > 0
        grad_W2 = hidden1.T @ d_hidden2
        grad_b2 = d_hidden2.sum(axis=0)
        d_hidden1 = d_hidden2 @ self.W2.T
        d_hidden1 *= hidden1 > 0
        grad_W1 = inputs.T @ d_hidden1
        grad_b1 = d_hidden1.sum(axis=0)
        return [grad_W1, grad_b1, grad_W2, grad_b2, grad_W3, grad_b3]


def metrics(labels: np.ndarray, predictions: np.ndarray) -> dict:
    confusion = np.zeros((len(CLASSES), len(CLASSES)), dtype=np.int64)
    for actual, predicted in zip(labels, predictions, strict=True):
        confusion[actual, predicted] += 1
    f1s = []
    per_class = []
    for index, gesture in enumerate(CLASSES):
        true_positive = int(confusion[index, index])
        false_positive = int(confusion[:, index].sum() - true_positive)
        false_negative = int(confusion[index, :].sum() - true_positive)
        support = int(confusion[index, :].sum())
        precision = true_positive / (true_positive + false_positive) if true_positive + false_positive else 0.0
        recall = true_positive / support if support else 0.0
        f1 = (2 * true_positive / (2 * true_positive + false_positive + false_negative)
              if 2 * true_positive + false_positive + false_negative else 0.0)
        f1s.append(f1)
        per_class.append({
            "gesture": gesture,
            "support": support,
            "precision": precision,
            "recall": recall,
            "f1": f1,
        })
    return {
        "accuracy": float((predictions == labels).mean()),
        "macroF1": float(np.mean(f1s)),
        "confusion": confusion.tolist(),
        "perClass": per_class,
    }


def write_predictions(path: pathlib.Path, split: LoadedSplit, predictions: np.ndarray) -> None:
    with path.open("w", encoding="utf-8") as handle:
        for row, predicted in zip(split.records, predictions, strict=True):
            output = {
                "recordId": row["recordId"],
                "profilePseudonymId": row["profilePseudonymId"],
                "actualGesture": row["label"],
                "predictedGesture": CLASSES[int(predicted)],
            }
            handle.write(json.dumps(output, separators=(",", ":")) + "\n")


def train(train_split: LoadedSplit, validation_split: LoadedSplit, seed: int):
    rng = np.random.default_rng(seed)
    model = MLP(rng)
    params = model.params
    moment1 = [np.zeros_like(param) for param in params]
    moment2 = [np.zeros_like(param) for param in params]
    learning_rate = 1e-3
    beta1, beta2, epsilon, weight_decay = 0.9, 0.999, 1e-8, 1e-4
    batch_size, max_epochs, patience = 64, 600, 50
    min_learning_rate = learning_rate * 0.05
    best_score, best_epoch, wait, step = -1.0, -1, 0, 0
    best_params = [param.copy() for param in params]

    for epoch in range(max_epochs):
        current_lr = min_learning_rate + 0.5 * (learning_rate - min_learning_rate) * (
            1 + np.cos(np.pi * epoch / max_epochs)
        )
        order = rng.permutation(train_split.features.shape[0])
        for start in range(0, train_split.features.shape[0], batch_size):
            indexes = order[start:start + batch_size]
            inputs, labels = train_split.features[indexes], train_split.labels[indexes]
            hidden1, hidden2, probs = model.forward(inputs)
            grads = model.backward(inputs, hidden1, hidden2, probs, labels)
            step += 1
            for index, (param, grad) in enumerate(zip(params, grads, strict=True)):
                grad = grad + weight_decay * param
                moment1[index] = beta1 * moment1[index] + (1 - beta1) * grad
                moment2[index] = beta2 * moment2[index] + (1 - beta2) * grad * grad
                corrected1 = moment1[index] / (1 - beta1 ** step)
                corrected2 = moment2[index] / (1 - beta2 ** step)
                param -= current_lr * corrected1 / (np.sqrt(corrected2) + epsilon)

        validation_predictions = model.forward(validation_split.features)[2].argmax(axis=1)
        score = metrics(validation_split.labels, validation_predictions)["macroF1"]
        if score > best_score:
            best_score, best_epoch, wait = score, epoch, 0
            best_params = [param.copy() for param in params]
        else:
            wait += 1
            if wait >= patience:
                break

    for index, param in enumerate(params):
        param[...] = best_params[index]
    return model, best_epoch + 1


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", required=True, type=pathlib.Path)
    parser.add_argument("--output-dir", required=True, type=pathlib.Path)
    parser.add_argument("--seed", required=True, type=int)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    train_split = load_split(args.input_dir / "train.jsonl")
    validation_split = load_split(args.input_dir / "validation.jsonl")
    test_split = load_split(args.input_dir / "test.jsonl")
    model, epochs = train(train_split, validation_split, args.seed)

    validation_predictions = model.forward(validation_split.features)[2].argmax(axis=1)
    test_predictions = model.forward(test_split.features)[2].argmax(axis=1)
    validation_metrics = metrics(validation_split.labels, validation_predictions)
    test_metrics = metrics(test_split.labels, test_predictions)

    np.savez(
        args.output_dir / "weights.npz",
        W1=model.W1, b1=model.b1, W2=model.W2, b2=model.b2, W3=model.W3, b3=model.b3,
    )
    write_predictions(args.output_dir / "validation_predictions.jsonl", validation_split, validation_predictions)
    write_predictions(args.output_dir / "test_predictions.jsonl", test_split, test_predictions)
    report = {
        "schemaVersion": 1,
        "seed": args.seed,
        "epochs": epochs,
        "trainSize": len(train_split.records),
        "validationSize": len(validation_split.records),
        "testSize": len(test_split.records),
        "validation": validation_metrics,
        "test": test_metrics,
        "promotionDecision": None,
    }
    (args.output_dir / "trainer_report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, separators=(",", ":")))


if __name__ == "__main__":
    main()
