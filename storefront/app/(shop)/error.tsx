'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-bold text-gray-200">Oops</h1>
      <h2 className="mt-4 text-lg font-semibold text-gray-900">Something went wrong</h2>
      <p className="mt-2 text-gray-600 max-w-md text-sm">
        We hit an unexpected error loading this page.
      </p>
      <button onClick={reset} className="mt-6 bg-brand text-white px-6 py-3 rounded-lg font-medium hover:bg-brand/90">
        Try Again
      </button>
    </div>
  );
}
