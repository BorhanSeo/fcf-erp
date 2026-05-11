export default function PaymentsLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-7 w-40 bg-slate-200 rounded-lg" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="fcf-card p-5 space-y-2">
            <div className="h-4 w-20 bg-slate-200 rounded" />
            <div className="h-7 w-28 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
      <div className="fcf-card p-5 h-48 bg-slate-100 rounded-xl" />
    </div>
  );
}
