# Google Cloud Build Deployment Guide

This guide explains how to deploy the MemoMind application to Google Cloud Platform using Cloud Build and Cloud Run.

## Prerequisites

1. **Google Cloud Project**: You need an active GCP project
2. **gcloud CLI**: Install and configure the [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
3. **APIs Enabled**: Enable the following APIs in your GCP project:
   - Cloud Build API
   - Cloud Run API
   - Container Registry API
   - Secret Manager API

## Setup Steps

### 1. Enable Required APIs

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### 2. Create Secrets in Secret Manager

Store your database credentials as secrets:

```bash
# Create secrets for database configuration
echo -n "zhuqing" | gcloud secrets create DB_USER --data-file=-
echo -n "47.245.101.60" | gcloud secrets create DB_HOST --data-file=-
echo -n "memomind" | gcloud secrets create DB_NAME --data-file=-
echo -n "qwerty123" | gcloud secrets create DB_PASSWORD --data-file=-
echo -n "5432" | gcloud secrets create DB_PORT --data-file=-
```

### 3. Grant Cloud Build Service Account Access to Secrets

```bash
# Get your project number
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

# Grant Secret Manager Secret Accessor role
gcloud secrets add-iam-policy-binding DB_USER \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding DB_HOST \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding DB_NAME \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding DB_PASSWORD \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding DB_PORT \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 4. Grant Cloud Build Service Account Cloud Run Admin Role

```bash
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud iam service-accounts add-iam-policy-binding \
  ${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

## Deployment Methods

### Method 1: Manual Deployment via gcloud

```bash
# Submit build to Cloud Build
gcloud builds submit --config cloudbuild.yaml .
```

### Method 2: Automatic Deployment via GitHub Integration

1. **Connect Repository to Cloud Build**:
   ```bash
   # Go to Cloud Build Triggers page
   # https://console.cloud.google.com/cloud-build/triggers
   ```

2. **Create a Trigger**:
   - Click "Create Trigger"
   - Name: `memomind-deploy`
   - Event: Push to a branch
   - Source: Connect your GitHub repository
   - Branch: `^main$` (or your default branch)
   - Configuration: Cloud Build configuration file
   - Cloud Build configuration file location: `cloudbuild.yaml`

3. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Deploy to Cloud Run"
   git push origin main
   ```

### Method 3: Deploy from Local Machine

```bash
# Build and deploy in one command
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_REGION=us-central1
```

## Build Process Overview

The `cloudbuild.yaml` file defines the following steps:

1. **Install Dependencies**: Runs `npm install`
2. **Build Application**: Runs `npm run build`
3. **Build Docker Image**: Creates a Docker image with the built application
4. **Push to Container Registry**: Uploads the image to GCR
5. **Deploy to Cloud Run**: Deploys the image to Cloud Run with environment variables

## Configuration Options

### Change Region

Edit `cloudbuild.yaml` and modify the `--region` parameter:

```yaml
- '--region'
- 'asia-east1'  # Change to your preferred region
```

### Adjust Resources

Modify the Cloud Run deployment step in `cloudbuild.yaml`:

```yaml
- '--memory'
- '512Mi'
- '--cpu'
- '1'
- '--max-instances'
- '10'
```

### Custom Domain

After deployment, you can map a custom domain:

```bash
gcloud run domain-mappings create \
  --service memomind \
  --domain your-domain.com \
  --region us-central1
```

## Monitoring and Logs

### View Build Logs

```bash
# List recent builds
gcloud builds list --limit=5

# View specific build logs
gcloud builds log <BUILD_ID>
```

### View Application Logs

```bash
# Stream logs from Cloud Run
gcloud run services logs tail memomind --region=us-central1
```

### Access Cloud Run Service

```bash
# Get service URL
gcloud run services describe memomind \
  --region=us-central1 \
  --format='value(status.url)'
```

## Troubleshooting

### Build Fails

1. Check build logs:
   ```bash
   gcloud builds list --limit=1
   gcloud builds log <BUILD_ID>
   ```

2. Verify secrets are created:
   ```bash
   gcloud secrets list
   ```

3. Check IAM permissions:
   ```bash
   gcloud projects get-iam-policy $(gcloud config get-value project)
   ```

### Database Connection Issues

1. Ensure your Cloud Run service can access the database
2. Check if the database allows connections from Cloud Run IPs
3. Verify secret values:
   ```bash
   gcloud secrets versions access latest --secret=DB_HOST
   ```

### Application Errors

1. Check Cloud Run logs:
   ```bash
   gcloud run services logs read memomind --region=us-central1 --limit=50
   ```

2. Verify environment variables:
   ```bash
   gcloud run services describe memomind --region=us-central1
   ```

## Cost Optimization

1. **Set minimum instances to 0** for development:
   ```yaml
   - '--min-instances'
   - '0'
   ```

2. **Use smaller machine types** for Cloud Build:
   ```yaml
   options:
     machineType: 'E2_HIGHCPU_8'
   ```

3. **Enable request timeout**:
   ```yaml
   - '--timeout'
   - '300'
   ```

## Security Best Practices

1. ✅ Use Secret Manager for sensitive data
2. ✅ Enable HTTPS only (Cloud Run default)
3. ✅ Use least privilege IAM roles
4. ✅ Regularly update dependencies
5. ✅ Enable Cloud Armor for DDoS protection (optional)

## Rollback

If you need to rollback to a previous version:

```bash
# List revisions
gcloud run revisions list --service=memomind --region=us-central1

# Rollback to specific revision
gcloud run services update-traffic memomind \
  --to-revisions=<REVISION_NAME>=100 \
  --region=us-central1
```

## Clean Up

To delete all resources:

```bash
# Delete Cloud Run service
gcloud run services delete memomind --region=us-central1

# Delete container images
gcloud container images delete gcr.io/$(gcloud config get-value project)/memomind --quiet

# Delete secrets
gcloud secrets delete DB_USER --quiet
gcloud secrets delete DB_HOST --quiet
gcloud secrets delete DB_NAME --quiet
gcloud secrets delete DB_PASSWORD --quiet
gcloud secrets delete DB_PORT --quiet
```

## Additional Resources

- [Cloud Build Documentation](https://cloud.google.com/build/docs)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
