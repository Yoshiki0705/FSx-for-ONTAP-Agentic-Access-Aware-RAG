import { useMemo } from 'react';

/**
 * ARIA属性を生成するフック
 * アクセシビリティ属性を一元管理
 */
export function useAriaLabel(
  label: string,
  options?: {
    describedBy?: string;
    required?: boolean;
    invalid?: boolean;
    disabled?: boolean;
    expanded?: boolean;
    controls?: string;
    hasPopup?: boolean | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';
  }
) {
  return useMemo(() => {
    const ariaProps: Record<string, string | boolean | undefined> = {
      'aria-label': label,
    };

    if (options?.describedBy) {
      ariaProps['aria-describedby'] = options.describedBy;
    }

    if (options?.required) {
      ariaProps['aria-required'] = 'true';
    }

    if (options?.invalid) {
      ariaProps['aria-invalid'] = 'true';
    }

    if (options?.disabled) {
      ariaProps['aria-disabled'] = 'true';
    }

    if (options?.expanded !== undefined) {
      ariaProps['aria-expanded'] = options.expanded ? 'true' : 'false';
    }

    if (options?.controls) {
      ariaProps['aria-controls'] = options.controls;
    }

    if (options?.hasPopup) {
      ariaProps['aria-haspopup'] = options.hasPopup === true ? 'true' : options.hasPopup;
    }

    return ariaProps;
  }, [label, options]);
}
