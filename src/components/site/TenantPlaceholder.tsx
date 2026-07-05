export function TenantPlaceholder() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-center">
      <div className="max-w-lg">
        <div className="mx-auto mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg">
          <span className="text-2xl font-black">A</span>
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Academy OS
        </h1>
        <p className="mt-4 text-base text-neutral-400">
          The white-label operating system for sports academies, gyms and coaching centres.
        </p>
        <p className="mt-8 text-xs uppercase tracking-widest text-neutral-500">
          No academy is configured for this URL yet.
        </p>
      </div>
    </div>
  );
}
