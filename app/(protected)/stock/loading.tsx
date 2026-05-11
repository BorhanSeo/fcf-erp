export default function StockLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-40 bg-slate-200 rounded-lg" />
          <div className="h-4 w-48 bg-slate-200 rounded mt-2" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-36 bg-indigo-100 rounded-xl" />
          <div className="h-10 w-28 bg-blue-200 rounded-xl" />
        </div>
      </div>
      <div className="fcf-card p-4">
        <div className="flex gap-3">
          <div className="h-9 w-48 bg-slate-200 rounded-lg" />
          <div className="h-9 w-32 bg-slate-200 rounded-lg" />
          <div className="h-9 w-32 bg-slate-200 rounded-lg" />
        </div>
      </div>
      <div className="fcf-card overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b border-slate-100">
            <div className="h-4 w-36 bg-slate-200 rounded" />
            <div className="h-4 w-16 bg-slate-200 rounded" />
            <div className="h-5 w-12 bg-green-100 rounded-full mx-auto" />
            <div className="h-4 w-16 bg-slate-200 rounded ml-auto" />
            <div className="h-4 w-16 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
