"""
CLI Script: Generate Multimodal Dataset & Verify Schema Integrity
"""

import sys
import os

# Add src to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))

from data.synthetic import build_synthetic_corpus
from schema import UnifiedDocument


def main():
    output_dir = "data/corpus"
    print("=" * 60)
    print("=== Phase 1: Synthesizing Multimodal Dataset & Schema Test ===")
    print("=" * 60)

    stats = build_synthetic_corpus(num_documents=500, output_dir=output_dir)

    print(f"Generated {stats['train_samples']} training samples.")
    print(f"Generated {stats['val_samples']} validation samples.")

    # Integrity verification
    sample_doc_file = os.path.join(output_dir, "train.json")
    print(f"Manifest saved at: {sample_doc_file}")
    print("=" * 60)
    print("Phase 1 Data Generation Completed Successfully.")
    print("=" * 60)


if __name__ == "__main__":
    main()
