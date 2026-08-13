import balaryMark from "../../../../assets/balary-mark.svg";

export function BalaryMark({ className = "" }: { className?: string }) {
  return <img src={balaryMark} alt="Balary" className={`balary-landing-wordmark ${className}`.trim()} aria-label="Balary" />;
}
