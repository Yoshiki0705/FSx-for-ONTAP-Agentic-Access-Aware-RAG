/**
 * The Lambda client /api/feedback uses. Kept outside the route file, which may export only
 * the HTTP method handlers and route settings.
 */
import { LambdaClient } from '@aws-sdk/client-lambda';

let client: LambdaClient | null = null;
export function feedbackLambda(): LambdaClient {
  client ??= new LambdaClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
  return client;
}
/** Tests replace the client. */
export function __setLambdaClient(c: { send: (cmd: unknown) => Promise<unknown> } | null): void {
  client = c as LambdaClient | null;
}
