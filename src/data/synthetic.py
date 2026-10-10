"""
Synthetic Multimodal Document & Task Generator
Generates paired documents with:
1. Grounded Manipulation Tasks (natural language instruction -> target element -> structured action)
2. Document Understanding Tasks (natural language question -> evidence element retrieval -> extractive answer)
3. Rendered page images.
"""

import os
import json
import random
from typing import List, Dict, Any, Tuple
from PIL import Image

from schema import UnifiedDocument, DocumentPage, DocumentElement, ElementStyle
from render import render_canvas


TEMPLATES = [
    {
        "type": "financial_report",
        "title": "Quarterly Financial Performance Report",
        "sections": [
            ("Executive Summary", "The company demonstrated resilient fiscal expansion across all core business sectors."),
            ("Revenue by Geography", "Regional operations reported double-digit growth led by the Asia-Pacific division."),
            ("Operating Expenses", "Administrative and research costs remained aligned with projected budget guidance.")
        ],
        "table": {
            "title": "Consolidated Revenue Breakdown",
            "headers": ["Segment", "Q1 Revenue", "Q2 Revenue", "YoY Growth"],
            "rows": [
                ["Enterprise Software", "$45.2M", "$52.8M", "+16.8%"],
                ["Cloud Infrastructure", "$88.4M", "$104.1M", "+17.7%"],
                ["Consulting Services", "$21.0M", "$22.5M", "+7.1%"]
            ]
        },
        "qa_pairs": [
            ("What was the Q1 revenue for Cloud Infrastructure?", "table_row_1", "$88.4M"),
            ("What was the Q2 revenue for Enterprise Software?", "table_row_0", "$52.8M"),
            ("What was the YoY growth for Consulting Services?", "table_row_2", "+7.1%"),
            ("Which division led regional operations growth?", "para_sec_1", "Asia-Pacific division"),
            ("What is the status of operating expenses?", "para_sec_2", "aligned with projected budget guidance")
        ]
    },
    {
        "type": "project_proposal",
        "title": "AI Autonomous Agent Architecture Proposal",
        "sections": [
            ("Project Abstract", "This research specification introduces a from-scratch unified multimodal document intelligence framework."),
            ("System Architecture", "The architecture decouples modality-specific feature extractors from a centralized cross-modal fusion transformer."),
            ("Evaluation Strategy", "Scientific validation relies on rigorous baseline comparisons and ablation studies.")
        ],
        "table": {
            "title": "Milestone Delivery Timeline",
            "headers": ["Milestone", "Scope", "Timeline", "Status"],
            "rows": [
                ["Phase 1", "Parser & Tokenizer", "Week 1-2", "Complete"],
                ["Phase 2", "Synthetic Generation", "Week 3", "In Progress"],
                ["Phase 3", "Joint Multimodal Training", "Week 4-6", "Pending"]
            ]
        },
        "qa_pairs": [
            ("What is the status of Phase 1?", "table_row_0", "Complete"),
            ("What is the timeline for Phase 2?", "table_row_1", "Week 3"),
            ("What is the scope of Phase 3?", "table_row_2", "Joint Multimodal Training"),
            ("What does the research specification introduce?", "para_sec_0", "from-scratch unified multimodal document intelligence framework"),
            ("How does the architecture decouple components?", "para_sec_1", "decouples modality-specific feature extractors from a centralized cross-modal fusion transformer")
        ]
    },
    {
        "type": "commercial_invoice",
        "title": "Commercial Services Tax Invoice",
        "sections": [
            ("Client Billing Details", "Billed to Acme Global Enterprises, 500 Technology Way, Silicon Valley, CA."),
            ("Payment Terms", "Net 30 days payable via corporate wire transfer upon electronic receipt of invoice."),
            ("Authorized Signatory", "Certified by Financial Operations Officer.")
        ],
        "table": {
            "title": "Itemized Professional Services",
            "headers": ["Item Description", "Hours", "Rate", "Amount"],
            "rows": [
                ["Neural Architecture Design", "40", "$150/hr", "$6,000"],
                ["CUDA Kernel Optimization", "25", "$175/hr", "$4,375"],
                ["Dataset Engineering & Parsing", "30", "$120/hr", "$3,600"]
            ]
        },
        "qa_pairs": [
            ("What are the payment terms?", "para_sec_1", "Net 30 days payable via corporate wire transfer"),
            ("Who is this invoice billed to?", "para_sec_0", "Acme Global Enterprises"),
            ("Who authorized this commercial invoice?", "para_sec_2", "Financial Operations Officer"),
            ("What is the hourly rate for CUDA Kernel Optimization?", "table_row_1", "$175/hr"),
            ("What is the total amount for Neural Architecture Design?", "table_row_0", "$6,000")
        ]
    }
]

INSTRUCTION_TEMPLATES = [
    ("Make the '{text}' {elem_type} bold.", "SET_STYLE", "bold", True),
    ("Apply bold formatting to the '{text}' {elem_type}.", "SET_STYLE", "bold", True),
    ("Bold the '{text}'.", "SET_STYLE", "bold", True),
    ("Set the font size of the '{text}' {elem_type} to {size} pt.", "SET_STYLE", "font_size", "{size}"),
    ("Change '{text}' font size to {size}.", "SET_STYLE", "font_size", "{size}"),
    ("Center align the '{text}' {elem_type}.", "SET_STYLE", "alignment", "center"),
    ("Align the '{text}' to the center.", "SET_STYLE", "alignment", "center"),
    ("Set alignment of '{text}' {elem_type} to right.", "SET_STYLE", "alignment", "right"),
    ("Italicize the '{text}' {elem_type}.", "SET_STYLE", "italic", True),
    ("Highlight the '{text}' {elem_type}.", "HIGHLIGHT_ELEMENT", "color", "#FFD700")
]


def generate_document_sample(doc_idx: int, output_dir: str) -> Tuple[UnifiedDocument, str, List[Dict[str, Any]]]:
    template = random.choice(TEMPLATES)
    doc_id = f"doc_{doc_idx:05d}"
    page_w, page_h = 800.0, 1000.0
    elements: List[DocumentElement] = []
    curr_y = 50.0

    # 1. Main Title
    title_elem = DocumentElement(
        id="heading_title",
        type="heading",
        page=0,
        bbox=[60.0, curr_y, 740.0, curr_y + 40.0],
        text=template["title"],
        style=ElementStyle(font_size=20, bold=True, alignment="center")
    )
    elements.append(title_elem)
    curr_y += 60.0

    # 2. Sections
    for sec_idx, (sec_head, sec_body) in enumerate(template["sections"]):
        h_elem = DocumentElement(
            id=f"heading_sec_{sec_idx}",
            type="heading",
            page=0,
            bbox=[60.0, curr_y, 500.0, curr_y + 25.0],
            text=sec_head,
            style=ElementStyle(font_size=14, bold=True, alignment="left")
        )
        elements.append(h_elem)
        curr_y += 32.0

        p_elem = DocumentElement(
            id=f"para_sec_{sec_idx}",
            type="paragraph",
            page=0,
            bbox=[60.0, curr_y, 740.0, curr_y + 45.0],
            text=sec_body,
            style=ElementStyle(font_size=11, bold=False, alignment="left")
        )
        elements.append(p_elem)
        curr_y += 55.0

    # 3. Table
    tbl_info = template["table"]
    tbl_title = DocumentElement(
        id="heading_table",
        type="heading",
        page=0,
        bbox=[60.0, curr_y, 500.0, curr_y + 25.0],
        text=tbl_info["title"],
        style=ElementStyle(font_size=13, bold=True, alignment="left")
    )
    elements.append(tbl_title)
    curr_y += 32.0

    for r_idx, row_cells in enumerate(tbl_info["rows"]):
        row_text = " | ".join(row_cells)
        row_elem = DocumentElement(
            id=f"table_row_{r_idx}",
            type="table_row",
            page=0,
            bbox=[60.0, curr_y, 740.0, curr_y + 24.0],
            text=row_text,
            style=ElementStyle(font_size=10, bold=False)
        )
        elements.append(row_elem)
        curr_y += 28.0

    page = DocumentPage(page_id=0, width=page_w, height=page_h, elements=elements)
    doc = UnifiedDocument(document_id=doc_id, pages=[page], metadata={"domain": template["type"]})

    # Render image using canvas renderer
    img_dir = os.path.join(output_dir, "images")
    os.makedirs(img_dir, exist_ok=True)
    img_filename = f"{doc_id}_page_0.png"
    img_path = os.path.join(img_dir, img_filename)
    canvas_img = render_canvas(doc, page_id=0)
    canvas_img.save(img_path)

    samples = []
    elem_dict_list = [
        {"id": el.id, "type": el.type, "text": el.text, "bbox": el.bbox}
        for el in elements
    ]

    # Grounded Manipulation Pair
    candidates = [el for el in elements if el.type in ("heading", "table_row")]
    if candidates:
        target = random.choice(candidates)
        template_tuple = random.choice(INSTRUCTION_TEMPLATES)
        text_snippet = target.text[:28].strip()
        size_choice = random.choice([14, 16, 18, 20, 24])

        inst_text = template_tuple[0].format(
            text=text_snippet,
            elem_type=target.type.replace("_", " "),
            size=size_choice
        )
        op = template_tuple[1]
        prop = template_tuple[2]
        val = template_tuple[3]
        if val == "{size}":
            val = size_choice

        samples.append({
            "document_id": doc_id,
            "task_type": "manipulation",
            "page_image": img_filename,
            "instruction": inst_text,
            "target_id": target.id,
            "target_index": elements.index(target),
            "operation": op,
            "property": prop,
            "value": val,
            "answer_text": "",
            "elements": elem_dict_list
        })

    # Document Understanding Pair
    if "qa_pairs" in template and template["qa_pairs"]:
        qa = random.choice(template["qa_pairs"])
        q_text, target_id, expected_ans = qa
        matching = [el for el in elements if el.id == target_id]
        if matching:
            target_el = matching[0]
            samples.append({
                "document_id": doc_id,
                "task_type": "understanding",
                "page_image": img_filename,
                "instruction": q_text,
                "target_id": target_el.id,
                "target_index": elements.index(target_el),
                "operation": "RETRIEVE_INFO",
                "property": "answer",
                "value": expected_ans,
                "answer_text": expected_ans,
                "elements": elem_dict_list
            })

    return doc, img_path, samples


def build_synthetic_corpus(num_documents: int = 500, output_dir: str = "data/corpus") -> Dict[str, Any]:
    os.makedirs(output_dir, exist_ok=True)
    all_samples = []

    print(f"Synthesizing {num_documents} multimodal documents with dual Understanding/Manipulation tasks...")
    for i in range(num_documents):
        doc, img_path, samples = generate_document_sample(i, output_dir)
        all_samples.extend(samples)

    random.shuffle(all_samples)
    split_point = int(len(all_samples) * 0.8)
    train_samples = all_samples[:split_point]
    val_samples = all_samples[split_point:]

    train_path = os.path.join(output_dir, "train.json")
    val_path = os.path.join(output_dir, "val.json")

    with open(train_path, "w") as f:
        json.dump(train_samples, f, indent=2)

    with open(val_path, "w") as f:
        json.dump(val_samples, f, indent=2)

    print(f"Data Generation Complete: {len(train_samples)} Train, {len(val_samples)} Validation.")
    return {
        "train_samples": len(train_samples),
        "val_samples": len(val_samples),
        "train_manifest": train_path,
        "val_manifest": val_path
    }
