export default function SuppliersLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-28 bg-slate-200 rounded-lg" />
          <div className="h-4 w-40 bg-slate-200 rounded mt-2" />
        </div>
        <div className="h-10 w-36 bg-blue-200 rounded-xl" />
      </div>
      <div className="fcf-card p-4">
        <div className="h-9 w-72 bg-slate-200 rounded-lg" />
      </div>
      <div className="fcf-card overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b border-slate-100">
            <div className="h-4 w-28 bg-slate-200 rounded" />
            <div className="h-4 w-24 bg-slate-200 rounded" />
            <div className="h-4 w-20 bg-slate-200 rounded" />
            <div className="h-4 w-20 bg-slate-200 rounded ml-auto" />
            <div className="h-4 w-16 bg-orange-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
