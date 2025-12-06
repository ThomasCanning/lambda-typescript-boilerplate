# Deployment

## Setup

1. Configure settings:

```bash
cp config.mk.example config.mk
# Edit: REGION, ROOT_DOMAIN, ALLOWED_ORIGINS

cp .env.example .env
# Edit: ADMIN_USERNAME, ADMIN_PASSWORD
```

2. Configure AWS credentials:

```bash
aws configure sso
aws sso login
```

3. Deploy:

```bash
source .env
make deploy
```

4. Create DNS records from `infrastructure/dns-records.txt` and wait for propagation.

5. Complete deployment: `make deploy`

## Cleanup

```bash
cd infrastructure
terraform destroy -var="region=<region>" -var="root_domain_name=<domain>" -var="sam_http_api_id=dummy"
sam delete --stack-name lambda-typescript-boilerplate
```
