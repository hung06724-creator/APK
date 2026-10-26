#!/usr/bin/env python3
"""
Tạo mẫu và xuất file Excel sổ theo dõi nhập/xuất (.xls) giữ nguyên bố cục mẫu gốc.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from typing import Any, Dict, List, Optional

import xlrd
from xlutils.copy import copy
import xlwt

# Cột dữ liệu (0-based), khớp mẫu Excel
COL = {
    "ngay_nhap": 0,
    "phieu_nhap": 1,
    "nguoi_nhap": 2,
    "don_vi_nhap": 3,
    "ngay_xuat": 4,
    "phieu_xuat": 5,
    "nguoi_linh": 6,
    "don_vi_linh": 7,
    "trich_yeu": 8,
    "tk_doi_ung": 9,
    "tieu_muc": 10,
    "dvt": 11,
    "sl_nhap_661": 12,
    "don_gia_nhap_661": 13,
    "thanh_tien_nhap_661": 14,
    "sl_xuat_661": 15,
    "don_gia_xuat_661": 16,
    "thanh_tien_xuat_661": 17,
    "sl_ton_661": 18,
    "don_gia_ton_661": 19,
    "thanh_tien_ton_661": 20,
    "sl_nhap_337": 21,
    "don_gia_nhap_337": 22,
    "thanh_tien_nhap_337": 23,
    "sl_xuat_337": 24,
    "don_gia_xuat_337": 25,
    "thanh_tien_xuat_337": 26,
    "sl_ton_337": 27,
    "don_gia_ton_337": 28,
    "thanh_tien_ton_337": 29,
}

DATA_START_ROW = 8  # hàng 9 Excel
HEADER_TITLE_ROW = 3  # hàng 4: QUÝ ... / NĂM ...

SHEET_SKIP = {"Sheet1", "Sheet3", "XL4Poppy"}


def _num(v: Any) -> Optional[float]:
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _calc_thanh_tien(sl: Any, dg: Any, stored: Any) -> Optional[float]:
    s = _num(stored)
    if s is not None:
        return s
    a, b = _num(sl), _num(dg)
    if a is None or b is None:
        return None
    return a * b


def _write_cell(sh, row: int, col: int, value: Any) -> None:
    if value is None or value == "":
        sh.write(row, col, "")
        return
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        sh.write(row, col, value)
        return
    sh.write(row, col, str(value))


def _colname(colx: int) -> str:
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    if colx <= 25:
        return alphabet[colx]
    xdiv26, xmod26 = divmod(colx, 26)
    return alphabet[xdiv26 - 1] + alphabet[xmod26]


def _write_formula_thanh_tien(sh, row: int, sl_col: int, dg_col: int, out_col: int) -> None:
    r = row + 1
    sl = _colname(sl_col)
    dg = _colname(dg_col)
    sh.write(row, out_col, xlwt.Formula(f"{sl}{r}*{dg}{r}"))


def _clear_sheet_data(sh, last_row: int) -> None:
    for r in range(DATA_START_ROW, last_row + 1):
        for c in range(30):
            sh.write(r, c, "")


def clean_workbook(src: str, dest: str) -> None:
    rb = xlrd.open_workbook(src, formatting_info=True)
    wb = copy(rb)
    for idx, name in enumerate(rb.sheet_names()):
        sh = wb.get_sheet(idx)
        if name.strip() in SHEET_SKIP or name == "XL4Poppy":
            # Xóa nội dung sheet phụ / macro cũ
            rs = rb.sheet_by_index(idx)
            for r in range(rs.nrows):
                for c in range(min(rs.ncols, 30)):
                    sh.write(r, c, "")
            continue
        rs = rb.sheet_by_index(idx)
        _clear_sheet_data(sh, rs.nrows - 1)
        # Tiêu đề kỳ: giữ cấu trúc, bỏ năm cũ
        old = rs.cell_value(HEADER_TITLE_ROW, 0) if rs.nrows > HEADER_TITLE_ROW else ""
        if isinstance(old, str) and old.strip():
            sh.write(HEADER_TITLE_ROW, 0, re.sub(r"\d{4}", "____", old.strip()))
        else:
            sh.write(HEADER_TITLE_ROW, 0, "NĂM ____")
    os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
    wb.save(dest)


def _fill_sheet(sh, rows: List[Dict[str, Any]], tieu_de: Optional[str]) -> int:
    if tieu_de:
        sh.write(HEADER_TITLE_ROW, 0, tieu_de)
    r0 = DATA_START_ROW
    for i, row in enumerate(rows):
        r = r0 + i
        for key, col in COL.items():
            if key.endswith("_thanh_tien"):
                continue
            _write_cell(sh, r, col, row.get(key))
        # Thành tiền: công thức giống mẫu (ưu tiên giá trị lưu nếu có)
        pairs = [
            ("sl_nhap_661", "don_gia_nhap_661", "thanh_tien_nhap_661"),
            ("sl_xuat_661", "don_gia_xuat_661", "thanh_tien_xuat_661"),
            ("sl_nhap_337", "don_gia_nhap_337", "thanh_tien_nhap_337"),
            ("sl_xuat_337", "don_gia_xuat_337", "thanh_tien_xuat_337"),
        ]
        for sl_k, dg_k, tt_k in pairs:
            tt = _calc_thanh_tien(row.get(sl_k), row.get(dg_k), row.get(tt_k))
            if tt is not None and row.get(tt_k) not in (None, ""):
                _write_cell(sh, r, COL[tt_k], tt)
            elif _num(row.get(sl_k)) is not None and _num(row.get(dg_k)) is not None:
                _write_formula_thanh_tien(sh, r, COL[sl_k], COL[dg_k], COL[tt_k])
            elif tt is not None:
                _write_cell(sh, r, COL[tt_k], tt)
        # Tồn: nhập tay (không công thức chạy tồn trong mẫu gốc hầu như trống)
        for k in ("sl_ton_661", "don_gia_ton_661", "thanh_tien_ton_661", "sl_ton_337", "don_gia_ton_337", "thanh_tien_ton_337"):
            _write_cell(sh, r, COL[k], row.get(k))

    if not rows:
        return DATA_START_ROW
    last_data = r0 + len(rows) - 1
    total_row = last_data + 1
    first = DATA_START_ROW + 1
    last = last_data + 1
    for col_letter_idx in (12, 13, 14, 15, 16, 17, 18, 19, 20):  # M-U
        c = col_letter_idx
        letter = _colname(c)
        sh.write(total_row, c, xlwt.Formula(f"SUM({letter}{first}:{letter}{last})"))
    return total_row


def export_workbook(template: str, dest: str, payload: Dict[str, Any]) -> None:
    rb = xlrd.open_workbook(template, formatting_info=True)
    wb = copy(rb)
    sheets_payload = payload.get("sheets") or []
    by_name = {s.get("ten_sheet", "").strip(): s for s in sheets_payload}

    data_sheet_names = [n for n in rb.sheet_names() if n.strip() not in SHEET_SKIP and n != "XL4Poppy"]
    if not sheets_payload:
        sheets_payload = [{"ten_sheet": data_sheet_names[0] if data_sheet_names else "", "tieu_de": None, "rows": []}]

    for idx, name in enumerate(rb.sheet_names()):
        if name.strip() in SHEET_SKIP or name == "XL4Poppy":
            continue
        sh = wb.get_sheet(idx)
        rs = rb.sheet_by_index(idx)
        _clear_sheet_data(sh, rs.nrows - 1)
        sp = by_name.get(name.strip())
        if not sp:
            # Gán sheet dữ liệu theo thứ tự nếu tên không khớp
            ord_idx = data_sheet_names.index(name) if name in data_sheet_names else -1
            if 0 <= ord_idx < len(sheets_payload):
                sp = sheets_payload[ord_idx]
        if sp:
            _fill_sheet(sh, sp.get("rows") or [], sp.get("tieu_de"))

    wb.save(dest)


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    p_clean = sub.add_parser("clean")
    p_clean.add_argument("--src", required=True)
    p_clean.add_argument("--dest", required=True)
    p_export = sub.add_parser("export")
    p_export.add_argument("--template", required=True)
    p_export.add_argument("--dest", required=True)
    p_export.add_argument("--json", required=True, help="Đường dẫn file JSON hoặc '-' cho stdin")
    args = parser.parse_args()

    if args.cmd == "clean":
        clean_workbook(args.src, args.dest)
        return 0
    if args.cmd == "export":
        raw = sys.stdin.read() if args.json == "-" else open(args.json, encoding="utf-8").read()
        payload = json.loads(raw)
        export_workbook(args.template, args.dest, payload)
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
