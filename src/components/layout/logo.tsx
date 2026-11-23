/** Marca do FORGE: um lingote sobre a bigorna — matéria-prima sendo moldada. */
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="#191D19" stroke="#303730" />
      <path d="M8 19.5h16l-2.2 4.5H10.2z" fill="#596C54" />
      <rect x="9.5" y="9" width="13" height="6.5" rx="1.6" fill="#A5B89B" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="text-[17px] font-[680] tracking-[0.14em] [font-stretch:125%]">FORGE</span>
    </span>
  );
}
