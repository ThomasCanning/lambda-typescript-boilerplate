# TypeScript Lambda API Makefile
#
# Top-level targets (what you run):
#   - dev              : Deploy to personal dev stack (fast, no lint/test)
#   - prod             : Deploy to production (with lint/test)
#
# Internal helper targets (used by dev/prod; you generally do not run directly):
#   - tf-apply, sam-deploy, set-admin-password, ensure-config

-include config.mk
-include dev.mk
-include .env
export ADMIN_USERNAME
export ADMIN_PASSWORD
export VERTEX_AI_API_KEY
export GOOGLE_VERTEX_PROJECT
export GOOGLE_VERTEX_LOCATION
export GOOGLE_CREDENTIALS_JSON
export APIFY_API_TOKEN

TF_DIR      ?= infrastructure
# Stage: dev or prod (default: dev)
STAGE       ?= dev
LOWER_STAGE := $(shell echo $(STAGE) | tr '[:upper:]' '[:lower:]')

# Derive SAM stack name from samconfig.toml if not provided via env, with stage suffix
# BASE_STACK_NAME is now defined in config.mk
# For dev: append developer name to avoid conflicts
ifeq ($(LOWER_STAGE),dev)
  STACK_NAME  ?= $(BASE_STACK_NAME)-dev-$(DEV_NAME)
else
  STACK_NAME  ?= $(BASE_STACK_NAME)-$(LOWER_STAGE)
endif
GENERATION_TABLE ?= GenerationJobsTable
GENERATION_QUEUE ?= GenerationQueue

.PHONY: tf-apply sam-deploy set-admin-password validate-password validate-dns
.PHONY: deployment-complete generate-outputs
.PHONY: npm-install ensure-config
.PHONY: deploy-frontend dev prod

# Shortcut targets for common workflows
.DEFAULT_GOAL := help

# dev: Deploy to dev stack using sam sync (fast, no lint/test, no password reset)
dev:
	@if [ ! -f dev.mk ]; then \
		echo "Error: dev.mk not found."; \
		echo ""; \
		echo "Create dev.mk with your developer name:"; \
		echo "  cp dev.mk.example dev.mk"; \
		echo "  # Edit dev.mk and set DEV_NAME to your name (e.g., 'john')"; \
		exit 1; \
	fi
	@if [ -z "$(DEV_NAME)" ]; then \
		echo "Error: DEV_NAME not set in dev.mk"; \
		echo ""; \
		echo "Edit dev.mk and set DEV_NAME to your name (e.g., 'john')"; \
		exit 1; \
	fi
	@$(MAKE) _dev-deploy STAGE=dev

# logs: Stream logs from all functions in the stack
logs:
	@echo "🔍 Streaming logs for stack: $(STACK_NAME)..."
	@AWS_REGION=$(REGION) sam logs --stack-name $(STACK_NAME) --tail \
		| grep --line-buffered -v "INIT_START" \
		| grep --line-buffered -v "START RequestId" \
		| grep --line-buffered -v "END RequestId" \
		| grep --line-buffered -v "REPORT RequestId" \
		| grep --line-buffered -v "Unable to load legacy provider" \
		| grep --line-buffered -v "Access logging is disabled" || true

_dev-deploy:
	@echo "   Stack: $(STACK_NAME)"
	@$(MAKE) ensure-config npm-install
	@echo ""
	@# Check if stack exists
	@if aws cloudformation describe-stacks --stack-name $(STACK_NAME) --region $(REGION) >/dev/null 2>&1; then \
		$(MAKE) refresh-dev-env; \
		echo "🚀 Syncing to dev stack (watch mode)..."; \
		AWS_REGION=$(REGION) sam sync --watch --stack-name $(STACK_NAME) --region $(REGION); \
	else \
		echo "🚀 Creating dev stack (first deployment)..."; \
		$(MAKE) sam-deploy; \
		$(MAKE) refresh-dev-env; \
	fi
	@echo ""
	@echo "✅ Dev stack ready!"

refresh-dev-env:
	@echo "🔄 Refreshing local environment..."
	@API_ID=$$(AWS_REGION=$(or $(REGION),eu-west-2) aws cloudformation describe-stacks --stack-name $(STACK_NAME) --query 'Stacks[0].Outputs[?OutputKey==`HttpApiId`].OutputValue' --output text 2>/dev/null); \
	if [ -z "$$API_ID" ] || [ "$$API_ID" = "None" ]; then \
	  echo "❌ Error: Could not retrieve HttpApiId from CloudFormation stack '$(STACK_NAME)'"; \
	  exit 1; \
	fi; \
	API_URL="https://$$API_ID.execute-api.$(or $(REGION),eu-west-2).amazonaws.com"; \
	echo "VITE_API_URL=$$API_URL" > frontend/.env.local; \
	echo "   API: $$API_URL"; \
	echo ""; \
	echo "Next steps:"; \
	echo "  cd frontend && npm run dev"

# tf-apply: Deploy Terraform infrastructure (ACM certs, CloudFront, S3)
tf-apply:
	@echo "🏗️  Deploying Terraform infrastructure..."
	@HTTP_API_ID=$$(AWS_REGION=$(REGION) aws cloudformation describe-stacks \
		--stack-name $(STACK_NAME) --query 'Stacks[0].Outputs[?OutputKey==`HttpApiId`].OutputValue' --output text); \
	eval $$(aws configure export-credentials --profile default --format env) && \
	AWS_REGION=$(REGION) terraform -chdir=$(TF_DIR) init -upgrade >/dev/null && \
	AWS_REGION=$(REGION) terraform -chdir=$(TF_DIR) apply \
		-var="region=$(REGION)" \
		-var="root_domain_name=$(ROOT_DOMAIN)" \
		-var="sam_http_api_id=$$HTTP_API_ID" \
		-var="wait_for_certificate_validation=true" \
		-auto-approve
	@echo "✅ Terraform infrastructure deployed!"

# prod: Full production deployment (backend + Terraform + frontend)
prod:
	@echo "🚀 Deploying to production..."
	@$(MAKE) ensure-config npm-install lint test sam-deploy set-admin-password tf-apply deploy-frontend STAGE=prod
	@echo "✅ Production deployment complete!"


.PHONY: deployment-complete
deployment-complete:
	@# Generate DNS records file
	@API_TARGET=$$(cd $(TF_DIR) && terraform output -raw api_gateway_target 2>/dev/null); \
	CF_TARGET=$$(cd $(TF_DIR) && terraform output -raw cloudfront_web_client_target 2>/dev/null); \
	API_SUBDOMAIN=$$(cd $(TF_DIR) && terraform output -raw api_subdomain 2>/dev/null || echo "api"); \
	echo "Type	Name	Value	TTL" > $(TF_DIR)/dns-records.txt; \
	echo "CNAME	$$API_SUBDOMAIN	$$API_TARGET	300" >> $(TF_DIR)/dns-records.txt; \
	echo "ALIAS	@	$$CF_TARGET	300" >> $(TF_DIR)/dns-records.txt
	@$(MAKE) generate-outputs
	@echo ""
	@# Check if DNS is already configured correctly
	@API_SUBDOMAIN=$$(cd $(TF_DIR) && terraform output -raw api_subdomain 2>/dev/null || echo "api"); \
	EXPECTED_API_TARGET=$$(cd $(TF_DIR) && terraform output -raw api_gateway_target 2>/dev/null); \
	PERM_DNS_OK=true; \
	if terraform -chdir=$(TF_DIR) state list 2>/dev/null | grep -q 'aws_apigatewayv2_domain_name.api'; then \
		ACTUAL_API_TARGET=$$(dig +short $$API_SUBDOMAIN.$(ROOT_DOMAIN) CNAME | sed 's/\.$$//' || echo ""); \
		if [ -z "$$ACTUAL_API_TARGET" ] || [ "$$ACTUAL_API_TARGET" != "$$EXPECTED_API_TARGET" ]; then \
			PERM_DNS_OK=false; \
		fi; \
		EXPECTED_CF_TARGET=$$(cd $(TF_DIR) && terraform output -raw cloudfront_web_client_target 2>/dev/null); \
		ROOT_CNAME=$$(dig +short $(ROOT_DOMAIN) CNAME | sed 's/\.$$//' || echo ""); \
		if [ -n "$$ROOT_CNAME" ]; then \
			if [ "$$ROOT_CNAME" != "$$EXPECTED_CF_TARGET" ]; then \
				PERM_DNS_OK=false; \
			fi; \
		else \
			ROOT_IPS=$$(dig +short $(ROOT_DOMAIN) A | sort | tr '\n' ' '); \
			if [ -z "$$ROOT_IPS" ]; then \
				PERM_DNS_OK=false; \
			else \
				IS_CLOUDFRONT=false; \
				for root_ip in $$ROOT_IPS; do \
					if host $$root_ip 2>/dev/null | grep -q "cloudfront.net"; then \
						IS_CLOUDFRONT=true; \
						break; \
					fi; \
				done; \
				if [ "$$IS_CLOUDFRONT" != "true" ]; then \
					PERM_DNS_OK=false; \
				fi; \
			fi; \
		fi; \
	fi; \
	if [ "$$PERM_DNS_OK" = "true" ]; then \
		echo "Deployment complete. DNS records are already configured correctly."; \
	else \
		echo "Deployment complete. Set the values in $(TF_DIR)/dns-records.txt at your DNS provider."; \
		echo "Wait for propagation (or check with: make validate-dns)"; \
	fi; \
	echo ""

.PHONY: validate-dns
validate-dns:
	@if ! terraform -chdir=$(TF_DIR) state list 2>/dev/null | grep -q 'aws_acm_certificate.api'; then \
		echo "Error: No certificates found. Run 'make prod' first."; \
		exit 1; \
	fi
	@echo "Checking DNS and certificate status..."; \
	echo ""; \
	API_DNS_OK=false; ROOT_DNS_OK=false; \
	API_VALIDATION=$$(cd $(TF_DIR) && terraform output -json cert_validation_records 2>/dev/null | grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | cut -d'"' -f4); \
	ROOT_VALIDATION=$$(cd $(TF_DIR) && terraform output -json cert_validation_records 2>/dev/null | grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' | tail -1 | cut -d'"' -f4); \
	if [ -n "$$API_VALIDATION" ]; then \
		if dig +short "$$API_VALIDATION" | grep -q .; then \
			echo "[OK] API validation DNS: $$API_VALIDATION"; \
			API_DNS_OK=true; \
		else \
			echo "[MISSING] API validation DNS: $$API_VALIDATION"; \
		fi; \
	fi; \
	if [ -n "$$ROOT_VALIDATION" ] && [ "$$ROOT_VALIDATION" != "$$API_VALIDATION" ]; then \
		if dig +short "$$ROOT_VALIDATION" | grep -q .; then \
			echo "[OK] Root validation DNS: $$ROOT_VALIDATION"; \
			ROOT_DNS_OK=true; \
		else \
			echo "[MISSING] Root validation DNS: $$ROOT_VALIDATION"; \
		fi; \
	fi; \
	echo ""; \
	API_CERT_ARN=$$(cd $(TF_DIR) && terraform state show aws_acm_certificate.api 2>/dev/null | grep '^[[:space:]]*arn[[:space:]]*=' | head -1 | sed 's/.*= "\(.*\)"/\1/' || true); \
	ROOT_CERT_ARN=$$(cd $(TF_DIR) && terraform state show aws_acm_certificate.root_web_client 2>/dev/null | grep '^[[:space:]]*arn[[:space:]]*=' | head -1 | sed 's/.*= "\(.*\)"/\1/' || true); \
	API_CERT_OK=false; ROOT_CERT_OK=false; \
	if [ -n "$$API_CERT_ARN" ]; then \
		API_STATUS=$$(AWS_REGION=$(REGION) aws acm describe-certificate --certificate-arn "$$API_CERT_ARN" --query 'Certificate.Status' --output text 2>/dev/null || echo "UNKNOWN"); \
		echo "API certificate ($(REGION)): $$API_STATUS"; \
		if [ "$$API_STATUS" = "ISSUED" ]; then API_CERT_OK=true; fi; \
	fi; \
	if [ -n "$$ROOT_CERT_ARN" ]; then \
		ROOT_STATUS=$$(AWS_REGION=us-east-1 aws acm describe-certificate --certificate-arn "$$ROOT_CERT_ARN" --query 'Certificate.Status' --output text 2>/dev/null || echo "UNKNOWN"); \
		echo "Root certificate (us-east-1): $$ROOT_STATUS"; \
		if [ "$$ROOT_STATUS" = "ISSUED" ]; then ROOT_CERT_OK=true; fi; \
	fi; \
	echo ""; \
	if terraform -chdir=$(TF_DIR) state list 2>/dev/null | grep -q 'aws_apigatewayv2_domain_name.api'; then \
		PERM_DNS_OK=true; \
		API_SUBDOMAIN=$$(cd $(TF_DIR) && terraform output -raw api_subdomain 2>/dev/null || echo "api"); \
		EXPECTED_API_TARGET=$$(cd $(TF_DIR) && terraform output -raw api_gateway_target 2>/dev/null); \
		ACTUAL_API_TARGET=$$(dig +short $$API_SUBDOMAIN.$(ROOT_DOMAIN) CNAME | sed 's/\.$$//' || echo ""); \
		if [ -n "$$ACTUAL_API_TARGET" ]; then \
			if [ "$$ACTUAL_API_TARGET" = "$$EXPECTED_API_TARGET" ]; then \
				echo "[OK] $$API_SUBDOMAIN.$(ROOT_DOMAIN) -> $$ACTUAL_API_TARGET"; \
			else \
				echo "[WRONG] $$API_SUBDOMAIN.$(ROOT_DOMAIN)"; \
				echo "        Current: $$ACTUAL_API_TARGET"; \
				echo "        Expected: $$EXPECTED_API_TARGET"; \
				PERM_DNS_OK=false; \
			fi; \
		else \
			echo "[MISSING] $$API_SUBDOMAIN.$(ROOT_DOMAIN)"; \
			PERM_DNS_OK=false; \
		fi; \
		EXPECTED_CF_TARGET=$$(cd $(TF_DIR) && terraform output -raw cloudfront_web_client_target 2>/dev/null); \
		ROOT_CNAME=$$(dig +short $(ROOT_DOMAIN) CNAME | sed 's/\.$$//' || echo ""); \
		if [ -n "$$ROOT_CNAME" ]; then \
			if [ "$$ROOT_CNAME" = "$$EXPECTED_CF_TARGET" ]; then \
				echo "[OK] $(ROOT_DOMAIN) -> $$ROOT_CNAME"; \
			else \
				echo "[WRONG] $(ROOT_DOMAIN)"; \
				echo "        Current: $$ROOT_CNAME"; \
				echo "        Expected: $$EXPECTED_CF_TARGET"; \
				PERM_DNS_OK=false; \
			fi; \
		else \
			ROOT_IPS=$$(dig +short $(ROOT_DOMAIN) A | sort | tr '\n' ' '); \
			if [ -n "$$ROOT_IPS" ]; then \
				IS_CLOUDFRONT=false; \
				for root_ip in $$ROOT_IPS; do \
					if host $$root_ip 2>/dev/null | grep -q "cloudfront.net"; then \
						IS_CLOUDFRONT=true; \
						break; \
					fi; \
				done; \
				if [ "$$IS_CLOUDFRONT" = "true" ]; then \
					echo "[OK] $(ROOT_DOMAIN) -> $$EXPECTED_CF_TARGET (ALIAS, verified via CloudFront reverse DNS)"; \
				else \
					echo "[WRONG] $(ROOT_DOMAIN)"; \
					echo "        Current IPs: $$ROOT_IPS"; \
					echo "        Expected CloudFront: $$EXPECTED_CF_TARGET"; \
					echo "        Note: IPs don't resolve to CloudFront (may be propagation issue)"; \
					PERM_DNS_OK=false; \
				fi; \
			else \
				echo "[MISSING] $(ROOT_DOMAIN)"; \
				PERM_DNS_OK=false; \
			fi; \
		fi; \
		echo ""; \
		if [ "$$PERM_DNS_OK" = "true" ]; then \
			echo "STATUS: All DNS records configured correctly"; \
		else \
			echo "STATUS: FAILED - DNS records are missing or pointing to wrong targets"; \
			echo "Action: Update DNS records from $(TF_DIR)/dns-records.txt"; \
		fi; \
	else \
		if [ "$$API_CERT_OK" = "true" ] && [ "$$ROOT_CERT_OK" = "true" ]; then \
			echo "STATUS: READY - Certificates validated"; \
		elif [ "$$API_DNS_OK" = "true" ] && [ "$$ROOT_DNS_OK" = "true" ]; then \
			echo "STATUS: WAITING - DNS records found, waiting for certificate validation (5-15 minutes)"; \
			echo "Action: Wait for AWS to validate certificates"; \
		else \
			echo "STATUS: WAITING - Certificate validation in progress"; \
			if [ "$$API_DNS_OK" = "false" ] || [ "$$ROOT_DNS_OK" = "false" ]; then \
				echo "Action: Create missing DNS records from $(TF_DIR)/dns-records.txt"; \
			else \
				echo "Action: Wait for DNS propagation and certificate validation (5-15 minutes)"; \
			fi; \
		fi; \
	fi; \
	echo ""

validate-password:
	@if [ -z "$$ADMIN_PASSWORD" ]; then \
	  echo "ERROR: ADMIN_PASSWORD environment variable is required"; \
	  echo "Set it via: export ADMIN_PASSWORD=yourpass"; \
	  echo "Or create a .env file (already gitignored) containing ADMIN_PASSWORD=..."; \
	  exit 1; \
	fi
	@# Check length (minimum 8 characters)
	@if [ $$(printf '%s' "$$ADMIN_PASSWORD" | wc -c | tr -d ' ') -lt 8 ]; then \
	  echo "ERROR: Password must be at least 8 characters"; \
	  exit 1; \
	fi
	@# Check for uppercase letter
	@if ! printf '%s' "$$ADMIN_PASSWORD" | grep -q '[A-Z]'; then \
	  echo "ERROR: Password must contain at least one uppercase letter"; \
	  exit 1; \
	fi
	@# Check for lowercase letter
	@if ! printf '%s' "$$ADMIN_PASSWORD" | grep -q '[a-z]'; then \
	  echo "ERROR: Password must contain at least one lowercase letter"; \
	  exit 1; \
	fi
	@# Check for number
	@if ! printf '%s' "$$ADMIN_PASSWORD" | grep -q '[0-9]'; then \
	  echo "ERROR: Password must contain at least one number"; \
	  exit 1; \
	fi

npm-install:
	@npm install --silent 2>&1 | grep -v "npm warn" | grep -v "husky" | grep -v "vulnerabilities" | grep -v "npm audit" | grep -v "npm fund" || true

sam-deploy: validate-password
	AWS_REGION=$(REGION) sam build
	@# Copy Google credentials into build output for deploy (so GOOGLE_APPLICATION_CREDENTIALS can point to a real file)
	@if [ -f "google-credentials.json" ]; then \
	  mkdir -p .aws-sam/build/apiGenerateFunction; \
	  cp google-credentials.json .aws-sam/build/apiGenerateFunction/google-credentials.json; \
	  mkdir -p .aws-sam/build/apiGenerateWorkerFunction; \
	  cp google-credentials.json .aws-sam/build/apiGenerateWorkerFunction/google-credentials.json; \
	fi
	AWS_REGION=$(REGION) sam deploy --no-confirm-changeset --region $(REGION) \
		--stack-name $(STACK_NAME) \
		--parameter-overrides \
			RootDomainName=$(ROOT_DOMAIN) \
			AdminUsername=$(or $(ADMIN_USERNAME),admin) \
			AllowedClientOrigins="$(or $(ALLOWED_ORIGINS),http://localhost:5173)" \
			VertexAiApiKey=$(VERTEX_AI_API_KEY) \
			GoogleVertexProject=$(GOOGLE_VERTEX_PROJECT) \
			GoogleVertexLocation=$(or $(GOOGLE_VERTEX_LOCATION),us-central1) \
			ApifyApiToken=$(APIFY_API_TOKEN)

set-admin-password: validate-password
	@echo "Setting admin user password..."
	@USER_POOL_ID=$$(AWS_REGION=$(REGION) aws cloudformation describe-stacks \
		--stack-name $(STACK_NAME) --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text 2>/dev/null); \
	if [ -z "$$USER_POOL_ID" ]; then \
	  echo "Warning: User Pool not found. Stack may not be deployed yet."; \
	  exit 0; \
	fi; \
	ADMIN_USER=$${ADMIN_USERNAME:-admin}; \
	echo "Waiting for admin user to be created (max 30 seconds)..."; \
	MAX_RETRIES=6; RETRY=0; \
	while [ $$RETRY -lt $$MAX_RETRIES ]; do \
	  if AWS_REGION=$(REGION) aws cognito-idp admin-get-user \
		--user-pool-id $$USER_POOL_ID \
		--username $${ADMIN_USER}@$(ROOT_DOMAIN) \
		--region $(REGION) >/dev/null 2>&1; then \
	    break; \
	  fi; \
	  RETRY=$$((RETRY + 1)); \
	  echo "  User not found yet, waiting (attempt $$RETRY/$$MAX_RETRIES)..."; \
	  sleep 5; \
	done; \
	USER_STATUS=$$(AWS_REGION=$(REGION) aws cognito-idp admin-get-user \
		--user-pool-id $$USER_POOL_ID \
		--username $${ADMIN_USER}@$(ROOT_DOMAIN) \
		--region $(REGION) --query 'UserStatus' --output text 2>/dev/null); \
	if [ "$$USER_STATUS" = "CONFIRMED" ]; then \
	  echo "Admin user already has permanent password. Skipping."; \
	else \
	  if AWS_REGION=$(REGION) aws cognito-idp admin-set-user-password \
		--user-pool-id $$USER_POOL_ID \
		--username $${ADMIN_USER}@$(ROOT_DOMAIN) \
		--password "$$ADMIN_PASSWORD" \
		--region $(REGION) \
		--permanent \
		--no-cli-pager 2>/dev/null; then \
	    echo "Admin password set"; \
	  else \
	    echo "ERROR: Failed to set admin password"; \
	    echo "User status: $$USER_STATUS"; \
	    echo "Try setting password manually:"; \
	    echo "  AWS_REGION=$(REGION) aws cognito-idp admin-set-user-password \\"; \
	    echo "    --user-pool-id $$USER_POOL_ID \\"; \
	    echo "    --username $${ADMIN_USER}@$(ROOT_DOMAIN) \\"; \
	    echo "    --password \"$$ADMIN_PASSWORD\" \\"; \
	    echo "    --permanent"; \
	    exit 1; \
	  fi; \
	fi

.PHONY: generate-outputs
generate-outputs:
	@# Generate infrastructure/variableoutputs.txt with all important outputs
	@echo "Generating infrastructure/variableoutputs.txt..."
	@echo "# Infrastructure Outputs" > $(TF_DIR)/variableoutputs.txt; \
	echo "# Generated: $$(date)" >> $(TF_DIR)/variableoutputs.txt; \
	echo "" >> $(TF_DIR)/variableoutputs.txt; \
	if terraform -chdir=$(TF_DIR) state list 2>/dev/null | grep -q 'aws_cloudfront_distribution.web_client'; then \
	  CF_ID=$$(cd $(TF_DIR) && terraform output -raw cloudfront_distribution_id 2>/dev/null); \
	  CF_DOMAIN=$$(cd $(TF_DIR) && terraform output -raw cloudfront_web_client_target 2>/dev/null); \
	  API_TARGET=$$(cd $(TF_DIR) && terraform output -raw api_gateway_target 2>/dev/null); \
	  BASE_URL=$$(cd $(TF_DIR) && terraform output -raw base_url 2>/dev/null); \
	  echo "CloudFront Distribution ID: $$CF_ID" >> $(TF_DIR)/variableoutputs.txt; \
	  echo "CloudFront Domain: $$CF_DOMAIN" >> $(TF_DIR)/variableoutputs.txt; \
	  echo "API Gateway Target: $$API_TARGET" >> $(TF_DIR)/variableoutputs.txt; \
	  echo "API Base URL: $$BASE_URL" >> $(TF_DIR)/variableoutputs.txt; \
	  echo "" >> $(TF_DIR)/variableoutputs.txt; \
	  echo "# For web client integration:" >> $(TF_DIR)/variableoutputs.txt; \
	  echo "# Use CloudFront Distribution ID: $$CF_ID" >> $(TF_DIR)/variableoutputs.txt; \
	  echo "# This is needed when deploying the web client in shared mode" >> $(TF_DIR)/variableoutputs.txt; \
	else \
	  echo "CloudFront Distribution ID: Not yet deployed" >> $(TF_DIR)/variableoutputs.txt; \
	  echo "# Run 'make prod' to create the CloudFront distribution" >> $(TF_DIR)/variableoutputs.txt; \
	fi; \
	echo "" >> $(TF_DIR)/variableoutputs.txt; \
	echo "# To check outputs manually:" >> $(TF_DIR)/variableoutputs.txt; \
	echo "#   cd infrastructure && terraform output" >> $(TF_DIR)/variableoutputs.txt; \
	echo "#   cd infrastructure && terraform output cloudfront_distribution_id" >> $(TF_DIR)/variableoutputs.txt
	@echo "Outputs written to $(TF_DIR)/variableoutputs.txt"

.PHONY: deploy-frontend
deploy-frontend:
	@echo "Building frontend..."
	@cd frontend && npm install && npm run build
	@# Deploy frontend files to S3 bucket
	@if ! terraform -chdir=$(TF_DIR) state list 2>/dev/null | grep -q 'aws_s3_bucket.web_client'; then \
	  echo "S3 bucket not found. Skipping frontend deployment. Run 'make prod' again after infrastructure is created."; \
	  exit 0; \
	fi; \
	S3_BUCKET=$$(cd $(TF_DIR) && terraform output -raw s3_bucket_name 2>/dev/null); \
	if [ -z "$$S3_BUCKET" ]; then \
	  echo "S3 bucket name not found. Skipping frontend deployment."; \
	  exit 0; \
	fi; \
	echo "Deploying frontend to S3 bucket: $$S3_BUCKET"; \
	AWS_REGION=$(REGION) aws s3 sync frontend/dist/ s3://$$S3_BUCKET/ \
	  --delete \
	  --exclude "*.git*" \
	  --exclude "*.DS_Store" \
	  --cache-control "public, max-age=3600"; \
	CF_DIST_ID=$$(cd $(TF_DIR) && terraform output -raw cloudfront_distribution_id 2>/dev/null); \
	if [ -n "$$CF_DIST_ID" ]; then \
	  echo "Invalidating CloudFront cache for distribution: $$CF_DIST_ID"; \
	  INVALIDATION_ID=$$(AWS_REGION=$(REGION) aws cloudfront create-invalidation \
	    --distribution-id $$CF_DIST_ID \
	    --paths "/*" \
	    --query 'Invalidation.Id' \
	    --output text 2>/dev/null); \
	  if [ -n "$$INVALIDATION_ID" ]; then \
	    echo "CloudFront invalidation created: $$INVALIDATION_ID"; \
	    echo "Cache will be cleared within a few minutes."; \
	  else \
	    echo "Warning: Failed to create CloudFront invalidation"; \
	  fi; \
	else \
	  echo "Warning: CloudFront distribution ID not found. Skipping cache invalidation."; \
	fi; \
	echo "Frontend deployed successfully."

.PHONY: ensure-config
ensure-config:
	@if [ -z "$(REGION)" ] || [ -z "$(ROOT_DOMAIN)" ]; then \
	  echo "ERROR: Set REGION and ROOT_DOMAIN in config.mk"; exit 1; \
	fi

lint:
	@echo "Linting and formatting files..."
	@# Run lint-staged commands on all files (not just staged)
	@npx eslint --fix "**/*.{ts,tsx}"
	@echo "Running TypeScript type-checks..."
	@npx tsc --noEmit
	@echo "Checking frontend TypeScript..."
	@cd frontend && npx tsc --noEmit
	@npx prettier --write "**/*.{ts,tsx,json,md}"

test:
	@echo "Running tests..."
	@npm test

