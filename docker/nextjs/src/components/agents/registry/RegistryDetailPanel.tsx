'use client';

import { useState } from 'react';
import type { RegistryRecordDetail } from '@/types/registry';
import { RegistryImportDialog } from './RegistryImportDialog';

interface RegistryDetailPanelProps {
  record: RegistryRecordDetail;
  onClose: () => void;
}

/**
 * Registry レコード詳細パネル（スライドオーバー）
 * 共通メタデータ + Agent/MCP 固有情報を表示
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */
export function RegistryDetailPanel({ record, onClose }: RegistryDetailPanelProps) {
  const [showImport, setShowImport] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      {/* Back button */}
      <button
        onClick={onClose}
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4"
      >
        ← Back to Registry
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {record.resourceName}
          </h2>
          {record.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {record.description}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div>
          <span className="text-gray-500 dark:text-gray-400">Publisher</span>
          <p className="text-gray-900 dark:text-gray-100">{record.publisherName}</p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Resource Type</span>
          <p className="text-gray-900 dark:text-gray-100">{record.resourceType}</p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Approval Status</span>
          <p className="text-gray-900 dark:text-gray-100">{record.approvalStatus}</p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Invocation Method</span>
          <p className="text-gray-900 dark:text-gray-100">{record.invocationMethod || 'N/A'}</p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Created</span>
          <p className="text-gray-900 dark:text-gray-100">
            {record.createdAt ? new Date(record.createdAt).toLocaleDateString() : 'N/A'}
          </p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Updated</span>
          <p className="text-gray-900 dark:text-gray-100">
            {record.updatedAt ? new Date(record.updatedAt).toLocaleDateString() : 'N/A'}
          </p>
        </div>
      </div>

      {/* Protocols */}
      {record.protocols && record.protocols.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Protocols</h3>
          <div className="flex flex-wrap gap-1">
            {record.protocols.map((p) => (
              <span key={p} className="px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Related Services */}
      {record.relatedServices && record.relatedServices.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Related Services</h3>
          <div className="flex flex-wrap gap-1">
            {record.relatedServices.map((s) => (
              <span key={s} className="px-2 py-0.5 rounded text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Agent-specific info */}
      {record.agentInfo && (
        <div className="mb-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Agent Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Foundation Model</span>
              <p className="text-gray-900 dark:text-gray-100">{record.agentInfo.foundationModel}</p>
            </div>
          </div>
          {record.agentInfo.actionGroups.length > 0 && (
            <div className="mt-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Action Groups</span>
              <ul className="mt-1 space-y-0.5">
                {record.agentInfo.actionGroups.map((ag) => (
                  <li key={ag} className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />{ag}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {record.agentInfo.knowledgeBases.length > 0 && (
            <div className="mt-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Knowledge Bases</span>
              <ul className="mt-1 space-y-0.5">
                {record.agentInfo.knowledgeBases.map((kb) => (
                  <li key={kb} className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />{kb}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* MCP Server-specific info */}
      {record.mcpServerInfo && (
        <div className="mb-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">MCP Server Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Endpoint</span>
              <p className="text-gray-900 dark:text-gray-100 font-mono text-xs break-all">{record.mcpServerInfo.endpointUrl}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Auth Method</span>
              <p className="text-gray-900 dark:text-gray-100">{record.mcpServerInfo.authMethod}</p>
            </div>
          </div>
          {record.mcpServerInfo.tools.length > 0 && (
            <div className="mt-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Tools</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {record.mcpServerInfo.tools.map((tool) => (
                  <span key={tool} className="px-2 py-0.5 rounded text-xs bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        {record.resourceType === 'Agent' && (
          <button
            onClick={() => setShowImport(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            Import Agent
          </button>
        )}
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium"
        >
          Close
        </button>
      </div>

      {/* Import dialog */}
      {showImport && (
        <RegistryImportDialog
          record={record}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
