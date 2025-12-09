# OneClickWebsite Monorepo

Monorepo containing both frontend and backend for OneClickWebsite.

## Project Structure

- `frontend/` - Frontend static files (HTML, CSS, JS) served from S3 via CloudFront
- `src/` - Backend Lambda functions (TypeScript)
- `infrastructure/` - Terraform configuration for AWS infrastructure

## Quick Start

1. Install dependencies: `npm install`
2. Configure: `cp config.mk.example config.mk` and edit settings
3. Deploy dev stack: `make dev`
4. Deploy production: `make prod`
5. Run locally: `make local`

## Prerequisites

- AWS SAM CLI, Node.js 22+, Docker, Terraform, AWS CLI
- DNS provider access

## Local Development

The project uses a **dev stack** approach for local development:

1. **One-time setup**: Deploy a dev stack to AWS

   ```bash
   make dev
   ```

2. **Daily development**: Run API locally (connects to dev stack)

   ```bash
   make local
   ```

   - API runs at `http://localhost:3001`
   - Uses dev stack's SQS queue and DynamoDB table
   - Worker Lambda processes jobs in AWS (dev stack)
   - Code changes to API handlers auto-reload (SAM hot-reload)

3. **Testing worker changes**: Deploy to dev stack
   ```bash
   make dev
   ```

**Why dev stack instead of LocalStack?**

- Faster startup (~5s vs ~30s)
- No Docker mount issues
- Real AWS services (more accurate testing)
- Isolated from production

## Frontend

The frontend is a simple static site served from an S3 bucket via CloudFront. Edit files in `frontend/` and run `make deploy` to update.

## Backend

Serverless TypeScript Lambda API built on AWS serverless infrastructure.

## Testing

```bash
npm test
```

## Documentation

- [Deployment](docs/DEPLOYMENT.md) - Deployment instructions
- [Development](docs/DEVELOPMENT.md) - Local development and testing
