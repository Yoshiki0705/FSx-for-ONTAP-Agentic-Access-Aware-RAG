'use client';

import { useCallback, useEffect, Component, type ReactNode } from 'react';
import { useRegistryStore } from '@/store/useRegistryStore';
import { RegistrySearchBar } from './RegistrySearchBar';
import { RegistryTypeFilter } from './RegistryTypeFilter';
import { RegistryCardGrid } from './RegistryCardGrid';
import { RegistryDetailPanel } from './RegistryDetailPanel';
import { RegistryRegionBadge } from './RegistryRegionBadge';
import { RegistryErrorFallback } from './RegistryErrorFallback';

// ---------------------------------------------------------------------------
// Error Boundary (class component — React requirement)
// ---------------------------------------------------------------------------
interface ErrorBoundaryProps {
  children: ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RegistryErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };
  render() {
    if (this.state.hasError) {
      return (
        <RegistryErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// RegistryPanel — メインコンテナ
// ---------------------------------------------------------------------------

/**
 * Registry タブのメインコンテナ
 * Error Boundary でラップし、他タブへのエラー伝播を防止
 * Requirements: 10.1, 10.3, 10.4, 11.4
 */
export function RegistryPanel() {
  return (
    <RegistryErrorBoundary>
      <RegistryPanelInner />
    </RegistryErrorBoundary>
  );
}

function RegistryPanelInner() {
  const {
    selectedRecord,
    isLoading,
    error,
    nextToken,
    searchQuery,
    resourceTypeFilter,
    setRecords,
    appendRecords,
    setSelectedRecord,
    setLoading,
    setError,
    setNextToken,
    setRegistryRegion,
  } = useRegistryStore();

  // Fetch records from API
  const fetchRecords = useCallback(
    async (query: string, append = false, token?: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const body: Record<string, unknown> = {
          query,
          maxResults: 20,
        };
        if (resourceTypeFilter !== 'all') {
          body.resourceType = resourceTypeFilter;
        }
        if (append && token) {
          body.nextToken = token;
        }

        const res = await fetch('/api/bedrock/agent-registry/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || `Error ${res.status}`);
          return;
        }

        if (append) {
          appendRecords(data.records ?? []);
        } else {
          setRecords(data.records ?? []);
        }
        setNextToken(data.nextToken ?? null);
        if (data.registryRegion) {
          setRegistryRegion(data.registryRegion);
        }
      } catch {
        setError('Failed to connect to Registry service.');
      } finally {
        setLoading(false);
      }
    },
    [resourceTypeFilter, setRecords, appendRecords, setLoading, setError, setNextToken, setRegistryRegion],
  );

  // Initial load
  useEffect(() => {
    fetchRecords('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch when filter changes
  useEffect(() => {
    fetchRecords(searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceTypeFilter]);

  const handleSearch = useCallback(
    (query: string) => {
      fetchRecords(query);
    },
    [fetchRecords],
  );

  const handleLoadMore = useCallback(() => {
    fetchRecords(searchQuery, true, nextToken);
  }, [fetchRecords, searchQuery, nextToken]);

  const handleCardClick = useCallback(
    async (resourceId: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/bedrock/agent-registry/detail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resourceId }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || `Error ${res.status}`);
          return;
        }
        setSelectedRecord(data);
      } catch {
        setError('Failed to load record details.');
      } finally {
        setLoading(false);
      }
    },
    [setSelectedRecord, setLoading, setError],
  );

  // Detail panel open
  if (selectedRecord) {
    return (
      <RegistryDetailPanel
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    );
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center gap-3 mb-4">
        <RegistryRegionBadge />
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <RegistrySearchBar onSearch={handleSearch} />
        <RegistryTypeFilter />
      </div>

      {/* Error */}
      {error && (
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => fetchRecords(searchQuery)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Card grid */}
      {!error && (
        <RegistryCardGrid
          onCardClick={handleCardClick}
          onLoadMore={handleLoadMore}
        />
      )}
    </div>
  );
}
