export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12 animate-pulse">
      <div className="h-8 w-48 bg-gray-200 rounded mb-8" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i}>
            <div className="aspect-[3/4] bg-gray-200 rounded-lg" />
            <div className="mt-3 h-4 w-3/4 bg-gray-200 rounded" />
            <div className="mt-2 h-4 w-1/3 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
