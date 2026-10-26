#!/usr/bin/env python3
"""So sánh cấu trúc header (dòng 1–8, merge) giữa mẫu và file xuất."""
import sys
import xlrd

def compare(template: str, exported: str) -> int:
    t = xlrd.open_workbook(template, formatting_info=True)
    e = xlrd.open_workbook(exported, formatting_info=True)
    errors = []
    for name in t.sheet_names():
        if name.strip() in {"Sheet1", "Sheet3", "XL4Poppy"}:
            continue
        if name not in e.sheet_names():
            errors.append(f"Thiếu sheet {name!r} trong file xuất")
            continue
        ts, es = t.sheet_by_name(name), e.sheet_by_name(name)
        if ts.merged_cells != es.merged_cells:
            errors.append(f"Sheet {name!r}: merged_cells khác mẫu")
        for r in range(8):
            if r == 3:  # dòng 4: tiêu đề quý/năm — do người dùng cấu hình
                continue
            for c in range(30):
                tv = str(ts.cell_value(r, c)).strip() if ts.cell_value(r, c) else ""
                ev = str(es.cell_value(r, c)).strip() if es.cell_value(r, c) else ""
                if tv != ev:
                    errors.append(f"Sheet {name!r} ô {r+1},{c+1}: mẫu={tv!r} xuất={ev!r}")
    if errors:
        print("FAIL:")
        for err in errors[:30]:
            print(" -", err)
        return 1
    print("OK: header và merge khớp mẫu")
    return 0

if __name__ == "__main__":
    raise SystemExit(compare(sys.argv[1], sys.argv[2]))
