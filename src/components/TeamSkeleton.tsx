export function TeamSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="bg-gray-800/50 rounded-xl p-4 flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-full bg-gray-700" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-gray-700 rounded" />
            <div className="h-3 w-48 bg-gray-700/60 rounded" />
          </div>
          <div className="h-8 w-20 bg-gray-700 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
