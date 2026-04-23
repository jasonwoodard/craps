# Deployment Guide

## Architecture

- **Frontend**: React (Vite) → Firebase Hosting (CDN)
- **Backend**: Express (TypeScript) → Cloud Run (`us-central1`)
- **Domain**: `craps.jasonwoodard.com` via IONOS DNS → Firebase
- **Project**: GCP project `jw-craps` under `jasonwoodard.com` org

## Prerequisites
```bash
brew install google-cloud-sdk
npm install -g firebase-tools

gcloud auth login        # use jason@jasonwoodard.com
gcloud config set project jw-craps
firebase login           # use jason@jasonwoodard.com
```

## Deploy Frontend (Firebase Hosting)
```bash
cd web
npm run build
cd ..
firebase deploy --only hosting
```

Live at: https://craps.jasonwoodard.com  
Also at: https://jw-craps.web.app

## Deploy Backend (Cloud Run)
```bash
gcloud run deploy craps-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --max-instances 2
```

> **Windows/PowerShell**: Backslash line continuation doesn't work. Use a single line:
> ```powershell
> gcloud run deploy craps-api --source . --region us-central1 --allow-unauthenticated --max-instances 2
> ```

## Deploy Both
```bash
cd web && npm run build && cd ..
firebase deploy --only hosting
gcloud run deploy craps-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --max-instances 2
```

> **Windows/PowerShell**: Run each command on a single line — no backslash continuation:
> ```powershell
> cd web; npm run build; cd ..
> firebase deploy --only hosting
> gcloud run deploy craps-api --source . --region us-central1 --allow-unauthenticated --max-instances 2
> ```

## Infrastructure Notes

- Firebase Hosting rewrites `/api/**` to Cloud Run (configured in `firebase.json`)
- Cloud Run allows unauthenticated access (`allUsers` invoker) — `--allow-unauthenticated` sets this automatically on deploy
- Billing alert set at $10/month on GCP billing account
- Cloud Run capped at 2 instances max
- **`package-lock.json` must be committed** — if it is in `.gitignore`, Cloud Run builds will fail because `npm ci` requires it

## GCP Resources

| Resource | Name | Location |
|---|---|---|
| GCP Project | `jw-craps` | — |
| Cloud Run service | `craps-api` | `us-central1` |
| Artifact Registry repo | `cloud-run-source-deploy` | `us-central1` |
| Firebase Hosting | `jw-craps` | Global CDN |

## DNS (IONOS)

`craps.jasonwoodard.com` → Firebase-provided A/CNAME records  
Managed at: my.ionos.com → Domains → jasonwoodard.com → DNS
