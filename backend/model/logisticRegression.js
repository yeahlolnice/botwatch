import { MODEL_FEATURES, modelVector } from './featureExtraction.js';

const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);

// --- feature standardization (mean 0 / std 1) so gradient descent converges ---
function fitScaler(X) {
    const d = X[0].length;
    const mean = new Array(d).fill(0);
    const std = new Array(d).fill(0);
    for (const row of X) for (let j = 0; j < d; j++) mean[j] += row[j];
    for (let j = 0; j < d; j++) mean[j] /= X.length;
    for (const row of X) for (let j = 0; j < d; j++) std[j] += (row[j] - mean[j]) ** 2;
    for (let j = 0; j < d; j++) std[j] = Math.sqrt(std[j] / X.length) || 1;
    return { mean, std };
}
const applyScaler = (x, { mean, std }) => x.map((v, j) => (v - mean[j]) / std[j]);

// --- training: batch gradient descent with L2 regularization ---
function trainWeights(X, y, { lr = 0.3, epochs = 800, l2 = 0.02 } = {}) {
    const n = X.length;
    const d = X[0].length;
    let w = new Array(d).fill(0);
    let b = 0;
    for (let e = 0; e < epochs; e++) {
        const gw = new Array(d).fill(0);
        let gb = 0;
        for (let i = 0; i < n; i++) {
            const err = sigmoid(dot(w, X[i]) + b) - y[i];
            for (let j = 0; j < d; j++) gw[j] += err * X[i][j];
            gb += err;
        }
        for (let j = 0; j < d; j++) w[j] -= lr * (gw[j] / n + l2 * w[j]);
        b -= lr * (gb / n);
    }
    return { w, b };
}

function metrics(model, X, y) {
    let tp = 0, fp = 0, tn = 0, fn = 0;
    for (let i = 0; i < X.length; i++) {
        const pred = sigmoid(dot(model.w, X[i]) + model.b) >= 0.5 ? 1 : 0;
        if (pred === 1 && y[i] === 1) tp++;
        else if (pred === 1 && y[i] === 0) fp++;
        else if (pred === 0 && y[i] === 0) tn++;
        else fn++;
    }
    const safe = (a, b) => (b > 0 ? a / b : 0);
    return {
        n: X.length,
        accuracy: safe(tp + tn, X.length),
        precision: safe(tp, tp + fp),
        recall: safe(tp, tp + fn),
        tp, fp, tn, fn,
    };
}

// Deterministic shuffle (seeded) so results are reproducible.
function shuffled(arr, seed = 42) {
    const a = arr.slice();
    let s = seed;
    const rand = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Train a model from labelled feature rows. Splits 70/30, standardizes on train,
// fits logistic regression, evaluates on the held-out test set.
export function trainModel(rows, opts = {}) {
    const data = shuffled(rows);
    const cut = Math.max(1, Math.floor(data.length * 0.7));
    const train = data.slice(0, cut);
    const test = data.slice(cut);

    const Xtrain = train.map((r) => modelVector(r.features));
    const yTrain = train.map((r) => r.label);
    const scaler = fitScaler(Xtrain);
    const Xs = Xtrain.map((x) => applyScaler(x, scaler));

    const { w, b } = trainWeights(Xs, yTrain, opts);

    const trainMetrics = metrics({ w, b }, Xs, yTrain);
    const testX = test.map((r) => applyScaler(modelVector(r.features), scaler));
    const testMetrics = test.length ? metrics({ w, b }, testX, test.map((r) => r.label)) : null;

    return {
        weights: w,
        bias: b,
        scaler,
        featureNames: MODEL_FEATURES,
        trainedAt: new Date().toISOString(),
        counts: { total: rows.length, train: train.length, test: test.length },
        metrics: { train: trainMetrics, test: testMetrics },
    };
}

// Score one features object → { score 0-100, factors: per-feature contributions
// (sorted by absolute impact) that drive the score — the explainability backbone
// for Phase 2.3.
export function scoreFeatures(model, features) {
    const x = applyScaler(modelVector(features), model.scaler);
    const contributions = model.weights.map((wj, j) => ({
        feature: model.featureNames[j],
        impact: wj * x[j],
        // scaled value: >0 means above average for this feature, <0 below.
        // Lets the explainer say whether the driver was a HIGH or LOW value.
        z: x[j],
    }));
    const z = contributions.reduce((s, c) => s + c.impact, 0) + model.bias;
    const score = Math.round(sigmoid(z) * 100);
    const factors = contributions.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
    return { score, factors };
}
