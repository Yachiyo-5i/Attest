from __future__ import annotations

import hashlib
import math
import random
from collections import Counter
from typing import Iterable


def distribution(values: Iterable[str], categories: Iterable[str] = ()) -> dict[str, float]:
    values = list(values)
    counts = Counter(values)
    keys = set(categories) | set(counts)
    if not keys:
        return {}
    total = len(values) or 1
    return {key: counts.get(key, 0) / total for key in sorted(keys)}


def jsd(p: dict[str, float], q: dict[str, float]) -> float:
    keys = set(p) | set(q)
    if not keys:
        return 0.0
    eps = 1e-12
    total = 0.0
    for key in keys:
        pv, qv = max(p.get(key, 0.0), eps), max(q.get(key, 0.0), eps)
        mv = (pv + qv) / 2
        total += 0.5 * pv * math.log(pv / mv) + 0.5 * qv * math.log(qv / mv)
    return total / math.log(2)


def bootstrap_jsd(reference: list[str], suspect: list[str], categories: list[str], seed_text: str, rounds: int = 200) -> dict[str, float]:
    if not reference or not suspect:
        return {"lower": 0.0, "upper": 1.0}
    seed = int(hashlib.sha256(seed_text.encode()).hexdigest()[:16], 16)
    rng = random.Random(seed)
    values: list[float] = []
    for _ in range(rounds):
        rp = [reference[rng.randrange(len(reference))] for _ in reference]
        sq = [suspect[rng.randrange(len(suspect))] for _ in suspect]
        values.append(jsd(distribution(rp, categories), distribution(sq, categories)))
    values.sort()
    return {"lower": values[int(rounds * 0.025)], "upper": values[int(rounds * 0.975) - 1]}
