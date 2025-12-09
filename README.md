# OneClickWebsite Backend

**Auth**
Run `aws sso login` before starting.

**Development**

- `make dev`: Deploys to your personal stack (e.g. `oneclickwebsite-dev-name`), writes API URL to frontend config, and watches for changes.
- `make logs`: Streams logs from your dev stack.

**Production**

- `make prod`: Full deployment to `oneclickwebsite-prod` (Backend + Terraform + Frontend).
- `make logs STAGE=prod`: Streams logs from production.

**Setup**

1. Copy `dev.mk.example` to `dev.mk` and set `DEV_NAME`.
2. Ensure `.env` has secrets (`ADMIN_PASSWORD`, etc.) and config.mk has values.

**Requirements**: Node 22+, AWS CLI, SAM CLI, Terraform.
