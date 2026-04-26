from __future__ import annotations

import json
import math
import re
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[3]
PROJECT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "全国文保单位.xlsx"
OUTPUT = PROJECT / "data" / "poi-seed.json"

PROVINCES = [
    "北京市", "天津市", "上海市", "重庆市",
    "河北省", "山西省", "辽宁省", "吉林省", "黑龙江省",
    "江苏省", "浙江省", "安徽省", "福建省", "江西省", "山东省",
    "河南省", "湖北省", "湖南省", "广东省", "海南省",
    "四川省", "贵州省", "云南省", "陕西省", "甘肃省", "青海省",
    "内蒙古自治区", "广西壮族自治区", "西藏自治区", "宁夏回族自治区", "新疆维吾尔自治区",
]


def clean(value):
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    return str(value).replace("&mdash;", "—").strip()


def extract_province(address: str) -> str:
    for province in PROVINCES:
        if address.startswith(province):
            return province
    match = re.match(r"^(.{2,3}[省市区])", address)
    return match.group(1) if match else "未识别"


def bd09_to_gcj02(bd_lng: float, bd_lat: float) -> tuple[float, float]:
    x_pi = math.pi * 3000.0 / 180.0
    x = bd_lng - 0.0065
    y = bd_lat - 0.006
    z = math.sqrt(x * x + y * y) - 0.00002 * math.sin(y * x_pi)
    theta = math.atan2(y, x) - 0.000003 * math.cos(x * x_pi)
    return round(z * math.cos(theta), 6), round(z * math.sin(theta), 6)


def main() -> None:
    df = pd.read_excel(SOURCE, sheet_name=0)
    records = []
    for index, row in df.iterrows():
        name = clean(row["name"])
        address = clean(row["add"])
        remark = clean(row.get("remark"))
        code = clean(row["code"])
        batch = clean(row["batch"])
        gcj_lng, gcj_lat = bd09_to_gcj02(float(row["bd_lon"]), float(row["bd_lat"]))
        has_media = index % 5 == 0
        has_link = index % 7 == 0
        item = {
            "id": f"wh-{index + 1:04d}",
            "code": code,
            "classCode": clean(row["classCode"]),
            "name": name,
            "age": clean(row["age"]),
            "address": address,
            "province": extract_province(address),
            "type": clean(row["type"]) or "其他",
            "batch": batch,
            "remark": remark,
            "lng": round(float(row["lon"]), 6),
            "lat": round(float(row["lat"]), 6),
            "bdLng": round(float(row["bd_lon"]), 6),
            "bdLat": round(float(row["bd_lat"]), 6),
            "gcjLng": gcj_lng,
            "gcjLat": gcj_lat,
            "hasExt": bool(remark or has_media or has_link),
            "imageUrl": f"https://picsum.photos/seed/{index + 1}/960/540" if has_media else "",
            "website": f"https://baike.baidu.com/search/word?word={name}" if has_link else "",
            "createdAt": "2026-04-20T00:00:00.000Z",
            "updatedAt": "2026-04-20T00:00:00.000Z",
        }
        records.append(item)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {len(records)} POIs to {OUTPUT}")


if __name__ == "__main__":
    main()
