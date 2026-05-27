#!/bin/bash

# PhotoQC - Deploy Lambda Functions
# Packages the Python QC engine and uploads to AWS Lambda

set -e

echo "=================================="
echo "PhotoQC Lambda Deployment"
echo "=================================="
echo ""

AWS_REGION=${AWS_REGION:-us-east-1}

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 not installed"
    exit 1
fi

# Check pip
if ! command -v pip3 &> /dev/null; then
    echo "ERROR: pip3 not installed"
    exit 1
fi

cd lambda/qc_engine

echo "Packaging QC engine..."
echo "This may take a few minutes to install OpenCV dependencies..."
echo ""

# Clean previous build
rm -rf build package.zip

# Install dependencies into build directory
mkdir -p build
pip3 install -r requirements.txt -t build/ --quiet --platform manylinux2014_x86_64 --only-binary=:all: --python-version 3.12

# rawpy pulls numpy as a transitive dep, but the existing OpenCV
# Lambda layer already ships numpy. Shipping it again puts us over the
# 250MB function-plus-layers limit. Strip numpy from the function
# package; LibRaw native bindings inside rawpy.libs stay (those are
# specific to RAW decode and not in the layer).
rm -rf build/numpy build/numpy.libs build/numpy-*.dist-info

# Copy source files
cp -r *.py build/
cp -r checks build/
cp -r fixes build/
cp -r hdr build/

# Create zip
cd build
zip -rq ../package.zip .
cd ..

echo "Package size: $(du -h package.zip | cut -f1)"

# Check if Lambda function exists
if aws lambda get-function --function-name photoqc-engine --region $AWS_REGION &> /dev/null; then
    echo "Updating photoqc-engine Lambda..."
    aws lambda update-function-code \
        --function-name photoqc-engine \
        --zip-file fileb://package.zip \
        --region $AWS_REGION \
        --no-cli-pager > /dev/null
else
    echo "ERROR: photoqc-engine function not found. Run deploy-infrastructure.sh first."
    exit 1
fi

# Update environment variables from .env.local. Wait for the
# preceding update-function-code to settle first — AWS rejects
# update-function-configuration while a code update is "InProgress"
# with ResourceConflictException, which would kill the script under
# set -e and skip the profile-learner deploy. The wait + the trailing
# `|| true` make this resilient even when AWS is slow to settle.
aws lambda wait function-updated --function-name photoqc-engine --region $AWS_REGION || true

if [ -f ../../.env.local ]; then
    echo "Updating Lambda environment variables..."

    DATABASE_URL=$(grep DATABASE_URL ../../.env.local | cut -d '=' -f2-)
    AWS_S3_BUCKET=$(grep AWS_S3_BUCKET ../../.env.local | cut -d '=' -f2-)
    ANTHROPIC_API_KEY=$(grep ANTHROPIC_API_KEY ../../.env.local | cut -d '=' -f2-)
    REPLICATE_API_TOKEN=$(grep REPLICATE_API_TOKEN ../../.env.local | cut -d '=' -f2-)

    aws lambda update-function-configuration \
        --function-name photoqc-engine \
        --environment "Variables={DATABASE_URL=$DATABASE_URL,AWS_S3_BUCKET=$AWS_S3_BUCKET,ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY,REPLICATE_API_TOKEN=$REPLICATE_API_TOKEN}" \
        --region $AWS_REGION \
        --no-cli-pager > /dev/null || echo "Note: env var update skipped (still in progress)"
fi

# Make sure the engine settles before the next code update target.
aws lambda wait function-updated --function-name photoqc-engine --region $AWS_REGION || true

# Bump engine memory + timeout for the HDR bracket-merge path. Sony A7IV
# 33MP × 5 brackets demosaiced to uint8 RGB sits around 2GB resident
# during Mertens fusion; 4096 MB gives comfortable headroom for that
# and a small efficiency win on standard single-photo jobs too. 360s
# timeout covers the worst-case HDR scene (decode + align + fuse +
# Claude Vision + smart_editor). Idempotent — safe to re-run.
echo ""
echo "Ensuring engine memory/timeout sized for HDR merge..."
aws lambda update-function-configuration \
    --function-name photoqc-engine \
    --memory-size 4096 \
    --timeout 360 \
    --region $AWS_REGION \
    --no-cli-pager > /dev/null 2>&1 || echo "Note: engine config update skipped"

# Deploy profile learner function. Needs the same OpenCV layer and
# memory budget as the main engine — without them the Lambda dies with
# either ImportModuleError (no cv2) or OutOfMemory on real reference
# sets. Without this config the /api/profiles/[id]/learn flow looks
# like it's working but never writes any results back.
echo ""
echo "Deploying photoqc-profile-learner..."
aws lambda update-function-code \
    --function-name photoqc-profile-learner \
    --zip-file fileb://package.zip \
    --region $AWS_REGION \
    --no-cli-pager > /dev/null || echo "Note: profile-learner function not found (optional)"

# Ensure memory + layer config matches what the function actually needs.
# Idempotent — safe to re-run on every deploy.
ENGINE_LAYERS=$(aws lambda get-function-configuration \
    --function-name photoqc-engine \
    --region $AWS_REGION \
    --query 'Layers[].Arn' \
    --output text 2>/dev/null || echo "")
if [ -n "$ENGINE_LAYERS" ]; then
    # 6144 MB is the floor for high-res reference sets (50+ photos at
    # 12-24 MP). 3008 OOM'd on real customer profiles. Don't drop this
    # without testing against the largest known reference set.
    aws lambda update-function-configuration \
        --function-name photoqc-profile-learner \
        --layers $ENGINE_LAYERS \
        --memory-size 6144 \
        --timeout 300 \
        --region $AWS_REGION \
        --no-cli-pager > /dev/null 2>&1 || echo "Note: profile-learner config update skipped"
fi

# Cleanup
rm -rf build

cd ../..

echo ""
echo "Lambda functions deployed successfully."
echo ""
echo "Test with:"
echo "  aws logs tail /aws/lambda/photoqc-engine --follow --region $AWS_REGION"
