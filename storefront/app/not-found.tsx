import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-gray-200">404</h1>
      <h2 className="mt-4 text-xl font-semibold text-gray-900">Page Not Found</h2>
      <p className="mt-2 text-gray-600 max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link href="/" className="mt-6 inline-block bg-brand text-white px-6 py-3 rounded-lg font-medium hover:bg-brand/90">
        Back to Shop
      </Link>
    </div>
  );
}
