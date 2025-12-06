# OneClickWebsite Monorepo

Monorepo containing both frontend and backend for OneClickWebsite.

## Project Structure

- `frontend/` - Frontend static files (HTML, CSS, JS) served from S3 via CloudFront
- `src/` - Backend Lambda functions (TypeScript)
- `infrastructure/` - Terraform configuration for AWS infrastructure

## Quick Start

1. Install dependencies: `npm install`
2. Configure: `cp config.mk.example config.mk` and edit settings
3. Deploy: `make deploy` (deploys both frontend and backend)

## Prerequisites

- AWS SAM CLI, Node.js 22+, Docker, Terraform, AWS CLI
- DNS provider access

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
