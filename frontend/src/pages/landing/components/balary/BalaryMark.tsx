const LANDING_LOGO = "https://res.cloudinary.com/dsbmr3xin/image/upload/v1786656190/bi_scp3ev.png";

export function BalaryMark({ className = "" }: { className?: string }) {
  return <img src={LANDING_LOGO} alt="Balary" className={`balary-landing-wordmark ${className}`.trim()} aria-label="Balary" />;
}
