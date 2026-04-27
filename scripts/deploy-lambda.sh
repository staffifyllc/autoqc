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

# Copy source files
cp -r *.py build/
cp -r checks build/
cp -r fixes build/

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

# Update environment variables from .env.local
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
        --no-cli-pager > /dev/null
fi

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
    aws lambda update-function-configuration \
        --function-name photoqc-profile-learner \
        --layers $ENGINE_LAYERS \
        --memory-size 3008 \
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
