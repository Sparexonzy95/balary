export function BalaryMark({ className = "" }: { className?: string }) {
  return (
    <span className={`balary-landing-wordmark ${className}`.trim()} aria-label="Balary">
      <span>B</span>alary
    </span>
  );
}
