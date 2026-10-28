"""
Real Benchmark Ingestion: FUNSD Dataset
(Form Understanding in Noisy Scanned Documents)

Downloads and parses the standard FUNSD benchmark into the UnifiedDocument schema,
providing real scanned documents with true bounding boxes, keys, and values.
"""

import os
import sys
import zipfile
import json
import urllib.request
from typing import Dict, Any, List

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from schema import UnifiedDocument, DocumentPage, DocumentElement, ElementStyle


FUNSD_URL = "https://guillaumejaume.github.io/FUNSD/dataset.zip"


def download_and_extract_funsd(target_dir: str = "data/benchmarks/funsd") -> str:
    os.makedirs(target_dir, exist_ok=True)
    zip_path = os.path.join(target_dir, "dataset.zip")
    extracted_dir = os.path.join(target_dir, "dataset")

    if not os.path.exists(extracted_dir):
        print(f"Downloading FUNSD benchmark from {FUNSD_URL}...")
        urllib.request.urlretrieve(FUNSD_URL, zip_path)
        print("Download complete. Extracting archive...")
        with zipfile.ZipFile(zip_path, "r") as z:
            z.extractall(target_dir)
        print("FUNSD archive extracted.")

    return extracted_dir


def parse_funsd_to_unified(funsd_dir: str) -> Dict[str, List[Dict[str, Any]]]:
    """
    Parses FUNSD annotations into UnifiedDocument format and generates
    real Document Understanding QA & Grounding samples.
    """
    splits = {"train": "training_data", "val": "testing_data"}
    corpus_by_split = {"train": [], "val": []}

    for split_name, folder_name in splits.items():
        ann_dir = os.path.join(funsd_dir, folder_name, "annotations")
        img_dir = os.path.join(funsd_dir, folder_name, "images")

        if not os.path.exists(ann_dir):
            continue

        for ann_file in os.listdir(ann_dir):
            if not ann_file.endswith(".json"):
                continue

            doc_id = os.path.splitext(ann_file)[0]
            with open(os.path.join(ann_dir, ann_file), "r", encoding="utf-8") as f:
                data = json.load(f)

            img_filename = f"{doc_id}.png"
            img_path = os.path.join(img_dir, img_filename)

            elements: List[DocumentElement] = []
            questions = []
            answers = []

            for item in data.get("form", []):
                item_id = str(item.get("id", len(elements)))
                text = item.get("text", "").strip()
                bbox = item.get("box", [0, 0, 0, 0])
                label = item.get("label", "other").lower()

                # Map FUNSD label to element type
                if label == "header":
                    elem_type = "heading"
                elif label in ("question", "answer"):
                    elem_type = "paragraph"
                else:
                    elem_type = "paragraph"

                elem = DocumentElement(
                    id=f"funsd_{item_id}",
                    type=elem_type,
                    page=0,
                    bbox=[float(c) for c in bbox],
                    text=text,
                    style=ElementStyle(font_size=11, bold=(label == "header")),
                    metadata={"funsd_label": label, "linking": item.get("linking", [])}
                )
                elements.append(elem)

                if label == "question" and text:
                    questions.append((elem.id, text, item.get("linking", [])))
                elif label == "answer" and text:
                    answers.append((elem.id, text))

            # Approximate dimensions for standard US Letter 72 DPI (612x792) or 1000x1000
            max_x = max([el.bbox[2] for el in elements], default=800.0)
            max_y = max([el.bbox[3] for el in elements], default=1000.0)
            page = DocumentPage(
                page_id=0,
                width=max(800.0, max_x + 50.0),
                height=max(1000.0, max_y + 50.0),
                elements=elements,
                image_path=img_path
            )
            unified_doc = UnifiedDocument(
                document_id=f"funsd_{doc_id}",
                pages=[page],
                metadata={"split": split_name, "dataset": "funsd"}
            )

            elem_dict_list = [
                {"id": el.id, "type": el.type, "text": el.text, "bbox": el.bbox}
                for el in elements
            ]

            # Generate real QA understanding tasks from FUNSD linked question-answer pairs!
            ans_lookup = {a[0]: a[1] for a in answers}
            for q_id, q_text, links in questions:
                # Find linked answer
                linked_ans_text = ""
                for link in links:
                    if len(link) == 2:
                        target_ans_id = f"funsd_{link[1]}"
                        if target_ans_id in ans_lookup:
                            linked_ans_text = ans_lookup[target_ans_id]
                            break

                target_elem_index = next((i for i, el in enumerate(elements) if el.id == q_id), 0)

                corpus_by_split[split_name].append({
                    "document_id": unified_doc.document_id,
                    "task_type": "understanding",
                    "page_image": img_path,
                    "instruction": f"Find information for form field: '{q_text}'",
                    "target_id": q_id,
                    "target_index": target_elem_index,
                    "operation": "RETRIEVE_INFO",
                    "property": "answer",
                    "value": linked_ans_text if linked_ans_text else q_text,
                    "answer_text": linked_ans_text,
                    "elements": elem_dict_list
                })

            # Also generate real grounded manipulation tasks on the real form headers/fields
            headers = [el for el in elements if el.type == "heading"]
            for h in headers[:2]:
                h_idx = elements.index(h)
                corpus_by_split[split_name].append({
                    "document_id": unified_doc.document_id,
                    "task_type": "manipulation",
                    "page_image": img_path,
                    "instruction": f"Make the form header '{h.text[:30]}' bold.",
                    "target_id": h.id,
                    "target_index": h_idx,
                    "operation": "SET_STYLE",
                    "property": "bold",
                    "value": True,
                    "answer_text": "",
                    "elements": elem_dict_list
                })

    print(f"FUNSD Parsing Complete: {len(corpus_by_split['train'])} Train pairs, {len(corpus_by_split['val'])} Val pairs.")
    return corpus_by_split


def build_funsd_benchmark_dataset(target_dir: str = "data/benchmarks/funsd") -> Dict[str, Any]:
    funsd_extracted = download_and_extract_funsd(target_dir)
    dataset_splits = parse_funsd_to_unified(os.path.join(target_dir, "dataset"))

    manifest_train = os.path.join(target_dir, "funsd_train.json")
    manifest_val = os.path.join(target_dir, "funsd_val.json")

    with open(manifest_train, "w", encoding="utf-8") as f:
        json.dump(dataset_splits["train"], f, indent=2)

    with open(manifest_val, "w", encoding="utf-8") as f:
        json.dump(dataset_splits["val"], f, indent=2)

    return {
        "train_samples": len(dataset_splits["train"]),
        "val_samples": len(dataset_splits["val"]),
        "train_path": manifest_train,
        "val_path": manifest_val
    }


if __name__ == "__main__":
    build_funsd_benchmark_dataset()
