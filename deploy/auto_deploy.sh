#!/usr/bin/env bash
set -euo pipefail

# Auto deploy script
# - Uses predefined names for project, DB, app and domain
# - Prompts for credentials (GitHub/GH CLI must be authenticated or script will offer to create repo)
# - Sets GitHub Actions secrets, builds and pushes Docker image, pushes code to GitHub

# Configuration (names already set)
GITHUB_REPO="" # owner/repo (if empty, will attempt to create a repo in your account)
GIT_REMOTE_URL="" # optional remote URL (git@github.com:owner/repo.git)
IMAGE_NAME="jngempresa/dashboard"
IMAGE_TAG="latest"
VERTRA_API_URL_DEFAULT="https://api.vertracloud.example"
PROJECT_NAME="dashboard"
DB_NAME="dashboard"
APP_NAME="dashboard-app"
DOMAIN_NAME="jngturismos.example"

# Helpers
info(){ echo "[INFO] $*"; }
err(){ echo "[ERROR] $*" >&2; }

# Check required tools
for cmd in git gh docker docker-compose; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    err "Required command not found: $cmd - please install it and re-run this script."
    exit 1
  fi
done

root_dir="$(pwd)"
info "Working directory: $root_dir"

# Ensure git repo
if [ ! -d .git ]; then
  info "No git repository found. Initializing git..."
  git init
  git add -A
  git commit -m "chore: initial commit with deploy automation" || true
fi

# Determine GitHub repo if not provided
if [ -z "$GITHUB_REPO" ]; then
  if gh repo view --json nameWithOwner >/dev/null 2>&1; then
    GITHUB_REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
    info "Detected GitHub repo: $GITHUB_REPO"
  else
    read -rp "Enter GitHub repo name to create/use (owner/repo), e.g. youruser/JNG-EMPRESAA: " GITHUB_REPO
    if [ -z "$GITHUB_REPO" ]; then
      err "GitHub repo not provided. Exiting."
      exit 1
    fi
    info "Creating GitHub repo $GITHUB_REPO..."
    gh repo create "$GITHUB_REPO" --public --source=. --remote=origin --push -y
  fi
fi

# Ensure remote origin set
if ! git remote get-url origin >/dev/null 2>&1; then
  if [ -n "$GIT_REMOTE_URL" ]; then
    git remote add origin "$GIT_REMOTE_URL"
  else
    # derive remote from gh
    remote_url=$(gh repo view "$GITHUB_REPO" --json sshUrl -q .sshUrl)
    git remote add origin "$remote_url"
  fi
fi

# Commit & push
git add -A
if git diff --cached --quiet; then
  info "No changes to commit."
else
  git commit -m "ci: add deploy automation and build config" || true
fi
info "Pushing to origin main..."
git branch -M main || true
git push -u origin main

# Prompt for secrets
read -rp "Docker Hub username: " DOCKERHUB_USERNAME
read -rsp "Docker Hub token/password: " DOCKERHUB_TOKEN
echo
read -rsp "VertraCloud API key: " VERTRA_API_KEY
echo
read -rp "(optional) VertraCloud API URL [${VERTRA_API_URL_DEFAULT}]: " VERTRA_API_URL
VERTRA_API_URL=${VERTRA_API_URL:-$VERTRA_API_URL_DEFAULT}

# Set GitHub Actions secrets
info "Setting GitHub Actions secrets (requires gh authenticated and repo access)..."
info "Setting DOCKERHUB_USERNAME"
echo "$DOCKERHUB_USERNAME" | gh secret set DOCKERHUB_USERNAME --repo "$GITHUB_REPO" -y
info "Setting DOCKERHUB_TOKEN"
echo "$DOCKERHUB_TOKEN" | gh secret set DOCKERHUB_TOKEN --repo "$GITHUB_REPO" -y
info "Setting VERTRA_API_KEY"
echo "$VERTRA_API_KEY" | gh secret set VERTRA_API_KEY --repo "$GITHUB_REPO" -y
info "Setting VERTRA_API_URL"
echo "$VERTRA_API_URL" | gh secret set VERTRA_API_URL --repo "$GITHUB_REPO" -y

# Build and push docker image
info "Building Docker image docker.io/${IMAGE_NAME}:${IMAGE_TAG}"
# Ensure docker login
if ! docker info >/dev/null 2>&1; then
  err "Docker daemon not available. Ensure Docker Desktop is running."
  exit 1
fi

info "Logging into Docker Hub..."
echo "$DOCKERHUB_TOKEN" | docker login --username "$DOCKERHUB_USERNAME" --password-stdin docker.io

docker build -t docker.io/${IMAGE_NAME}:${IMAGE_TAG} .
docker push docker.io/${IMAGE_NAME}:${IMAGE_TAG}

info "Image pushed: docker.io/${IMAGE_NAME}:${IMAGE_TAG}"

info "All set. The GitHub Actions workflow will run on push and attempt to call the VertraCloud API (placeholders)."
info "Watch the workflow runs with: gh run watch --repo $GITHUB_REPO $(gh run list --repo $GITHUB_REPO --workflow=deploy-vertra.yml --limit 1 --json id --jq '.[0].id')"

info "If the workflow cannot complete automatically you may need to copy values from the JSON outputs in the workflow logs and set any remaining environment variables in your VertraCloud project."

info "Done. If you want, run this script on your machine to perform the automated steps."
