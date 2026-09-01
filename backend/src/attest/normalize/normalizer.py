from __future__ import annotations

import re
from dataclasses import dataclass

from ..probes import ProbeCell


@dataclass(frozen=True)
class NormalizedAnswer:
    answer: str | None
    valid: bool
    reason: str | None


NORMALIZATION_LABELS = {
    "empty_response": "响应中没有可提取的文本内容",
    "expected_single_number": "期望只返回 1 到 10 的一个数字",
    "expected_single_letter": "期望只返回一个英文字母",
    "unexpected_category": "回答不在该 Probe Cell 的允许值中",
}

COLOR_ALIASES = {
    "红": "red", "红色": "red",
    "橙": "orange", "橙色": "orange",
    "黄": "yellow", "黄色": "yellow",
    "绿": "green", "绿色": "green",
    "蓝": "blue", "蓝色": "blue",
    "紫": "purple", "紫色": "purple",
    "粉": "pink", "粉色": "pink", "粉红": "pink",
    "棕": "brown", "棕色": "brown", "褐色": "brown",
    "黑": "black", "黑色": "black",
    "白": "white", "白色": "white",
    "灰": "gray", "灰色": "gray", "grey": "gray",
    "青": "cyan", "青色": "cyan",
    "靛": "indigo", "靛蓝": "indigo",
    "金": "gold", "金色": "gold",
    "银": "silver", "银色": "silver",
    "紫罗兰": "violet",
    "品红": "magenta", "洋红": "magenta", "紫红": "magenta",
    "天蓝": "azure", "蔚蓝": "azure", "sky blue": "azure",
    "藏青": "navy", "海军蓝": "navy", "navy blue": "navy",
    "酒红": "maroon",
    "深红": "crimson", "绯红": "crimson",
    "翠绿": "green", "草绿": "green", "墨绿": "green", "嫩绿": "green",
    "橘": "orange", "橘黄": "orange",
    "玫红": "pink",
    "咖啡": "brown",
    "金黄": "gold",
    "柠檬黄": "yellow",
    "卡其": "khaki",
    "橄榄绿": "olive",
    "米色": "beige",
    "珊瑚色": "coral",
    "绿松石": "turquoise",
    "蓝绿": "teal", "蓝绿色": "teal", "青绿": "teal", "青绿色": "teal",
    "朱红": "vermilion",
    "薰衣草": "lavender", "淡紫": "lavender",
}

def _color_canonical(value: str) -> str:
    """归一颜色词：别名表 →"X色"尾缀 → 深浅/明暗前缀（深绿色→green、light blue→blue）。"""
    if value in COLOR_ALIASES:
        return COLOR_ALIASES[value]
    if value.endswith("色") and value[:-1] in COLOR_ALIASES:
        return COLOR_ALIASES[value[:-1]]
    match = re.fullmatch(r"(?:light|dark|pale|bright) ([a-z]+)", value)
    if match:
        return COLOR_ALIASES.get(match.group(1), match.group(1))
    if value[:1] in "深浅淡暗亮":
        rest = value[1:-1] if value.endswith("色") else value[1:]
        if rest in COLOR_ALIASES:
            return COLOR_ALIASES[rest]
    return value


def normalize_answer(cell: ProbeCell, text: str | None) -> NormalizedAnswer:
    if not text:
        return NormalizedAnswer(None, False, "empty_response")
    value = " ".join(text.strip().lower().replace("\u3000", " ").split())
    value = value.strip("`*_\"'.,:;!?。！？（）()[]")
    if cell.category == "number":
        if not re.fullmatch(r"10|[1-9]", value):
            return NormalizedAnswer(None, False, "expected_single_number")
        return NormalizedAnswer(value, True, None)
    if cell.category == "letter":
        if not re.fullmatch(r"[a-z]", value):
            return NormalizedAnswer(None, False, "expected_single_letter")
        return NormalizedAnswer(value, True, None)
    aliases = {"正面": "heads", "反面": "tails"}
    if cell.category == "color":
        # 颜色为规范化开放集（DESIGN.md 7.2）：已知颜色词归一到英文规范名；
        # 其余回答只要是单个词（纯拉丁字母或 1-3 个汉字）即视为有效，
        # 判别力交给分布比较，避免封闭白名单追不上模型的颜色长尾。
        answer = _color_canonical(value)
        if re.fullmatch(r"[a-z]+|[一-鿿]{1,3}", answer):
            return NormalizedAnswer(answer, True, None)
        return NormalizedAnswer(None, False, "unexpected_category")
    answer = aliases.get(value, value)
    valid = answer in {aliases.get(item, item) for item in cell.answers}
    return NormalizedAnswer(answer if valid else None, valid, None if valid else "unexpected_category")
