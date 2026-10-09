---
title: "PeopleLens: Consent-Based Face Re-Identification"
category: "software"
order: 3
date: "2026-09-03"
tags: ["Computer Vision", "FaceNet", "Roboflow", "FastAPI", "SQLite", "PyTorch"]
summary: "A consent-based face-memory prototype: capture a photo on your phone, detect faces, embed them with FaceNet, and match them locally against people who chose to enroll, returning 'unknown' below a confidence threshold."
github: https://github.com/naitikg2305/FaceDetect
---

# PeopleLens

## What it is

PeopleLens is a prototype for one specific problem: remembering who someone is and what you talked about. You enroll a person **with their consent**, along with a few notes. Later, a photo from your phone's browser can bring up their name and notes. If the match isn't confident, it says `unknown` instead of guessing.

It's a prototype, not a production biometric system. The README sets clear limits on use: consent only, no surveillance, and nothing involving employment, housing, credit, healthcare, policing or other high-impact decisions.

## How it works

```text
Browser camera / upload
        |
        v
FastAPI service
        |
        +--> Roboflow face detector (optional) or local MTCNN --> bounding boxes
        +--> FaceNet embedding model --> normalized vectors
        +--> cosine similarity + "unknown" threshold
        +--> SQLite profile metadata + embeddings
```

1. **Capture** a photo from a browser webcam or upload. It works from a phone on the same network.
2. **Detect** faces with **Roboflow Inference** when an API key is set. Otherwise it falls back to a local **MTCNN** detector.
3. **Embed** each face with **FaceNet** (`facenet-pytorch`) into a normalized vector.
4. **Match** with cosine similarity against enrolled profiles in **SQLite**.
5. **Return** a name and notes only when the score clears an explicit threshold (default `0.72`). Otherwise the result is `unknown`.

**Identity matching is always local.** Embeddings and profiles never leave the machine. Roboflow, if enabled, only does face detection.

## What I built
- FastAPI endpoints: `POST /api/enroll`, `POST /api/identify`, `GET /api/profiles` (metadata only, never embeddings) and `DELETE /api/profiles/{id}`.
- A pluggable detector (cloud Roboflow or local MTCNN), configured with environment variables (`ROBOFLOW_API_KEY`, `MATCH_THRESHOLD`, `DATABASE_PATH`). Secrets live in a gitignored `.env`.
- A single-page mobile-friendly web client.
- pytest tests for enrollment, cosine matching and unknown-person rejection that run without cloud credentials.

## What I learned
- **Rejection matters more than recognition.** Unknown-person rejection with an explicit threshold is the core design decision, not an afterthought.
- **Separate detection from identity.** Using a cloud detector is fine, but keeping embeddings and matching local is what makes the privacy story hold up.
- **Privacy is part of the design.** Consent, deletion endpoints and listing profiles without exposing embeddings shape the API itself.

## What's next
I haven't run a formal evaluation yet, so I'm not reporting accuracy numbers. Before calling this more than a prototype, the plan is to collect a consented evaluation set and measure:
- identification accuracy at several thresholds
- false-accept and false-reject rates
- unknown-person rejection
- phone-to-server latency
- robustness to lighting, pose, distance and occlusion

**Stack:** Python, FastAPI, Uvicorn, PyTorch, facenet-pytorch (FaceNet + MTCNN), Roboflow Inference SDK, NumPy, Pillow, SQLite, pydantic-settings, pytest
