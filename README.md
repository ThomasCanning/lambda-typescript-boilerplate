# Lambda TypeScript Server

Serverless TypeScript Lambda API built on AWS serverless infrastructure.

## Quick Start

1. Install dependencies: `npm install`
2. Configure: `cp config.mk.example config.mk` and edit settings
3. Deploy: `make deploy`

## Prerequisites

- AWS SAM CLI, Node.js 22+, Docker, Terraform, AWS CLI
- DNS provider access

## Testing

```bash
npm test
```

## Documentation

- [Deployment](docs/DEPLOYMENT.md) - Deployment instructions
- [Development](docs/DEVELOPMENT.md) - Local development and testing
