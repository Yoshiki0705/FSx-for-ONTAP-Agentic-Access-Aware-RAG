'use client';

import { useState, useEffect, useRef, ReactNode } from 'react';

interface ResizableSidebarProps {
  children: ReactNode;
  isOpen: boolean;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
}

export function ResizableSidebar({
  children,
  isOpen,
  minWidth = 240,
  maxWidth = 480,
  defaultWidth = 320,
}: ResizableSidebarProps) {
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // localStorageから幅を復元
  useEffect(() => {
    const savedWidth = localStorage.getItem('sidebar-width');
    if (savedWidth) {
      const parsedWidth = parseInt(savedWidth, 10);
      if (parsedWidth >= minWidth && parsedWidth <= maxWidth) {
        setWidth(parsedWidth);
      }
    }
  }, [minWidth, maxWidth]);

  // サイドバー開閉状態の変更を通知
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('sidebar-toggle', { 
      detail: { isOpen } 
    }));
  }, [isOpen]);

  // サイドバー幅の変更を通知
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('sidebar-resize', { 
      detail: { width } 
    }));
  }, [width]);

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing || !sidebarRef.current) return;

    const newWidth = e.clientX;
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      setWidth(newWidth);
      localStorage.setItem('sidebar-width', newWidth.toString());
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, minWidth, maxWidth]);

  return (
    <div
      ref={sidebarRef}
      className={`${
        isOpen ? '' : 'w-0'
      } transition-all duration-300 overflow-hidden bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 relative`}
      style={{ width: isOpen ? `${width}px` : '0px' }}
    >
      {children}

      {/* リサイズハンドル - より目立つデザイン */}
      {isOpen && (
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize bg-blue-500 hover:bg-blue-600 transition-all z-10 ${
            isResizing ? 'w-2 bg-blue-600' : ''
          }`}
          onMouseDown={handleMouseDown}
          title="← ドラッグして幅を調整 →"
        >
          {/* 視覚的なハンドル - 3つの白い点 */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col space-y-1.5 py-3 px-1">
            <div className="w-1 h-1 bg-white rounded-full"></div>
            <div className="w-1 h-1 bg-white rounded-full"></div>
            <div className="w-1 h-1 bg-white rounded-full"></div>
          </div>
        </div>
      )}
    </div>
  );
}
