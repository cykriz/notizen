export default function ShareNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-sm space-y-3 text-center">
        <h1 className="text-2xl font-semibold">Link nicht verfügbar</h1>
        <p className="text-sm text-muted-foreground">
          Dieser Teilen-Link existiert nicht mehr oder ist abgelaufen.
        </p>
      </div>
    </div>
  );
}
