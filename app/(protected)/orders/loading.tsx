export default function OrdersLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-32 bg-slate-200 rounded-lg" />
          <div className="h-4 w-48 bg-slate-200 rounded mt-2" />
        </div>
        <div className="h-10 w-32 bg-blue-200 rounded-xl" />
      </div>
      <div className="fcf-card p-4">
        <div className="flex gap-3">
          <div className="h-9 w-48 bg-slate-200 rounded-lg" />
          <div className="h-9 w-32 bg-slate-200 rounded-lg" />
          <div className="h-9 w-32 bg-slate-200 rounded-lg" />
        </div>
      </div>
      <div className="fcf-card overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b border-slate-100">
            <div className="h-4 w-20 bg-slate-200 rounded" />
            <div className="h-4 w-32 bg-slate-200 rounded" />
            <div className="h-4 w-16 bg-slate-200 rounded ml-auto" />
            <div className="h-4 w-16 bg-slate-200 rounded" />
            <div className="h-6 w-16 bg-slate-200 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
