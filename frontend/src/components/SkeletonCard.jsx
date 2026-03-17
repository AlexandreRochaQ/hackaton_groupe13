export default function SkeletonCard({ lines = 4 }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse space-y-3">
      <div className="h-4 bg-slate-200 rounded w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="h-3 bg-slate-100 rounded w-1/4" />
          <div className="h-3 bg-slate-200 rounded w-1/2" />
        </div>
      ))}
    </div>
  )
}
