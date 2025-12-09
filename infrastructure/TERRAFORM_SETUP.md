# Terraform Remote State Setup

## One-Time Setup (Run Once)

This creates the S3 bucket and DynamoDB table for Terraform state management.

### Step 1: Bootstrap the state infrastructure

```bash
cd infrastructure

# The backend block in backend.tf is already commented out

# Apply bootstrap to create S3 bucket and DynamoDB table
terraform init
terraform apply -target=aws_s3_bucket.terraform_state -target=aws_dynamodb_table.terraform_lock
```

### Step 2: Enable remote state

```bash
# Uncomment the backend block in backend.tf (lines 4-9)
# Then migrate to remote state
terraform init -migrate-state

# Confirm migration when prompted (type 'yes')
```

### Step 3: Clean up bootstrap file

```bash
# Remove bootstrap.tf (no longer needed)
rm bootstrap.tf
```

### Step 3: Clean up bootstrap file

```bash
# Remove bootstrap.tf (no longer needed)
rm bootstrap.tf
```

## How It Works

**S3 Bucket**: Stores the Terraform state file

- Versioned (can recover from mistakes)
- Encrypted (AES256)
- Private (no public access)

**DynamoDB Table**: Provides state locking

- Prevents concurrent modifications
- Automatically releases locks after apply/destroy

## Multi-Developer Workflow

When Alice runs `make prod`:

1. Terraform acquires lock in DynamoDB
2. Updates infrastructure
3. Saves state to S3
4. Releases lock

When Bob tries to run `make prod` at the same time:

1. Terraform waits for lock
2. Gets latest state from S3
3. Proceeds safely after Alice finishes

**No more conflicts!** ✅
