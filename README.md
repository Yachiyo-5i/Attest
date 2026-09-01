<div align="center">
  <img src="frontend/public/logo.png" alt="Attest logo" width="120" />
  <h1>Attest</h1>
  <p><strong>A black-box consistency verifier for third-party LLM APIs.</strong></p>
  <p>
    <a href="README.md">English</a> · <a href="README_zh.md">中文</a>
  </p>
</div>

---

**Attest** answers a narrow but statistically testable question:

> Does the suspect endpoint still behave like the reference baseline of the model it claims to serve?

Attest does not try to "guess which model this is" from a few conversations, and it does not trust the `model` field in a response, HTTP headers, or a model saying "I am GPT/Claude" — all of those are controlled by the server and prove nothing about what actually ran the inference.

## What it detects

- **Fixed substitution** — every request is silently handled by a cheaper or older model while labeled as a premium one.
- **Downgraded versions** — a newer model replaced by an older or lower-tier sibling in the same family.
- **Quantization / deployment changes** — lower-precision serving that shifts the output distribution.
- **Dynamic routing** — simple questions go to a cheap model, hard ones to the expensive model.
- **Request rewriting** — injected system prompts, locked sampling parameters, truncated context, or altered tool calls.

The output is a reproducible evidence report, not a "real / fake" verdict. Attest deliberately distinguishes between *incompatible with reference*, *mixed or dynamic routing*, *transport altered*, and *insufficient evidence* — it never collapses a single statistical anomaly into an accusation of fraud.

## How it works

### The core idea: behavioral fingerprints

When an LLM is asked to pick a random number, color, letter, or city, its answers are **not uniform**. Training data, the tokenizer, post-training, and the sampling stack together produce stable, model-specific preferences. One model may repeatedly favor certain numbers while another prefers different ones.

A single answer carries no discriminative power. But the **empirical distribution of answers across many samples of the same question** forms a fingerprint. Attest collects that distribution from a trusted reference, then measures how far a suspect endpoint's distribution drifts from it.

### Reference gateway enrollment

Attest never calls a vendor's official endpoint directly, and it does not require a separate API key per model. All reference baselines are collected through **a single reference gateway you provide** — one base URL, one key, which forwards to whichever provider and model is being enrolled.

This matters for two reasons:

1. The reference and the suspect are measured under **identical conditions** — same system prompt, same prompt templates, same temperature / top-p / token limits, same protocol adapter, same probe battery version.
2. Any rewriting the gateway itself does becomes part of the baseline, so the comparison stays honest.

Each model + protocol combination produces an independent, versioned **Profile** (a baseline). Profiles carry a calibration quality gate and expire; an expired or low-quality baseline cannot be used to reach a confident verdict.

### The probe battery

The first layer uses a battery of short-answer probes across several categories:

| Task | Answer space | What it probes |
|---|---|---|
| Random number 1–10 (Chinese & English) | closed set | cheap, stable distribution |
| Coin flip | binary | weak signal + consistency check |
| Random color | normalized open set | cultural / vocabulary preference |
| Random letter | closed set | tokenizer / training preference |

Each question (a "cell") is sampled many times. Prompts are **randomized across equivalent templates** — paraphrases, punctuation, casing, and execution order vary per request — so the battery cannot be recognized and evaded by matching a fixed public prompt.

### Distance measurement

For each cell, Attest computes the **Jensen–Shannon divergence (JSD)** between the reference and suspect answer distributions:

```
m = (p + q) / 2
JSD(p, q) = ½ · KL(p ‖ m) + ½ · KL(q ‖ m)
```

JSD is symmetric, bounded, and tolerates the two sides having different support sets — well suited to sparse categorical distributions. The aggregate distance is a weighted mean across cells, **computed only when every cell has enough comparable evidence**; when evidence is insufficient the aggregate is `null`, never fabricated into a high distance.

Because small samples are noisy, every run is **bootstrapped**: answers are resampled with replacement within each cell, the aggregate JSD is recomputed, and a 95% confidence interval is produced. A clear mismatch is only reported when the entire confidence interval clears the model-specific threshold. Borderline results are marked `INCONCLUSIVE`.

### Per-model calibrated thresholds

Attest does not use a single fixed JSD threshold across all models. Different models and serving stacks have different natural variance. Each Profile carries its own **match / mismatch thresholds** with a gray zone between them:

```
D ≤ match_threshold     →  consistent with reference
D ≥ mismatch_threshold  →  incompatible with reference
in between              →  inconclusive, sample more or re-test
```

If there isn't enough calibration data to meet both the false-alarm and the miss-rate targets, the system refuses to produce a confident verdict rather than forcing a threshold.

### Transport & integrity layer

Behavioral drift isn't always a swapped model — a relay might rewrite the request. So the protocol layer is checked independently and reported separately:

- Whether response `model`, request id, usage, and finish reason are present and self-consistent
- Whether sampling parameters (temperature, max tokens, reasoning) were accepted, rejected, or silently ignored
- Whether context was silently truncated
- Whether tool schemas / tool call arguments / structured output were altered
- Signs of system-prompt injection or leakage

These signals cannot prove the underlying model identity, but they explain *why* a fingerprint drifted. A model's self-reported identity is logged only as a near-zero-weight auxiliary field — any service can preset "you are Claude/GPT".

## Verdicts

- `CONSISTENT_WITH_REFERENCE` — no statistical inconsistency with the reference found under current evidence.
- `INCOMPATIBLE_WITH_REFERENCE` — the statistical test rejects consistency with the reference.
- `MIXED_OR_DYNAMIC_ROUTING` — the suspect endpoint itself shows multiple backends or time-varying behavior.
- `TRANSPORT_OR_PARAMETER_ALTERED` — requests, context, stream, or tool calls may have been rewritten by an intermediate layer.
- `INCONCLUSIVE` — sampling, protocol, or baseline evidence is insufficient for a reliable conclusion.

`CONSISTENT_WITH_REFERENCE` is **not** a cryptographic proof. Without a trusted execution environment, remote attestation, or vendor signing, black-box testing only provides statistical evidence.

## What Attest cannot prove

- That a precise checkpoint definitely produced a response.
- That a difference came from malicious substitution rather than a vendor update, quantization, sampler, or safety-layer change.
- That a provider who passes the test will never switch models on traffic outside the test.
- That behavioral consistency is equivalent to byte-identical weights.

## Deployment

Attest ships as a **single container**: the React frontend is compiled to static files and served by the FastAPI backend. `/data` is the only directory that needs to be persisted (SQLite database, baselines, reports).

```bash
docker compose up -d
```

Then open `http://127.0.0.1:8321` and sign in with the password configured in `docker-compose.yml` (`ATTEST_AUTH_PASSWORD`). For production, place the container behind an HTTPS reverse proxy and set `ATTEST_COOKIE_SECURE=true`.
