export interface LoadingOverlayProps {
  text: string;
}

/** poc/index.html の .loading を移植した全画面ローディング演出 */
export function LoadingOverlay({ text }: LoadingOverlayProps) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span className="loading__text">{text}</span>
    </div>
  );
}
