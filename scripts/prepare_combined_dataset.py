"""
Prepare Combined Dataset: Real FUNSD Benchmark + Office Documents
Merges 3,508 FUNSD real scanned form samples with 800 office document samples.
"""

import os
import json
from typing import List, Dict, Any


def prepare_combined():
    out_dir = "data/combined"
    os.makedirs(out_dir, exist_ok=True)

    # 1. Load FUNSD
    with open("data/benchmarks/funsd/funsd_train.json", "r", encoding="utf-8") as f:
        funsd_train = json.load(f)
    with open("data/benchmarks/funsd/funsd_val.json", "r", encoding="utf-8") as f:
        funsd_val = json.load(f)

    # 2. Load Office Corpus
    with open("data/corpus/train.json", "r", encoding="utf-8") as f:
        corpus_train = json.load(f)
    with open("data/corpus/val.json", "r", encoding="utf-8") as f:
        corpus_val = json.load(f)

    # Normalize image paths for corpus
    for s in corpus_train:
        if not s["page_image"].startswith("data/"):
            s["page_image"] = os.path.join("data/corpus/images", s["page_image"])
    for s in corpus_val:
        if not s["page_image"].startswith("data/"):
            s["page_image"] = os.path.join("data/corpus/images", s["page_image"])

    combined_train = funsd_train + corpus_train
    combined_val = funsd_val + corpus_val

    train_out = os.path.join(out_dir, "train.json")
    val_out = os.path.join(out_dir, "val.json")

    with open(train_out, "w", encoding="utf-8") as f:
        json.dump(combined_train, f, indent=2)
    with open(val_out, "w", encoding="utf-8") as f:
        json.dump(combined_val, f, indent=2)

    print("=" * 60)
    print("=== Combined Real Benchmark + Office Corpus Prepared ===")
    print(f"Total Train Samples: {len(combined_train)} (3,508 FUNSD + 800 Office)")
    print(f"Total Val Samples:   {len(combined_val)} (1,147 FUNSD + 200 Office)")
    print(f"Saved: {train_out} and {val_out}")
    print("=" * 60)


if __name__ == "__main__":
    prepare_combined()
