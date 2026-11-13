"""A Strands agent wired to the Step Functions tools Gateway.

The agent decides when to run a workflow and what input to pass; the state
machine enforces which steps run and in what order. The default Gateway scope is
read-only, so this sample focuses on status queries. If write ops are enabled on
the stack (and the caller's role is allowed by the Cedar policy), the agent can
also start and stop executions.

Usage:
    export GATEWAY_URL=<SfnGatewayUrl from cdk deploy output>
    export AWS_REGION=<the Gateway's region>
    uv run store_agent.py "直近の実行状況を確認して"
"""

import sys

from strands import Agent
from strands.hooks import BeforeToolCallEvent

from gateway_tools import escape_non_ascii, gateway_client

# The tool descriptions returned by tools/list are the connector's generic
# operation descriptions. The input shape for StartExecution is specific to the
# workflow, so it has to be given to the agent here.
SYSTEM_PROMPT = """You operate the FSx for ONTAP SnapMirror workflows exposed as tools.

Read-only (always available):
- snapmirrorFailover___ListExecutions: list executions. Pass {"statusFilter": "RUNNING"} to see in-flight runs.
- snapmirrorFailover___DescribeExecution: pass {"executionArn": "...", "includedData": "ALL_DATA"} to see input/output.
- snapmirrorFailover___GetExecutionHistory: pass {"executionArn": "..."} to inspect where a run is.
- snapmirrorFailover___DescribeStateMachine: metadata of the pinned state machine.

Write (only if the stack enabled write ops and your role is permitted by policy):
- snapmirrorFailover___StartExecution: start a failover. Input is a JSON string:
  {"prod_management_lif": "...", "dr_management_lif": "...", "prod_svm": "...", "dr_svm": "...",
   "sns_topic_arn": "...", "initiated_by": "..."}
- snapmirrorFailover___StopExecution: pass {"executionArn": "..."}.

Never invent a stateMachineArn: it is pinned by the Gateway and you cannot set it.
Prefer read-only tools. Only start or stop a workflow when explicitly asked.
"""


def main() -> None:
    if len(sys.argv) < 2:
        print('usage: uv run store_agent.py "<prompt>"')
        raise SystemExit(2)

    agent = Agent(
        model="us.anthropic.claude-haiku-5-5",
        tools=[gateway_client(r"^snapmirror")],
        system_prompt=SYSTEM_PROMPT,
    )
    agent.hooks.add_callback(BeforeToolCallEvent, escape_non_ascii)
    agent(sys.argv[1])


if __name__ == "__main__":
    main()
