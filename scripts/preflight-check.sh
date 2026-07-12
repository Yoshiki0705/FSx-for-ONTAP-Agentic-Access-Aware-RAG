#!/usr/bin/env bash
# ============================================================================
# Preflight Check: Validate existing environment before CDK/CFn deployment
# ============================================================================
# Usage:
#   bash scripts/preflight-check.sh [--context path/to/cdk.context.json]
#   bash scripts/preflight-check.sh --skip vpc-endpoints --skip ontap-api
#
# Exit codes:
#   0 = All checks passed
#   1 = One or more checks failed
#   2 = Missing required tools
#
# Environment variables:
#   AWS_REGION          Override region (default: ap-northeast-1)
#   PREFLIGHT_SKIP      Comma-separated checks to skip (e.g., "ontap-api,vpc-endpoints")
#   CDK_CONTEXT_FILE    Path to cdk.context.json (default: ./cdk.context.json)
# ============================================================================

set -uo pipefail

# --- Configuration ---
REGION="${AWS_REGION:-ap-northeast-1}"
CONTEXT_FILE="${CDK_CONTEXT_FILE:-./cdk.context.json}"
SKIP_CHECKS="${PREFLIGHT_SKIP:-}"
VERBOSE="${PREFLIGHT_VERBOSE:-false}"

# --- Counters ---
PASS=0
FAIL=0
SKIP=0
WARN=0

# --- Output Helpers ---
green()  { echo -e "\033[32m[PASS] $1\033[0m"; PASS=$((PASS + 1)); }
red()    { echo -e "\033[31m[FAIL] $1\033[0m"; FAIL=$((FAIL + 1)); }
yellow() { echo -e "\033[33m[SKIP] $1\033[0m"; SKIP=$((SKIP + 1)); }
orange() { echo -e "\033[33m[WARN] $1\033[0m"; WARN=$((WARN + 1)); }
header() { echo -e "\n\033[1;36m━━━ $1 ━━━\033[0m"; }
info()   { echo -e "      $1"; }

# --- Argument Parsing ---
SKIP_LIST=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --context)
      CONTEXT_FILE="$2"; shift 2 ;;
    --skip)
      SKIP_LIST+=("$2"); shift 2 ;;
    --region)
      REGION="$2"; shift 2 ;;
    --verbose)
      export VERBOSE="true"; shift ;;
    --help|-h)
      echo "Usage: $0 [--context FILE] [--skip CHECK] [--region REGION] [--verbose]"
      echo ""
      echo "Checks: vpc, subnets, security-groups, fsx, svm, volume, vpc-endpoints, ontap-api, iam"
      echo ""
      echo "Examples:"
      echo "  $0                                    # Use defaults"
      echo "  $0 --skip ontap-api --skip vpc-endpoints"
      echo "  $0 --context cfn-params/my-env.json --region us-east-1"
      exit 0 ;;
    *)
      echo "Unknown option: $1"; exit 2 ;;
  esac
done

# Merge PREFLIGHT_SKIP env var into SKIP_LIST
if [[ -n "$SKIP_CHECKS" ]]; then
  IFS=',' read -ra ENV_SKIPS <<< "$SKIP_CHECKS"
  SKIP_LIST+=("${ENV_SKIPS[@]}")
fi

should_skip() {
  local check="$1"
  for s in "${SKIP_LIST[@]+"${SKIP_LIST[@]}"}"; do
    if [[ "$s" == "$check" ]]; then
      return 0
    fi
  done
  return 1
}

# --- Tool Check ---
header "0. Required Tools"

check_tool() {
  local tool="$1"
  if command -v "$tool" &>/dev/null; then
    green "$tool: $(command -v "$tool")"
  else
    red "$tool: not found in PATH"
  fi
}

check_tool "aws"
check_tool "jq"
check_tool "node"

# Verify AWS credentials
if aws sts get-caller-identity &>/dev/null; then
  CALLER_ID=$(aws sts get-caller-identity --output json 2>/dev/null)
  ACCOUNT=$(echo "$CALLER_ID" | jq -r '.Account')
  ARN=$(echo "$CALLER_ID" | jq -r '.Arn')
  green "AWS credentials valid (Account: ${ACCOUNT}, Principal: ${ARN})"
else
  red "AWS credentials invalid or expired"
  echo ""
  echo "Fix: Run 'aws configure' or set AWS_PROFILE/AWS_SESSION_TOKEN"
  exit 2
fi

# --- Context File ---
header "1. CDK Context File"

if [[ ! -f "$CONTEXT_FILE" ]]; then
  red "Context file not found: $CONTEXT_FILE"
  info "Copy the template: cp cdk.context.existing-env.example.json cdk.context.json"
  exit 2
fi
green "Context file exists: $CONTEXT_FILE"

# Parse context values (strip // comments for jq compatibility)
ctx() {
  local key="$1"
  sed 's|//.*||' "$CONTEXT_FILE" | jq -r ".[\"$key\"] // empty" 2>/dev/null
}

FS_ID=$(ctx "existingFileSystemId")
SVM_ID=$(ctx "existingSvmId")
VOL_ID=$(ctx "existingVolumeId")
VPC_ID=$(ctx "existingVpcId")
PROJECT_NAME=$(ctx "projectName")
ENVIRONMENT=$(ctx "environment")

if [[ -n "$PROJECT_NAME" ]]; then
  green "projectName: $PROJECT_NAME"
else
  red "projectName: not set"
fi

if [[ -n "$ENVIRONMENT" ]]; then
  green "environment: $ENVIRONMENT"
else
  red "environment: not set"
fi

# --- Existing Resource Mode Detection ---
header "2. Deployment Mode"

if [[ -n "$FS_ID" && -n "$SVM_ID" && -n "$VOL_ID" ]]; then
  green "Existing environment mode (all three FSx IDs specified)"
  EXISTING_MODE=true
elif [[ -z "$FS_ID" && -z "$SVM_ID" && -z "$VOL_ID" ]]; then
  green "Greenfield mode (no existing FSx IDs — CDK will create new resources)"
  EXISTING_MODE=false
else
  red "Partial FSx IDs specified — must set all three or none"
  info "  existingFileSystemId: ${FS_ID:-<empty>}"
  info "  existingSvmId: ${SVM_ID:-<empty>}"
  info "  existingVolumeId: ${VOL_ID:-<empty>}"
  EXISTING_MODE=false
fi

# --- VPC Validation ---
header "3. VPC"

if should_skip "vpc"; then
  yellow "VPC checks skipped (--skip vpc)"
elif [[ -n "$VPC_ID" ]]; then
  VPC_JSON=$(aws ec2 describe-vpcs --vpc-ids "$VPC_ID" --region "$REGION" --output json 2>/dev/null)
  if [[ $? -eq 0 && $(echo "$VPC_JSON" | jq '.Vpcs | length') -gt 0 ]]; then
    CIDR=$(echo "$VPC_JSON" | jq -r '.Vpcs[0].CidrBlock')
    DNS_SUPPORT=$(aws ec2 describe-vpc-attribute --vpc-id "$VPC_ID" --attribute enableDnsSupport --region "$REGION" --query 'EnableDnsSupport.Value' --output text 2>/dev/null)
    DNS_HOSTNAMES=$(aws ec2 describe-vpc-attribute --vpc-id "$VPC_ID" --attribute enableDnsHostnames --region "$REGION" --query 'EnableDnsHostnames.Value' --output text 2>/dev/null)

    green "VPC exists: $VPC_ID (CIDR: $CIDR)"

    if [[ "$DNS_SUPPORT" == "True" ]]; then
      green "DNS Support: enabled"
    else
      red "DNS Support: disabled (required for VPC Endpoints)"
    fi

    if [[ "$DNS_HOSTNAMES" == "True" ]]; then
      green "DNS Hostnames: enabled"
    else
      red "DNS Hostnames: disabled (required for Interface Endpoints)"
    fi
  else
    red "VPC not found: $VPC_ID (region: $REGION)"
  fi
else
  info "No existingVpcId — CDK will create a new VPC"
  green "VPC: greenfield (will be created)"
fi

# --- Subnet Validation ---
header "4. Subnets"

if should_skip "subnets"; then
  yellow "Subnet checks skipped (--skip subnets)"
elif [[ -n "$VPC_ID" ]]; then
  PRIVATE_SUBNETS=$(aws ec2 describe-subnets \
    --filters "Name=vpc-id,Values=$VPC_ID" \
    --region "$REGION" --output json 2>/dev/null | \
    jq '[.Subnets[] | select(.MapPublicIpOnLaunch == false)]')

  SUBNET_COUNT=$(echo "$PRIVATE_SUBNETS" | jq 'length')
  AZ_COUNT=$(echo "$PRIVATE_SUBNETS" | jq '[.[].AvailabilityZone] | unique | length')

  if [[ "$SUBNET_COUNT" -ge 2 ]]; then
    green "Private subnets: $SUBNET_COUNT found"
  else
    red "Private subnets: $SUBNET_COUNT found (need >= 2)"
  fi

  if [[ "$AZ_COUNT" -ge 2 ]]; then
    green "Availability Zones: $AZ_COUNT (multi-AZ)"
  else
    red "Availability Zones: $AZ_COUNT (need >= 2 for HA)"
  fi

  # Check NAT Gateway
  NAT_GW=$(aws ec2 describe-nat-gateways \
    --filter "Name=vpc-id,Values=$VPC_ID" "Name=state,Values=available" \
    --region "$REGION" --query 'NatGateways | length(@)' --output text 2>/dev/null)
  if [[ "$NAT_GW" -gt 0 ]]; then
    green "NAT Gateway: $NAT_GW available"
  else
    orange "NAT Gateway: none found (Lambda needs NAT or VPC Endpoints for AWS APIs)"
  fi
else
  green "Subnets: greenfield (will be created with VPC)"
fi

# --- Security Groups ---
header "5. Security Groups"

if should_skip "security-groups"; then
  yellow "Security Group checks skipped (--skip security-groups)"
elif [[ -n "$VPC_ID" ]]; then
  # Check for SG with HTTPS egress (basic validation)
  SG_COUNT=$(aws ec2 describe-security-groups \
    --filters "Name=vpc-id,Values=$VPC_ID" \
    --region "$REGION" --query 'SecurityGroups | length(@)' --output text 2>/dev/null)
  if [[ "$SG_COUNT" -gt 0 ]]; then
    green "Security Groups in VPC: $SG_COUNT found"
    info "Ensure Lambda SG allows TCP 443 egress to ONTAP Management LIF"
  else
    red "No Security Groups found in VPC $VPC_ID"
  fi
else
  green "Security Groups: greenfield (will be created)"
fi

# --- FSx for ONTAP ---
header "6. FSx for ONTAP File System"

if should_skip "fsx"; then
  yellow "FSx checks skipped (--skip fsx)"
elif [[ "$EXISTING_MODE" == "true" ]]; then
  FS_JSON=$(aws fsx describe-file-systems --file-system-ids "$FS_ID" --region "$REGION" --output json 2>/dev/null)
  if [[ $? -eq 0 && $(echo "$FS_JSON" | jq '.FileSystems | length') -gt 0 ]]; then
    FS_TYPE=$(echo "$FS_JSON" | jq -r '.FileSystems[0].FileSystemType')
    FS_LIFECYCLE=$(echo "$FS_JSON" | jq -r '.FileSystems[0].Lifecycle')
    FS_VPC=$(echo "$FS_JSON" | jq -r '.FileSystems[0].SubnetIds[0]' | xargs -I{} aws ec2 describe-subnets --subnet-ids {} --region "$REGION" --query 'Subnets[0].VpcId' --output text 2>/dev/null)
    DEPLOY_TYPE=$(echo "$FS_JSON" | jq -r '.FileSystems[0].OntapConfiguration.DeploymentType // "UNKNOWN"')

    if [[ "$FS_TYPE" == "ONTAP" ]]; then
      green "File System type: ONTAP"
    else
      red "File System type: $FS_TYPE (expected ONTAP)"
    fi

    if [[ "$FS_LIFECYCLE" == "AVAILABLE" ]]; then
      green "File System lifecycle: $FS_LIFECYCLE"
    else
      red "File System lifecycle: $FS_LIFECYCLE (expected AVAILABLE)"
    fi

    green "Deployment type: $DEPLOY_TYPE"

    # VPC consistency check
    if [[ -n "$VPC_ID" && "$FS_VPC" != "$VPC_ID" ]]; then
      red "VPC mismatch: FSx in $FS_VPC, but existingVpcId=$VPC_ID"
      info "FSx for ONTAP and Lambda must be in the same VPC (or peered)"
    elif [[ -n "$VPC_ID" ]]; then
      green "VPC consistency: FSx and existingVpcId match ($VPC_ID)"
    fi
  else
    red "File System not found: $FS_ID (region: $REGION)"
  fi
else
  green "FSx for ONTAP: greenfield (will be created)"
fi

# --- SVM ---
header "7. Storage Virtual Machine"

if should_skip "svm"; then
  yellow "SVM checks skipped (--skip svm)"
elif [[ "$EXISTING_MODE" == "true" ]]; then
  SVM_JSON=$(aws fsx describe-storage-virtual-machines \
    --storage-virtual-machine-ids "$SVM_ID" --region "$REGION" --output json 2>/dev/null)
  if [[ $? -eq 0 && $(echo "$SVM_JSON" | jq '.StorageVirtualMachines | length') -gt 0 ]]; then
    SVM_LIFECYCLE=$(echo "$SVM_JSON" | jq -r '.StorageVirtualMachines[0].Lifecycle')
    SVM_FS=$(echo "$SVM_JSON" | jq -r '.StorageVirtualMachines[0].FileSystemId')
    if [[ "$SVM_LIFECYCLE" == "CREATED" ]]; then
      green "SVM lifecycle: $SVM_LIFECYCLE"
    else
      red "SVM lifecycle: $SVM_LIFECYCLE (expected CREATED)"
    fi

    if [[ "$SVM_FS" == "$FS_ID" ]]; then
      green "SVM belongs to File System: $FS_ID"
    else
      red "SVM File System mismatch: SVM in $SVM_FS, expected $FS_ID"
    fi

    # Check for ONTAP S3 server conflict (blocks S3 Access Point creation)
    info "Check ONTAP S3 server conflict via ONTAP REST API (manual)"
    info "If S3 AP creation fails, verify: GET /protocols/s3/services?svm.name={svm}"
  else
    red "SVM not found: $SVM_ID (region: $REGION)"
  fi
else
  green "SVM: greenfield (will be created)"
fi

# --- Volume ---
header "8. Volume"

if should_skip "volume"; then
  yellow "Volume checks skipped (--skip volume)"
elif [[ "$EXISTING_MODE" == "true" ]]; then
  VOL_JSON=$(aws fsx describe-volumes --volume-ids "$VOL_ID" --region "$REGION" --output json 2>/dev/null)
  if [[ $? -eq 0 && $(echo "$VOL_JSON" | jq '.Volumes | length') -gt 0 ]]; then
    VOL_LIFECYCLE=$(echo "$VOL_JSON" | jq -r '.Volumes[0].Lifecycle')
    VOL_TYPE=$(echo "$VOL_JSON" | jq -r '.Volumes[0].VolumeType')
    VOL_STYLE=$(echo "$VOL_JSON" | jq -r '.Volumes[0].OntapConfiguration.SecurityStyle // "UNKNOWN"')
    VOL_SIZE=$(echo "$VOL_JSON" | jq -r '.Volumes[0].OntapConfiguration.SizeInMegabytes // "UNKNOWN"')

    if [[ "$VOL_LIFECYCLE" == "CREATED" ]]; then
      green "Volume lifecycle: $VOL_LIFECYCLE"
    else
      red "Volume lifecycle: $VOL_LIFECYCLE (expected CREATED)"
    fi

    green "Volume type: $VOL_TYPE"
    green "Security style: $VOL_STYLE"
    green "Size: ${VOL_SIZE} MB"
  else
    red "Volume not found: $VOL_ID (region: $REGION)"
  fi
else
  green "Volume: greenfield (will be created)"
fi

# --- VPC Endpoints ---
header "9. VPC Endpoints"

if should_skip "vpc-endpoints"; then
  yellow "VPC Endpoint checks skipped (--skip vpc-endpoints)"
elif [[ -n "$VPC_ID" ]]; then
  EXISTING_EPS=$(aws ec2 describe-vpc-endpoints \
    --filters "Name=vpc-id,Values=$VPC_ID" \
    --region "$REGION" --output json 2>/dev/null | \
    jq -r '.VpcEndpoints[] | "\(.ServiceName) (\(.VpcEndpointType))"' 2>/dev/null)

  if [[ -n "$EXISTING_EPS" ]]; then
    EP_COUNT=$(echo "$EXISTING_EPS" | wc -l | tr -d ' ')
    green "Existing VPC Endpoints: $EP_COUNT found"

    # Check for potential conflicts
    CONFLICT_SERVICES=("s3" "dynamodb" "bedrock-runtime" "secretsmanager" "sts")
    CONFLICTS_FOUND=()

    for SVC in "${CONFLICT_SERVICES[@]}"; do
      if echo "$EXISTING_EPS" | grep -qi "$SVC"; then
        CONFLICTS_FOUND+=("$SVC")
      fi
    done

    if [[ ${#CONFLICTS_FOUND[@]} -gt 0 ]]; then
      orange "Potential CDK conflicts: ${CONFLICTS_FOUND[*]}"
      info "Add to cdk.context.json to prevent duplicate creation:"
      info "  \"skipVpcEndpoints\": [$(printf '"%s",' "${CONFLICTS_FOUND[@]}" | sed 's/,$//')]"
    else
      green "No endpoint conflicts detected"
    fi

    # Distinguish Gateway vs Interface
    GW_EPS=$(aws ec2 describe-vpc-endpoints \
      --filters "Name=vpc-id,Values=$VPC_ID" "Name=vpc-endpoint-type,Values=Gateway" \
      --region "$REGION" --query 'VpcEndpoints | length(@)' --output text 2>/dev/null)
    IF_EPS=$(aws ec2 describe-vpc-endpoints \
      --filters "Name=vpc-id,Values=$VPC_ID" "Name=vpc-endpoint-type,Values=Interface" \
      --region "$REGION" --query 'VpcEndpoints | length(@)' --output text 2>/dev/null)

    info "Gateway Endpoints: $GW_EPS (S3, DynamoDB — free)"
    info "Interface Endpoints: $IF_EPS (per-AZ hourly cost)"
  else
    info "No existing VPC Endpoints in $VPC_ID"
    green "VPC Endpoints: no conflicts (CDK will create as needed)"
  fi
else
  green "VPC Endpoints: greenfield VPC (will be created)"
fi

# --- ONTAP REST API Connectivity ---
header "10. ONTAP REST API"

ONTAP_IP=$(ctx "ontapMgmtIp")

if should_skip "ontap-api"; then
  yellow "ONTAP API checks skipped (--skip ontap-api)"
elif [[ -n "$ONTAP_IP" ]]; then
  info "Management LIF: $ONTAP_IP"
  info "Note: Direct connectivity test requires network access to ONTAP mgmt LIF."
  info "This check verifies the Secrets Manager secret exists."

  SECRET_ARN=$(ctx "ontapAdminSecretArn")
  if [[ -n "$SECRET_ARN" ]]; then
    if SECRET_CHECK=$(aws secretsmanager describe-secret --secret-id "$SECRET_ARN" --region "$REGION" 2>/dev/null); then
      green "ONTAP admin secret exists: $(echo "$SECRET_CHECK" | jq -r '.Name')"
    else
      red "ONTAP admin secret not found: $SECRET_ARN"
      info "Create with: aws secretsmanager create-secret --name ontap-fsxadmin-password --secret-string '{\"username\":\"fsxadmin\",\"password\":\"xxx\"}'"
    fi
  else
    orange "ontapAdminSecretArn not set in context (optional for fsxn-ops)"
  fi
else
  info "ontapMgmtIp not set — ONTAP API checks not applicable"
  yellow "ONTAP API: not configured (optional)"
fi

# --- IAM / CDK Bootstrap ---
header "11. CDK Bootstrap"

if should_skip "iam"; then
  yellow "IAM/Bootstrap checks skipped (--skip iam)"
else
  BOOTSTRAP_STACK=$(aws cloudformation describe-stacks \
    --stack-name CDKToolkit --region "$REGION" \
    --query 'Stacks[0].StackStatus' --output text 2>/dev/null)

  if [[ "$BOOTSTRAP_STACK" == *"COMPLETE"* ]]; then
    green "CDK Bootstrap: $BOOTSTRAP_STACK (region: $REGION)"
  elif [[ "$BOOTSTRAP_STACK" == "None" || -z "$BOOTSTRAP_STACK" ]]; then
    red "CDK Bootstrap: not found in $REGION"
    info "Run: npx cdk bootstrap aws://$ACCOUNT/$REGION"
  else
    orange "CDK Bootstrap: $BOOTSTRAP_STACK (may need attention)"
  fi

  # Check us-east-1 bootstrap (needed for WAF stack)
  if [[ "$REGION" != "us-east-1" ]]; then
    BOOTSTRAP_USE1=$(aws cloudformation describe-stacks \
      --stack-name CDKToolkit --region us-east-1 \
      --query 'Stacks[0].StackStatus' --output text 2>/dev/null)
    if [[ "$BOOTSTRAP_USE1" == *"COMPLETE"* ]]; then
      green "CDK Bootstrap (us-east-1 for WAF): $BOOTSTRAP_USE1"
    else
      red "CDK Bootstrap (us-east-1 for WAF): not found"
      info "Run: npx cdk bootstrap aws://$ACCOUNT/us-east-1"
    fi
  fi
fi

# --- Summary ---
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "\033[1m  Preflight Results\033[0m"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  \033[32mPASSED:\033[0m $PASS"
echo -e "  \033[31mFAILED:\033[0m $FAIL"
echo -e "  \033[33mSKIPPED:\033[0m $SKIP"
echo -e "  \033[33mWARNINGS:\033[0m $WARN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ "$FAIL" -gt 0 ]]; then
  echo ""
  echo -e "\033[31m  ✗ Preflight FAILED — fix the above issues before deploying.\033[0m"
  exit 1
else
  echo ""
  echo -e "\033[32m  ✓ Preflight PASSED — ready to deploy.\033[0m"
  if [[ "$WARN" -gt 0 ]]; then
    echo -e "    (Review warnings above for optional improvements)"
  fi
  exit 0
fi
