from __future__ import annotations

import re
import secrets
from dataclasses import dataclass


@dataclass(frozen=True)
class ProbeCell:
    id: str
    category: str
    templates: tuple[str, ...]
    answers: tuple[str, ...]

# 颜色为规范化开放集（见 DESIGN.md 7.2）：接受常见中/英文颜色词，
# 通过 COLOR_ALIASES 归一到英文规范名后再校验，避免把 GPT 系模型
# 惯用的 cerulean/periwinkle 等合法颜色词误判为 invalid。
COLOR_ANSWERS = (
    "red", "orange", "yellow", "green", "blue", "purple", "pink",
    "brown", "black", "white", "gray", "cyan", "teal", "indigo",
    "violet", "magenta", "gold", "silver", "cerulean", "turquoise",
    "lavender", "maroon", "navy", "olive", "beige", "coral",
    "crimson", "azure", "periwinkle",
)


BATTERY = (
    ProbeCell("number_1_10_zh", "number", ("请随机选择 1 到 10 中的一个数字，只输出数字。", "从 1-10 随机取一个数，回答数字本身。"), tuple(str(i) for i in range(1, 11))),
    ProbeCell("number_1_10_en", "number", ("Choose a random number from 1 to 10. Output only the number.", "Pick one number at random between 1 and 10; answer with only the number."), tuple(str(i) for i in range(1, 11))),
    ProbeCell("coin", "coin", ("随机抛一次硬币，只回答正面或反面。", "Flip a coin randomly. Answer only heads or tails."), ("正面", "反面", "heads", "tails")),
    ProbeCell("color", "color", ("随机选择一种颜色，只输出颜色名称。", "Name one randomly selected color, with no explanation."), COLOR_ANSWERS),
    ProbeCell("letter", "letter", ("随机选择一个英文字母，只输出一个字母。", "Choose a random English letter and output only that letter."), tuple(chr(i) for i in range(ord("a"), ord("z") + 1))),
)


def choose_probe(index: int) -> tuple[ProbeCell, str]:
    cell = BATTERY[index % len(BATTERY)]
    return cell, secrets.choice(cell.templates)
