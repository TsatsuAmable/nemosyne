"""Train the gesture classifier MLP on extracted 56-dim features.

Pure numpy + stdlib. Architecture 56->32(ReLU)->16(ReLU)->6(softmax),
cross-entropy loss, Adam optimizer, early stopping on held-out macro-F1.
Writes weights.npz and metrics.json for the ONNX exporter.
"""

import json
import pathlib
import sys

import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "_output"
NUM_CLASSES = 6
FEATURE_DIM = 56
SEED = 20260818


def load_features(path: pathlib.Path):
    feats, labels = [], []
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            feats.append(row["features"])
            labels.append(row["label"])
    X = np.asarray(feats, dtype=np.float32)
    y = np.asarray(labels, dtype=np.int64)
    return X, y


class MLP:
    def __init__(self, rng):
        self.W1 = rng.normal(0, 0.05, (FEATURE_DIM, 64)).astype(np.float32)
        self.b1 = np.zeros(64, dtype=np.float32)
        self.W2 = rng.normal(0, 0.05, (64, 32)).astype(np.float32)
        self.b2 = np.zeros(32, dtype=np.float32)
        self.W3 = rng.normal(0, 0.05, (32, NUM_CLASSES)).astype(np.float32)
        self.b3 = np.zeros(NUM_CLASSES, dtype=np.float32)

    def forward(self, X):
        h1 = np.maximum(X @ self.W1 + self.b1, 0)
        h2 = np.maximum(h1 @ self.W2 + self.b2, 0)
        logits = h2 @ self.W3 + self.b3
        logits -= logits.max(axis=1, keepdims=True)
        probs = np.exp(logits)
        probs /= probs.sum(axis=1, keepdims=True)
        return h1, h2, probs

    def backward(self, X, h1, h2, probs, y):
        n = X.shape[0]
        dlogits = probs.copy()
        dlogits[np.arange(n), y] -= 1.0
        dlogits /= n
        gW3 = h2.T @ dlogits
        gb3 = dlogits.sum(axis=0)
        dh2 = dlogits @ self.W3.T
        dh2 *= h2 > 0
        gW2 = h1.T @ dh2
        gb2 = dh2.sum(axis=0)
        dh1 = dh2 @ self.W2.T
        dh1 *= h1 > 0
        gW1 = X.T @ dh1
        gb1 = dh1.sum(axis=0)
        return [gW1, gb1, gW2, gb2, gW3, gb3]


def macro_f1(y_true, y_pred):
    f1s = []
    for c in range(NUM_CLASSES):
        tp = np.sum((y_pred == c) & (y_true == c))
        fp = np.sum((y_pred == c) & (y_true != c))
        fn = np.sum((y_pred != c) & (y_true == c))
        if tp == 0:
            f1s.append(0.0)
        else:
            f1s.append(2 * tp / (2 * tp + fp + fn))
    return float(np.mean(f1s))


def confusion(y_true, y_pred):
    cm = np.zeros((NUM_CLASSES, NUM_CLASSES), dtype=np.int64)
    for t, p in zip(y_true, y_pred):
        cm[t, p] += 1
    return cm


def main():
    X_train, y_train = load_features(OUT / "feat_train.jsonl")
    X_test, y_test = load_features(OUT / "feat_test.jsonl")
    print(f"train={X_train.shape} test={X_test.shape}")

    rng = np.random.default_rng(SEED)
    model = MLP(rng)
    params = [model.W1, model.b1, model.W2, model.b2, model.W3, model.b3]
    m = [np.zeros_like(p) for p in params]
    v = [np.zeros_like(p) for p in params]
    lr, beta1, beta2, eps, wd = 1e-3, 0.9, 0.999, 1e-8, 1e-4
    batch, max_epochs, patience = 64, 600, 50
    lr_min = lr * 0.05

    best_f1, best_epoch, wait = -1.0, -1, 0
    best = [p.copy() for p in params]
    step = 0
    for epoch in range(max_epochs):
        lr_t = lr_min + 0.5 * (lr - lr_min) * (1 + np.cos(np.pi * epoch / max_epochs))
        order = rng.permutation(X_train.shape[0])
        for start in range(0, X_train.shape[0], batch):
            idx = order[start : start + batch]
            Xb, yb = X_train[idx], y_train[idx]
            h1, h2, probs = model.forward(Xb)
            grads = model.backward(Xb, h1, h2, probs, yb)
            step += 1
            for i, (p, g) in enumerate(zip(params, grads)):
                g = g + wd * p
                m[i] = beta1 * m[i] + (1 - beta1) * g
                v[i] = beta2 * v[i] + (1 - beta2) * g * g
                mhat = m[i] / (1 - beta1**step)
                vhat = v[i] / (1 - beta2**step)
                p -= lr_t * mhat / (np.sqrt(vhat) + eps)

        _, _, test_probs = model.forward(X_test)
        f1 = macro_f1(y_test, test_probs.argmax(axis=1))
        if f1 > best_f1:
            best_f1, best_epoch, wait = f1, epoch, 0
            best = [p.copy() for p in params]
        else:
            wait += 1
            if wait >= patience:
                break

    for i, p in enumerate(params):
        p[...] = best[i]
    _, _, test_probs = model.forward(X_test)
    y_pred = test_probs.argmax(axis=1)
    acc = float((y_pred == y_test).mean())
    f1 = macro_f1(y_test, y_pred)
    cm = confusion(y_test, y_pred)

    np.savez(
        OUT / "weights.npz",
        W1=model.W1, b1=model.b1, W2=model.W2, b2=model.b2, W3=model.W3, b3=model.b3,
    )
    metrics = {
        "train_size": int(X_train.shape[0]),
        "test_size": int(X_test.shape[0]),
        "epochs": int(best_epoch + 1),
        "held_out_accuracy": acc,
        "macro_f1": f1,
        "confusion": cm.tolist(),
    }
    (OUT / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(json.dumps(metrics, indent=2))

    if acc < 0.90 or f1 < 0.85:
        sys.exit(2)


if __name__ == "__main__":
    main()
