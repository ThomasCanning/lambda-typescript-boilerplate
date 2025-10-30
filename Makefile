# Simple deploy: terraform apply then SAM deploy

-include config.mk

TF_DIR      ?= infrastructure
# Derive SAM stack name from samconfig.toml if not provided via env
STACK_NAME  ?= $(shell awk -F'=' '/^stack_name/ {gsub(/[ "\r\t]/, "", $$2); print $$2}' samconfig.toml)

.PHONY: deploy tf-apply sam-deploy

deploy: ensure-config sam-deploy tf-bootstrap tf-apply

tf-apply:
	@# Read SAM outputs to feed Terraform variables
	REST_API_ID=$$(AWS_REGION=$(REGION) aws cloudformation describe-stacks \
		--stack-name $(STACK_NAME) --query 'Stacks[0].Outputs[?OutputKey==`RestApiId`].OutputValue' --output text); \
	REST_API_STAGE=$$(AWS_REGION=$(REGION) aws cloudformation describe-stacks \
		--stack-name $(STACK_NAME) --query 'Stacks[0].Outputs[?OutputKey==`RestApiStageName`].OutputValue' --output text); \
	AWS_REGION=$(REGION) terraform -chdir=$(TF_DIR) init -upgrade; \
	AWS_REGION=$(REGION) terraform -chdir=$(TF_DIR) apply \
		-var="region=$(REGION)" \
		-var="root_domain_name=$(ROOT_DOMAIN)" \
		-var="sam_rest_api_id=$$REST_API_ID" \
		-var="sam_rest_api_stage=$$REST_API_STAGE" \
		-auto-approve

sam-deploy:
	AWS_REGION=$(REGION) sam build
	AWS_REGION=$(REGION) sam deploy --no-confirm-changeset --region $(REGION) \
		--parameter-overrides RootDomainName=$(ROOT_DOMAIN)

# Bootstrap: ensure hosted zone exists and registrar NS matches Route 53 NS
.PHONY: tf-bootstrap
tf-bootstrap:
	AWS_REGION=$(REGION) terraform -chdir=$(TF_DIR) init -upgrade
	@# Create/refresh the hosted zone first to obtain nameservers
	AWS_REGION=$(REGION) terraform -chdir=$(TF_DIR) apply -auto-approve -target=aws_route53_zone.root -var="region=$(REGION)" -var="root_domain_name=$(ROOT_DOMAIN)" -var="sam_rest_api_id=dummy" -var="sam_rest_api_stage=Prod"
	@# Fetch Route 53 NS from Terraform state
	R53_NS=$$(AWS_REGION=$(REGION) terraform -chdir=$(TF_DIR) output -json root_nameservers | jq -r '.[]' | sed 's/\.$//' | sort); \
	REG_NS=$$(dig NS $(ROOT_DOMAIN) +short | sed 's/\.$//' | sort); \
	echo "Route53 NS:\n$$R53_NS"; echo "Registrar NS (public DNS):\n$$REG_NS"; \
	if [ "$$R53_NS" != "$$REG_NS" ]; then \
	  echo "\nACTION REQUIRED: Update your registrar to use the above Route 53 nameservers for $(ROOT_DOMAIN)."; \
	  echo "Re-run 'make deploy' after DNS propagates."; \
	  exit 2; \
	fi

.PHONY: ensure-config
ensure-config:
	@if [ -z "$(REGION)" ] || [ -z "$(ROOT_DOMAIN)" ]; then \
	  echo "ERROR: Set AWS_REGION and ROOT_DOMAIN in config.mk"; exit 1; \
	fi


