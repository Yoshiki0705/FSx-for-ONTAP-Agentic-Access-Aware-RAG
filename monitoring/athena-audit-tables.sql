-- =============================================================================
-- Athena Table Definitions for Permission-Aware RAG Audit Logs
-- =============================================================================
-- 
-- Prerequisites:
--   1. CloudWatch Logs → S3 export configured (or Kinesis Firehose)
--   2. S3 bucket for audit logs: s3://${AUDIT_BUCKET}/audit-logs/
--   3. Athena workgroup configured with query result location
--
-- Usage:
--   1. Run CREATE DATABASE (once)
--   2. Run CREATE TABLE statements
--   3. Run MSCK REPAIR TABLE to load partitions
--   4. Query with sample queries at the bottom
--
-- Partition strategy: year/month/day for cost-efficient scanning
-- =============================================================================

CREATE DATABASE IF NOT EXISTS permission_aware_rag_audit;

-- =============================================================================
-- Table 1: RAG Search Audit Logs
-- =============================================================================

CREATE EXTERNAL TABLE IF NOT EXISTS permission_aware_rag_audit.rag_search_logs (
  eventType STRING,
  timestamp STRING,
  requestId STRING,
  sessionId STRING,
  userId STRING,
  cognitoSub STRING,
  userSID STRING,
  groupSIDs ARRAY<STRING>,
  ipAddress STRING,
  userAgent STRING,
  queryText STRING,
  queryMode STRING,
  modelId STRING,
  smartRouting BOOLEAN,
  routingTier STRING,
  knowledgeBaseId STRING,
  vectorStoreType STRING,
  totalDocumentsRetrieved INT,
  documentsAfterFilter INT,
  documentsDenied INT,
  filterMethod STRING,
  tokensInput INT,
  tokensOutput INT,
  latencyMs INT,
  guardrailsApplied BOOLEAN,
  guardrailsAction STRING
)
PARTITIONED BY (year STRING, month STRING, day STRING)
ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'
WITH SERDEPROPERTIES (
  'ignore.malformed.json' = 'true',
  'case.insensitive' = 'true'
)
STORED AS TEXTFILE
LOCATION 's3://${AUDIT_BUCKET}/audit-logs/rag-search/'
TBLPROPERTIES ('has_encrypted_data'='true');

-- =============================================================================
-- Table 2: Permission Change Audit Logs
-- =============================================================================

CREATE EXTERNAL TABLE IF NOT EXISTS permission_aware_rag_audit.permission_change_logs (
  eventType STRING,
  timestamp STRING,
  changeType STRING,
  userId STRING,
  previousGroupSIDs ARRAY<STRING>,
  newGroupSIDs ARRAY<STRING>,
  source STRING,
  triggeredBy STRING
)
PARTITIONED BY (year STRING, month STRING, day STRING)
ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'
WITH SERDEPROPERTIES (
  'ignore.malformed.json' = 'true',
  'case.insensitive' = 'true'
)
STORED AS TEXTFILE
LOCATION 's3://${AUDIT_BUCKET}/audit-logs/permission-changes/'
TBLPROPERTIES ('has_encrypted_data'='true');

-- =============================================================================
-- Table 3: Agent Execution Audit Logs
-- =============================================================================

CREATE EXTERNAL TABLE IF NOT EXISTS permission_aware_rag_audit.agent_execution_logs (
  eventType STRING,
  timestamp STRING,
  requestId STRING,
  userId STRING,
  agentId STRING,
  agentName STRING,
  agentMode STRING,
  toolsInvoked ARRAY<STRING>,
  stepsExecuted INT,
  taskSuccess BOOLEAN,
  humanEscalation BOOLEAN,
  tokensTotal INT,
  costEstimate DOUBLE,
  latencyMs INT
)
PARTITIONED BY (year STRING, month STRING, day STRING)
ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'
WITH SERDEPROPERTIES (
  'ignore.malformed.json' = 'true',
  'case.insensitive' = 'true'
)
STORED AS TEXTFILE
LOCATION 's3://${AUDIT_BUCKET}/audit-logs/agent-execution/'
TBLPROPERTIES ('has_encrypted_data'='true');

-- =============================================================================
-- Table 4: Guardrails Intervention Logs
-- =============================================================================

CREATE EXTERNAL TABLE IF NOT EXISTS permission_aware_rag_audit.guardrails_logs (
  eventType STRING,
  timestamp STRING,
  requestId STRING,
  userId STRING,
  policyType STRING,
  action STRING,
  blockedContent STRING,
  modelId STRING
)
PARTITIONED BY (year STRING, month STRING, day STRING)
ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'
WITH SERDEPROPERTIES (
  'ignore.malformed.json' = 'true',
  'case.insensitive' = 'true'
)
STORED AS TEXTFILE
LOCATION 's3://${AUDIT_BUCKET}/audit-logs/guardrails/'
TBLPROPERTIES ('has_encrypted_data'='true');

-- =============================================================================
-- Load partitions (run after data is available)
-- =============================================================================

MSCK REPAIR TABLE permission_aware_rag_audit.rag_search_logs;
MSCK REPAIR TABLE permission_aware_rag_audit.permission_change_logs;
MSCK REPAIR TABLE permission_aware_rag_audit.agent_execution_logs;
MSCK REPAIR TABLE permission_aware_rag_audit.guardrails_logs;

-- =============================================================================
-- Sample Queries
-- =============================================================================

-- 1. Permission denial summary (past 7 days)
-- SELECT
--   userId,
--   COUNT(*) as total_searches,
--   SUM(documentsDenied) as total_denied,
--   AVG(latencyMs) as avg_latency_ms
-- FROM permission_aware_rag_audit.rag_search_logs
-- WHERE year = '2026' AND month = '05'
--   AND CAST(timestamp AS TIMESTAMP) > current_timestamp - interval '7' day
-- GROUP BY userId
-- ORDER BY total_denied DESC
-- LIMIT 20;

-- 2. Fail-Closed events (DenyAll fallback)
-- SELECT timestamp, userId, queryText, filterMethod
-- FROM permission_aware_rag_audit.rag_search_logs
-- WHERE filterMethod = 'DENY_ALL_FALLBACK'
--   AND year = '2026'
-- ORDER BY timestamp DESC
-- LIMIT 50;

-- 3. Permission changes timeline
-- SELECT timestamp, userId, changeType, source,
--        cardinality(previousGroupSIDs) as prev_groups,
--        cardinality(newGroupSIDs) as new_groups
-- FROM permission_aware_rag_audit.permission_change_logs
-- WHERE year = '2026' AND month = '05'
-- ORDER BY timestamp DESC
-- LIMIT 100;

-- 4. Agent tool usage analysis
-- SELECT agentName, tool,
--        COUNT(*) as invocation_count,
--        AVG(costEstimate) as avg_cost
-- FROM permission_aware_rag_audit.agent_execution_logs
-- CROSS JOIN UNNEST(toolsInvoked) AS t(tool)
-- WHERE year = '2026'
-- GROUP BY agentName, tool
-- ORDER BY invocation_count DESC;

-- 5. Guardrails intervention rate by policy type
-- SELECT policyType, action,
--        COUNT(*) as intervention_count,
--        COUNT(*) * 100.0 / (SELECT COUNT(*) FROM permission_aware_rag_audit.rag_search_logs WHERE year = '2026') as intervention_rate_pct
-- FROM permission_aware_rag_audit.guardrails_logs
-- WHERE year = '2026'
-- GROUP BY policyType, action
-- ORDER BY intervention_count DESC;

-- 6. Cost trend by model (daily)
-- SELECT day, modelId,
--        SUM(tokensInput) as total_input_tokens,
--        SUM(tokensOutput) as total_output_tokens,
--        COUNT(*) as request_count
-- FROM permission_aware_rag_audit.rag_search_logs
-- WHERE year = '2026' AND month = '05'
-- GROUP BY day, modelId
-- ORDER BY day, modelId;
