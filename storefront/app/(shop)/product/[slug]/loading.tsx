export default function ProductLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="aspect-square bg-gray-200 rounded-xl" />
        <div className="space-y-4">
          <div className="h-6 w-2/3 bg-gray-200 rounded" />
          <div className="h-8 w-1/4 bg-gray-200 rounded" />
          <div className="h-4 w-full bg-gray-200 rounded" />
          <div className="h-4 w-5/6 bg-gray-200 rounded" />
          <div className="mt-8 h-12 w-full bg-gray-200 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
