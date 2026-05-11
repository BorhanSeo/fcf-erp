export default function ReportsLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-7 w-48 bg-slate-200 rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="fcf-card p-5 space-y-3">
            <div className="h-4 w-20 bg-slate-200 rounded" />
            <div className="h-7 w-28 bg-slate-200 rounded" />
            <div className="h-4 w-full bg-slate-200 rounded" />
            <div className="h-4 w-3/4 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
      <div className="fcf-card p-5 h-64 bg-slate-100 rounded-xl" />
    </div>
  );
}
