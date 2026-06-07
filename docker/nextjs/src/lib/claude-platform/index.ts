/**
 * Claude Platform on AWS — Module exports
 */
export {
  callWithWebSearch,
  isClaudePlatformAvailable,
  buildClaudePlatformConfig,
  type ClaudePlatformConfig,
  type ClaudePlatformMode,
  type ClaudePlatformResponse,
  type WebSearchResult,
} from './client';

export {
  routeInvocation,
  emitRoutingDecisionMetric,
  type InvocationPath,
  type RoutingDecision,
} from './invocation-router';
