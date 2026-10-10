"""
Hardware-Accelerated Joint Multimodal Training Pipeline
Trains the Unified Document Intelligence Model on NVIDIA RTX 4050 GPU.

Implements:
- Corpus subword tokenizer training
- Mixed-Precision (AMP FP16) training with GradScaler
- Joint multi-task loss (Grounding Pointer + Operation + Property + Value)
- Best checkpoint saving and validation metrics logging
"""

import os
import sys
import json
import time
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from typing import Dict, Any, List

# Add src to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models import CorpusSubwordTokenizer, UnifiedDocumentIntelligenceModel
from data import (
    MultimodalDocumentDataset,
    collate_multimodal_batch,
    build_value_vocabulary,
    OP_MAP,
    PROP_MAP
)


def run_training(
    train_manifest: str = "data/combined/train.json",
    val_manifest: str = "data/combined/val.json",
    image_dir: str = "",
    checkpoint_dir: str = "checkpoints",
    epochs: int = 20,
    batch_size: int = 16,
    lr: float = 3e-4,
    hidden_dim: int = 256
):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    gpu_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"
    print("=" * 65)
    print(f"=== Multimodal Document Model Hardware-Accelerated Training ===")
    print(f"Device: {device} | GPU: {gpu_name}")
    print("=" * 65)

    os.makedirs(checkpoint_dir, exist_ok=True)

    # 1. Load data manifests
    with open(train_manifest, "r", encoding="utf-8") as f:
        train_raw = json.load(f)
    with open(val_manifest, "r", encoding="utf-8") as f:
        val_raw = json.load(f)

    print(f"Loaded {len(train_raw)} training samples, {len(val_raw)} validation samples.")

    # 2. Train corpus subword tokenizer from scratch across all real document elements
    tok_save_path = os.path.join(checkpoint_dir, "tokenizer.json")
    print("Training corpus subword tokenizer from scratch on full real-world corpus...")
    all_texts = [s.get("instruction", "") for s in train_raw]
    for s in train_raw:
        for el in s.get("elements", []):
            all_texts.append(el.get("text", ""))
    tokenizer = CorpusSubwordTokenizer(vocab_size=3000)
    tokenizer.train_from_texts(all_texts)
    tokenizer.save(tok_save_path)
    print(f"Tokenizer trained & saved to {tok_save_path} with {len(tokenizer)} tokens.")

    # 3. Build value vocabulary
    val_map, inv_val_map = build_value_vocabulary(train_raw, max_vocab=128)
    with open(os.path.join(checkpoint_dir, "val_map.json"), "w", encoding="utf-8") as f:
        json.dump(val_map, f, indent=2)

    # 4. Create PyTorch Datasets & DataLoaders with max_elements=64
    train_dataset = MultimodalDocumentDataset(
        manifest_path=train_manifest,
        tokenizer=tokenizer,
        val_map=val_map,
        image_dir=image_dir,
        max_text_len=64,
        max_elements=64
    )
    val_dataset = MultimodalDocumentDataset(
        manifest_path=val_manifest,
        tokenizer=tokenizer,
        val_map=val_map,
        image_dir=image_dir,
        max_text_len=64,
        max_elements=64
    )

    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        collate_fn=collate_multimodal_batch,
        num_workers=2,
        pin_memory=(device.type == "cuda")
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        collate_fn=collate_multimodal_batch,
        num_workers=2,
        pin_memory=(device.type == "cuda")
    )

    # 5. Initialize from-scratch model
    model = UnifiedDocumentIntelligenceModel(
        vocab_size=len(tokenizer),
        hidden_dim=hidden_dim,
        max_text_len=64,
        image_size=224,
        patch_size=16,
        num_element_types=16,
        num_fusion_layers=4,
        num_heads=4,
        ff_dim=1024,
        num_operations=len(OP_MAP),
        num_properties=len(PROP_MAP),
        num_values=len(val_map),
        dropout=0.1
    ).to(device)

    param_count = model.count_parameters()
    print(f"Total Trainable Parameters (From Scratch): {param_count:,} (~{param_count/1e6:.2f}M)")

    # 6. Loss & Optimizer
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scaler = torch.amp.GradScaler("cuda", enabled=(device.type == "cuda"))

    best_val_grounding = 0.0
    start_time = time.time()

    print("\nStarting Training Loop...")
    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        train_correct_target = 0
        train_total = 0

        for batch in train_loader:
            text_ids = batch["text_ids"].to(device)
            page_images = batch["page_images"].to(device)
            elem_boxes = batch["elem_boxes"].to(device)
            elem_types = batch["elem_types"].to(device)
            elem_mask = batch["elem_mask"].to(device)
            target_indices = batch["target_indices"].to(device)
            operation_ids = batch["operation_ids"].to(device)
            property_ids = batch["property_ids"].to(device)
            value_ids = batch["value_ids"].to(device)

            optimizer.zero_grad()

            with torch.amp.autocast("cuda", enabled=(device.type == "cuda")):
                outputs = model(
                    text_ids=text_ids,
                    page_images=page_images,
                    elem_boxes=elem_boxes,
                    elem_types=elem_types,
                    elem_mask=elem_mask,
                    target_indices=target_indices
                )

                loss_ground = criterion(outputs["grounding_logits"], target_indices)
                loss_op = criterion(outputs["operation_logits"], operation_ids)
                loss_prop = criterion(outputs["property_logits"], property_ids)
                loss_val = criterion(outputs["value_logits"], value_ids)

                loss = 2.0 * loss_ground + 1.0 * loss_op + 1.0 * loss_prop + 1.0 * loss_val

            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()

            total_loss += loss.item()
            preds = outputs["grounding_logits"].argmax(dim=-1)
            train_correct_target += (preds == target_indices).sum().item()
            train_total += target_indices.size(0)

        train_acc = (train_correct_target / train_total) * 100.0 if train_total > 0 else 0.0
        avg_loss = total_loss / len(train_loader)

        # Validation Loop
        model.eval()
        val_correct_target = 0
        val_correct_op = 0
        val_correct_prop = 0
        val_correct_val = 0
        val_total = 0

        with torch.no_grad():
            for batch in val_loader:
                text_ids = batch["text_ids"].to(device)
                page_images = batch["page_images"].to(device)
                elem_boxes = batch["elem_boxes"].to(device)
                elem_types = batch["elem_types"].to(device)
                elem_mask = batch["elem_mask"].to(device)
                target_indices = batch["target_indices"].to(device)
                operation_ids = batch["operation_ids"].to(device)
                property_ids = batch["property_ids"].to(device)
                value_ids = batch["value_ids"].to(device)

                with torch.amp.autocast("cuda", enabled=(device.type == "cuda")):
                    outputs = model(
                        text_ids=text_ids,
                        page_images=page_images,
                        elem_boxes=elem_boxes,
                        elem_types=elem_types,
                        elem_mask=elem_mask
                    )

                pred_target = outputs["grounding_logits"].argmax(dim=-1)
                pred_op = outputs["operation_logits"].argmax(dim=-1)
                pred_prop = outputs["property_logits"].argmax(dim=-1)
                pred_val = outputs["value_logits"].argmax(dim=-1)

                val_correct_target += (pred_target == target_indices).sum().item()
                val_correct_op += (pred_op == operation_ids).sum().item()
                val_correct_prop += (pred_prop == property_ids).sum().item()
                val_correct_val += (pred_val == value_ids).sum().item()
                val_total += target_indices.size(0)

        val_target_acc = (val_correct_target / val_total) * 100.0 if val_total > 0 else 0.0
        val_op_acc = (val_correct_op / val_total) * 100.0 if val_total > 0 else 0.0
        val_prop_acc = (val_correct_prop / val_total) * 100.0 if val_total > 0 else 0.0
        val_val_acc = (val_correct_val / val_total) * 100.0 if val_total > 0 else 0.0

        print(
            f"Epoch [{epoch:02d}/{epochs:02d}] Loss: {avg_loss:.3f} | Train Ground: {train_acc:.1f}% || "
            f"Val: Ground={val_target_acc:.1f}%, Op={val_op_acc:.1f}%, Prop={val_prop_acc:.1f}%, Val={val_val_acc:.1f}%"
        )

        # Save best model checkpoint
        if val_target_acc >= best_val_grounding:
            best_val_grounding = val_target_acc
            best_path = os.path.join(checkpoint_dir, "best_model.pt")
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_target_acc": val_target_acc,
                "vocab_size": len(tokenizer),
                "num_values": len(val_map),
                "hidden_dim": hidden_dim
            }, best_path)

    elapsed = time.time() - start_time
    print("-" * 65)
    print(f"Training Completed in {elapsed:.1f}s | Best Val Grounding: {best_val_grounding:.1f}%")
    print(f"Checkpoint saved to {os.path.join(checkpoint_dir, 'best_model.pt')}")
    print("-" * 65)


if __name__ == "__main__":
    run_training(epochs=25)
