# VideoEnhance Studio — Production Vercel Deployment

VideoEnhance Studio is a broadcast-grade video enhancement, 4K upscaling, and 120 FPS frame interpolation application built for production deployment on Vercel with support for dedicated GPU workers.

---

## 1. Architectural Highlights

- **Decoupled Architecture**: Lightweight serverless frontend + API on Vercel, decoupled from heavy background GPU rendering (NVIDIA CUDA / Celery / PyTorch).
- **Zero-Latency In-Browser WebGL2 Engine**: High-performance bilateral noise reduction, unsharp masking edge boosts, and Lanczos/bicubic shader scaling for real-time split-screen Before/After comparisons.
- **Fixed WebGL Bug**: Resolved `texParameteri` 3-argument call signature mismatch with comprehensive diagnostic self-test.
- **12-Point QA Validation Gate**: The download button is strictly locked until 12 automated checks pass (demux integrity, resolution, frame rate tolerance, timeline duration parity, audio track preservation, keyframe decode sampling, monotonic PTS, and file truncation checks).
- **Gemini AI Integration**:
  - **4K Image Studio**: High-resolution image generation via `gemini-3-pro-image-preview` with affordances for 1K, 2K, and 4K output.
  - **Colorist & Video Engineering Assistant**: Multi-turn technical guidance using `gemini-3.8-flash` (General), `gemini-4-argon` (Complex Reasoning), and `gemini-3.1-flash-lite` (Fast Tasks).

---

## 2. Quick Local Start

```bash
# Install dependencies
npm install

# Copy environment variables template
cp .env.example .env

# Start development server on http://localhost:3000
npm run dev
```

---

## 3. Production Vercel Deployment Guide

1. Push your repository to GitHub.
2. In the Vercel dashboard, click **Add New... > Project** and import your repository.
3. Verify settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `.`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Configure Environment Variables in Vercel:
   - `GEMINI_API_KEY`: Your Google AI Studio API key (Required for AI Chat & Image Studio)
   - `APP_URL`: Your deployed canonical URL (e.g. `https://my-videoenhance-studio.vercel.app`)
   - `WORKER_URL`: *(Optional)* Dedicated GPU Celery worker endpoint
   - `STORAGE_BUCKET`: *(Optional)* S3 or Cloudflare R2 bucket for signed uploads
5. Click **Deploy**.

---

## 4. Dedicated GPU Worker Setup (Optional for 4K Real-ESRGAN & 120 FPS RIFE)

When deploying to RunPod, AWS EC2 (`g5.xlarge`), Lambda Labs, or Modal:

```bash
# Navigate to worker directory and build Docker container
docker build -t videoenhance-worker ./worker
docker run --gpus all -e REDIS_URL=redis://... videoenhance-worker
```

The worker executes:
- **Real-ESRGAN x4plus / Anime**: Photorealistic 4K super-resolution inference
- **RIFE v4.6**: Optical flow frame interpolation up to 120 FPS
- **FFmpeg / FFprobe**: Container demuxing, fast-start MP4 atom placement, and broadcast validation

---

## 5. Verification & Testing

Run the full TypeScript verification suite:
```bash
npm run lint
npm run build
```
