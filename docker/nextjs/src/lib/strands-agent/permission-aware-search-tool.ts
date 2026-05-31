/**
 * Strands Agents SDK — Permission-Aware Search Tool
 *
 * A custom Strands tool that wraps the existing SID-filtered KB Retrieve
 * pipeline. When used by a Strands Agent, it automatically applies
 * permission filtering based on the user's SID/UID/GID.
 *
 * This replaces the Bedrock Agent Action Group approach with a more
 * flexible, locally-testable Strands tool pattern.
 *
 * Usage:
 *   import { permissionAwareSearch } from './permission-aware-search-tool';
 *   const agent = new Agent({ tools: [permissionAwareSearch] });
 */

import { tool } from '@strands-agents/sdk';
import z from 'zod';
import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';
import { filterByPermissions } from '@/lib/rag-pipeline';

const KB_ID = process.env.BEDROCK_KB_ID || '';
const REGION = process.env.BEDROCK_REGION || process.env.AWS_REGION || 'ap-northeast-1';

/**
 * Permission-Aware Search Tool for Strands Agents.
 *
 * Performs KB vector search with SID-based permission filtering.
 * Only returns documents the user has access to (Fail-Closed).
 */
export const permissionAwareSearch = tool({
  name: 'permission_aware_search',
  description:
    'Search the knowledge base for relevant documents. Results are automatically filtered ' +
    'based on the user\'s access permissions (SID/UID/GID). Only documents the user is ' +
    'authorized to view will be returned. Use this tool when the user asks questions about ' +
    'documents, reports, policies, or any information stored in the file system.',
  inputSchema: z.object({
    query: z.string().describe('The search query to find relevant documents'),
    userId: z.string().describe('The user ID (email) for permission filtering'),
    maxResults: z.number().optional().default(10).describe('Maximum number of results to retrieve'),
  }),
  callback: async (input) => {
    const { query, userId, maxResults } = input;

    if (!KB_ID) {
      return 'Error: Knowledge Base ID is not configured. Set BEDROCK_KB_ID environment variable.';
    }

    try {
      // Step 1: Retrieve from KB
      const kbClient = new BedrockAgentRuntimeClient({ region: REGION });
      const response = await kbClient.send(new RetrieveCommand({
        knowledgeBaseId: KB_ID,
        retrievalQuery: { text: query },
        retrievalConfiguration: {
          vectorSearchConfiguration: { numberOfResults: maxResults },
        },
      }));

      const results = response.retrievalResults || [];
      if (results.length === 0) {
        return 'No documents found matching the query.';
      }

      // Step 2: Parse results
      const parsedResults = results.map(r => ({
        content: r.content?.text || '',
        s3Uri: r.location?.s3Location?.uri || '',
        score: r.score,
        metadata: (r.metadata || {}) as Record<string, unknown>,
      }));

      // Step 3: Apply SID permission filtering (Fail-Closed)
      const { allowed, filterLog } = await filterByPermissions(userId, parsedResults);

      if (allowed.length === 0) {
        return 'No documents found that you have permission to access for this query.';
      }

      // Step 4: Format results for the Agent
      const formattedResults = allowed.map((doc, i) => {
        return `[Document ${i + 1}: ${doc.fileName}]\n${doc.content}`;
      }).join('\n\n---\n\n');

      const summary = `Found ${allowed.length} accessible document(s) out of ${results.length} total results.`;

      return `${summary}\n\n${formattedResults}`;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('[PermissionAwareSearch] Error:', errMsg);
      return `Search failed: ${errMsg}`;
    }
  },
});
