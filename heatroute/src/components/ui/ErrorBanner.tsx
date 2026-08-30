import React from 'react';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/solid';

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onDismiss }) => {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 flex items-start gap-3 shadow-xs">
      <ExclamationTriangleIcon className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1 text-xs text-rose-900 leading-relaxed font-medium">
        {message}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer"
          aria-label="Dismiss error"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

