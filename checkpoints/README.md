# Model Checkpoints Directory

This directory stores deep learning model weights and vocabulary artifacts for the **IntelliDoc** system.

---

## 1. Custom Baseline Model Artifacts
If you are evaluating the from-scratch custom multimodal baseline (~3.9M parameters), place the following files here:
- **`best_model.pt`**: Trained model weights (PyTorch state dict).
- **`tokenizer.json`**: Subword vocabulary JSON.
- **`val_map.json`**: Output class/value label mapping dictionary.

*(If these files are missing, the system will automatically notify you in the React dashboard, and you can switch seamlessly to the Dual-Layer Foundation VLM engine).*

---

## 2. Foundation VLM Weights (Qwen2-VL-2B)
By default, the backend loads `Qwen/Qwen2-VL-2B-Instruct` automatically via Hugging Face.

If you download the weights manually into a local directory:
1. Place the model directory anywhere on disk, e.g.:
   ```
   checkpoints/qwen2-vl-2b-instruct/
   ```
2. Configure `.env` (or set environment variable):
   ```bash
   VLM_MODEL_PATH=./checkpoints/qwen2-vl-2b-instruct
   ```
3. The system will load directly from your local folder with zero internet dependency!

---

## 3. Custom Checkpoint Location
To point the application to an entirely different checkpoint folder (e.g., on an external NVMe or custom drive), specify in `.env`:
```bash
CHECKPOINT_DIR=/path/to/my/checkpoints
```
The FastAPI backend and React frontend will automatically resolve and report the new path.
