# OneClickWebsite Backend

**Auth**
Run `aws sso login` before starting.

**Development**

- `make dev`: Deploys to your personal stack (e.g. `oneclickwebsite-dev-name`), writes API URL to frontend config, and watches for changes.
- Logs: [AWS CloudWatch Live Tail](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:live-tail)

**Production**

- `make prod`: Full deployment to `oneclickwebsite-prod` (Backend + Terraform + Frontend).
- Logs: [AWS CloudWatch Live Tail](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:live-tail)

**Setup**

1. Copy `dev.mk.example` to `dev.mk` and set `DEV_NAME`.
2. Ensure `.env` has secrets (`ADMIN_PASSWORD`, etc.) and config.mk has values.

**Requirements**: Node 22+, AWS CLI, SAM CLI, Terraform.
