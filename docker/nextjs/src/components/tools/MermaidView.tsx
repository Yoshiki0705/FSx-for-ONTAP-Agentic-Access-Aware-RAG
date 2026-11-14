'use client';
/**
 * Renders Mermaid source to SVG in the browser. securityLevel "strict" makes Mermaid encode
 * HTML in labels and disable click handlers; the server already strips click lines and
 * init directives (lib/genu-tools/prompts.ts extractMermaid).
 */
import { useEffect, useId, useState } from 'react';

export function MermaidView({ code, onSvg, errorLabel }: { code: string; onSvg?: (svg: string) => void; errorLabel: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' });
        const out = await mermaid.render(`mermaid-${id}`, code);
        if (!cancelled) {
          setSvg(out.svg);
          setError('');
          onSvg?.(out.svg);
        }
      } catch (e) {
        if (!cancelled) {
          setSvg('');
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, id, onSvg]);

  if (error) {
    return (
      <p role="alert" className="text-sm text-red-700 dark:text-red-300">
        {errorLabel}: {error}
      </p>
    );
  }
  return (
    <div
      className="overflow-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white p-4"
      // Mermaid's output with securityLevel "strict" (sanitized by Mermaid's bundled DOMPurify).
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
