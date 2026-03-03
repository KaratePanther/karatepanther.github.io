import io
import os
from datetime import datetime

import requests
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from huggingface_hub import InferenceClient
from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageOps

app = Flask(__name__)
CORS(app)

HF_TOKEN = os.getenv("HF_TOKEN", "").strip()
HF_PROVIDER = os.getenv("HF_PROVIDER", "auto")
EDIT_MODEL = os.getenv("EDIT_MODEL", "Qwen/Qwen-Image-Edit-2509")
EDIT_TIMEOUT_SEC = int(os.getenv("EDIT_TIMEOUT_SEC", "180"))
EDIT_STEPS = int(os.getenv("EDIT_STEPS", "30"))
EDIT_GUIDANCE = float(os.getenv("EDIT_GUIDANCE", "4.0"))
EDIT_MAX_EDGE = int(os.getenv("EDIT_MAX_EDGE", "1280"))
RMBG_MODEL = os.getenv("RMBG_MODEL", "briaai/RMBG-1.4")
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "10"))

DEFAULT_PROMPT = (
    "Edit this product photo into a premium e-commerce studio image of the same Murano glass piece. "
    "Do not change the object: keep identical shape, proportions, color tones, pattern details, transparency, and texture. "
    "Background: clean seamless light-grey studio backdrop. Lighting: professional diffused softbox lighting with realistic reflections. "
    "Shadow/contact: soft natural contact shadow under the piece. Perspective: centered with minimal distortion. "
    "Retouching: remove dust/fingerprints/background noise, keep edges crisp. Color: neutral white balance. "
    "Output: sharp, clean, catalog-ready."
)
DEFAULT_NEGATIVE_PROMPT = (
    "changing colors/patterns, warped geometry, extra decorations, text, watermark, harsh shadows, "
    "blown highlights, plastic look, painterly, CGI look, artifacts around edges"
)


@app.get("/api/health")
def health() -> tuple:
    return jsonify({"ok": True, "timestamp": datetime.utcnow().isoformat() + "Z"}), 200


@app.post("/api/edit-photo")
def edit_photo():
    if "image" not in request.files:
        return jsonify({"error": "Missing file field 'image'"}), 400

    uploaded = request.files["image"]
    payload = uploaded.read()

    if not payload:
        return jsonify({"error": "Uploaded file is empty"}), 400

    size_mb = len(payload) / (1024 * 1024)
    if size_mb > MAX_UPLOAD_MB:
        return jsonify({"error": f"Image too large. Max is {MAX_UPLOAD_MB}MB."}), 400

    prompt = request.form.get("prompt", DEFAULT_PROMPT)

    try:
        src = Image.open(io.BytesIO(payload)).convert("RGBA")
    except Exception:
        return jsonify({"error": "Invalid image format"}), 400

    engine = "qwen-image-edit"
    warn = ""
    try:
        out = run_qwen_image_edit(src, prompt)
    except Exception as edit_exc:
        warn = str(edit_exc)
        engine = "fallback-compositor"
        try:
            cutout = remove_background(src)
            out = compose_studio_image(cutout, prompt)
        except Exception as fallback_exc:
            return jsonify(
                {
                    "error": "Both edit model and fallback pipeline failed",
                    "detail": f"edit={edit_exc}; fallback={fallback_exc}",
                }
            ), 502

    out_io = io.BytesIO()
    out.save(out_io, format="JPEG", quality=95, optimize=True, progressive=True)
    out_io.seek(0)

    response = send_file(
        out_io,
        mimetype="image/jpeg",
        as_attachment=False,
        download_name="studio-result.jpg",
    )
    response.headers["X-Engine"] = engine
    if warn:
        response.headers["X-Engine-Warn"] = warn[:180]
    return response


def run_qwen_image_edit(src: Image.Image, prompt: str) -> Image.Image:
    if not HF_TOKEN:
        raise RuntimeError("HF_TOKEN is missing")

    original_size = src.size
    prepared = resize_for_edit_model(src.convert("RGB"), EDIT_MAX_EDGE)

    try:
        client = InferenceClient(provider=HF_PROVIDER, api_key=HF_TOKEN, timeout=EDIT_TIMEOUT_SEC)
    except TypeError:
        client = InferenceClient(provider=HF_PROVIDER, token=HF_TOKEN, timeout=EDIT_TIMEOUT_SEC)
    result = client.image_to_image(
        image=prepared,
        prompt=prompt or DEFAULT_PROMPT,
        negative_prompt=DEFAULT_NEGATIVE_PROMPT,
        num_inference_steps=EDIT_STEPS,
        guidance_scale=EDIT_GUIDANCE,
        width=prepared.width,
        height=prepared.height,
        model=EDIT_MODEL,
    )

    if not isinstance(result, Image.Image):
        raise RuntimeError("Model returned invalid image output")

    return result.convert("RGB").resize(original_size, Image.Resampling.LANCZOS)


def resize_for_edit_model(image: Image.Image, max_edge: int) -> Image.Image:
    w, h = image.size
    longest = max(w, h)
    if longest <= max_edge:
        return image

    scale = max_edge / float(longest)
    nw = max(64, int(w * scale))
    nh = max(64, int(h * scale))
    return image.resize((nw, nh), Image.Resampling.LANCZOS)


def remove_background(image: Image.Image) -> Image.Image:
    # Graceful fallback: keep the app usable even when HF token/model is unavailable.
    if not HF_TOKEN:
        return fallback_alpha_estimate(image)

    source = io.BytesIO()
    image.save(source, format="PNG")
    source.seek(0)

    url = f"https://router.huggingface.co/hf-inference/models/{RMBG_MODEL}"
    headers = {
        "Authorization": f"Bearer {HF_TOKEN}",
        "Accept": "image/png",
        "Content-Type": "image/png",
    }

    try:
        response = requests.post(url, headers=headers, data=source.getvalue(), timeout=90)
    except requests.RequestException:
        return fallback_alpha_estimate(image)

    if response.status_code >= 400:
        return fallback_alpha_estimate(image)

    result = Image.open(io.BytesIO(response.content)).convert("RGBA")

    # If endpoint returns no alpha, estimate a mask from near-uniform background.
    if "A" not in result.getbands() or ImageStat_alpha_mean(result) > 252:
        result = fallback_alpha_estimate(result)

    return result


def ImageStat_alpha_mean(image: Image.Image) -> float:
    alpha = image.getchannel("A") if "A" in image.getbands() else Image.new("L", image.size, 255)
    hist = alpha.histogram()
    total = sum(hist)
    weighted = sum(v * i for i, v in enumerate(hist))
    return weighted / total if total else 255.0


def fallback_alpha_estimate(image: Image.Image) -> Image.Image:
    rgb = image.convert("RGB")
    bg = Image.new("RGB", rgb.size, rgb.getpixel((0, 0)))
    diff = ImageChops.difference(rgb, bg).convert("L")
    mask = diff.point(lambda v: 255 if v > 14 else 0).filter(ImageFilter.GaussianBlur(2.2))
    out = rgb.convert("RGBA")
    out.putalpha(mask)
    return out


def compose_studio_image(cutout: Image.Image, prompt: str) -> Image.Image:
    width, height = cutout.size

    canvas = Image.new("RGB", (width, height), "#e9eaec")
    bg = make_soft_gradient(width, height)
    canvas = Image.alpha_composite(canvas.convert("RGBA"), bg)

    alpha = cutout.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        raise RuntimeError("Object mask is empty")

    obj = cutout.crop(bbox)
    obj_alpha = obj.getchannel("A")

    max_w = int(width * 0.74)
    max_h = int(height * 0.76)
    scale = min(max_w / obj.width, max_h / obj.height, 1.0)

    new_size = (max(1, int(obj.width * scale)), max(1, int(obj.height * scale)))
    obj = obj.resize(new_size, Image.Resampling.LANCZOS)
    obj_alpha = obj_alpha.resize(new_size, Image.Resampling.LANCZOS)

    x = (width - obj.width) // 2
    y = int(height * 0.86) - obj.height

    shadow = build_contact_shadow(obj_alpha, width, height, x, y)
    scene = Image.alpha_composite(canvas, shadow)

    # Slight local contrast to keep glass highlights natural but clean.
    obj = ImageEnhance.Contrast(obj).enhance(1.02)
    obj = ImageEnhance.Sharpness(obj).enhance(1.12)

    scene.alpha_composite(obj, (x, y))

    # Neutral white balance micro-adjustment.
    final = ImageOps.autocontrast(scene.convert("RGB"), cutoff=0)

    # Prompt is accepted for traceability/extension but not used for destructive edits in MVP.
    _ = prompt

    return final


def make_soft_gradient(width: int, height: int) -> Image.Image:
    layer = Image.new("RGBA", (width, height), (236, 237, 240, 255))

    top = Image.new("RGBA", (width, height), (248, 248, 250, 0))
    top_mask = Image.linear_gradient("L").resize((1, height)).resize((width, height))
    top.putalpha(top_mask.point(lambda v: int(v * 0.23)))

    center = Image.new("RGBA", (width, height), (255, 255, 255, 0))
    radial = Image.radial_gradient("L").resize((width, height))
    center.putalpha(radial.point(lambda v: int((255 - v) * 0.14)))

    merged = Image.alpha_composite(layer, top)
    merged = Image.alpha_composite(merged, center)
    return merged


def build_contact_shadow(mask: Image.Image, width: int, height: int, x: int, y: int) -> Image.Image:
    scene = Image.new("RGBA", (width, height), (0, 0, 0, 0))

    # Compress mask vertically to emulate a soft contact shadow under object.
    shadow_w = max(1, int(mask.width * 0.92))
    shadow_h = max(1, int(mask.height * 0.14))
    shadow_mask = mask.resize((shadow_w, shadow_h), Image.Resampling.BICUBIC)
    shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(max(2, int(mask.width * 0.012))))
    shadow_mask = shadow_mask.point(lambda v: int(v * 0.48))

    shadow = Image.new("RGBA", (shadow_w, shadow_h), (18, 18, 18, 0))
    shadow.putalpha(shadow_mask)

    sx = x + (mask.width - shadow_w) // 2
    sy = y + mask.height - int(shadow_h * 0.25)

    scene.alpha_composite(shadow, (sx, sy))
    return scene


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
