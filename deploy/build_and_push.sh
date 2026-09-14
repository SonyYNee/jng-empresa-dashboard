#!/usr/bin/env bash
set -euo pipefail

# Usage: REGISTRY=docker.io IMAGE_NAME=youruser/dashboard TAG=latest ./build_and_push.sh
# Example: REGISTRY=docker.io IMAGE_NAME=jngempresa/dashboard TAG=latest ./build_and_push.sh

REGISTRY=${REGISTRY:-docker.io}
IMAGE_NAME=${IMAGE_NAME:-youruser/dashboard}
TAG=${TAG:-latest}

FULL_IMAGE="$REGISTRY/$IMAGE_NAME:$TAG"

echo "Building image $FULL_IMAGE..."
docker build -t "$FULL_IMAGE" .

echo "Pushing image $FULL_IMAGE..."
# Make sure you're logged in to the registry (docker login)
docker push "$FULL_IMAGE"

echo "Image pushed: $FULL_IMAGE"
