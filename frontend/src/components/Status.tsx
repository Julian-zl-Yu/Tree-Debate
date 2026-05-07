export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return <div className="status">{label}...</div>;
}

export function ErrorState({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'Something went wrong';
  return <div className="status status-error">{message}</div>;
}
