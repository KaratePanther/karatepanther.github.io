# Murano Studio Editor (MVP)

Web app for product-photo studio conversion using free/open Hugging Face models.

## What this MVP does

- Upload a photo in browser
- Sends it to backend API
- First tries `Qwen/Qwen-Image-Edit-2509` for full image editing (studio conversion)
- Falls back to `briaai/RMBG-1.4` + local studio compositor if edit model is unavailable/limited
- Returns downloadable JPG

This is tuned for **object preservation first** (shape/color/pattern retention), not aggressive redesign.

## Folder structure

- `studio-editor/frontend` browser UI
- `studio-editor/backend` Flask API + image pipeline

## 1) Run backend

```bash
cd studio-editor/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Set environment variables:

```bash
export HF_TOKEN="hf_..."
export HF_PROVIDER="auto"
export EDIT_MODEL="Qwen/Qwen-Image-Edit-2509"
export EDIT_TIMEOUT_SEC="180"
export EDIT_STEPS="30"
export EDIT_GUIDANCE="4.0"
export EDIT_MAX_EDGE="1280"
export RMBG_MODEL="briaai/RMBG-1.4"
export MAX_UPLOAD_MB="10"
```

Start API:

```bash
python app.py
```

Backend runs on `http://localhost:8000`.

## 2) Run frontend

In another terminal:

```bash
cd studio-editor/frontend
python3 -m http.server 4173
```

Open:

- `http://localhost:4173`

Set API base URL in UI to `http://localhost:8000` and generate.

## Hugging Face limits

Free tiers may queue or rate-limit requests. If the API returns 429/503, retry after a short wait.

The API response includes header `X-Engine`:

- `qwen-image-edit` means full image-edit model path was used
- `fallback-compositor` means fallback path was used

## Next upgrades (recommended)

1. Add image-to-image model stage for relighting polish with very low denoise
2. Add identity-drift check (auto reject/regenerate)
3. Add job queue for burst uploads
