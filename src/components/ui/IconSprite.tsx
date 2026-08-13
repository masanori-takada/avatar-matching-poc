/**
 * poc/index.html の <symbol> 定義を移植した SVG スプライト。
 * layout.tsx で1回だけレンダリングする。
 * i-cellular / i-wifi / i-battery(端末ステータスバー用の装飾)は移植しない
 * (docs/02-architecture.md §7)。
 */
export function IconSprite() {
  return (
    <svg className="svg-sprite" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
      <symbol id="i-logo" viewBox="0 0 24 24">
        <circle cx="9" cy="12" r="6" />
        <circle cx="15" cy="12" r="6" />
      </symbol>
      <symbol id="i-bell" viewBox="0 0 24 24">
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
        <path d="M13.7 20a2 2 0 0 1-3.4 0" />
      </symbol>
      <symbol id="i-doc" viewBox="0 0 24 24">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h6" />
        <path d="M9 17h4" />
      </symbol>
      <symbol id="i-home" viewBox="0 0 24 24">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V20h14V9.5" />
      </symbol>
      <symbol id="i-user" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
      </symbol>
      <symbol id="i-chat" viewBox="0 0 24 24">
        <path d="M21 12a8 8 0 0 1-8 8H4l2.2-3A8 8 0 1 1 21 12z" />
      </symbol>
      <symbol id="i-shield" viewBox="0 0 24 24">
        <path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z" />
        <path d="M9 12l2 2 4-4" />
      </symbol>
      <symbol id="i-help" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.7.2-1.2.9-1.2 1.6v.5" />
        <path d="M12 17.2h.01" />
      </symbol>
      <symbol id="i-gear" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v2.5" />
        <path d="M12 18.5V21" />
        <path d="M3 12h2.5" />
        <path d="M18.5 12H21" />
        <path d="M5.6 5.6l1.8 1.8" />
        <path d="M16.6 16.6l1.8 1.8" />
        <path d="M18.4 5.6l-1.8 1.8" />
        <path d="M7.4 16.6l-1.8 1.8" />
      </symbol>
      <symbol id="i-check" viewBox="0 0 24 24">
        <path d="M4.5 12.5l5 5 10-11" />
      </symbol>
      <symbol id="i-chevron" viewBox="0 0 24 24">
        <path d="M9 5l7 7-7 7" />
      </symbol>
      <symbol id="i-calendar" viewBox="0 0 24 24">
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
        <path d="M3.5 10h17" />
        <path d="M8 3v4" />
        <path d="M16 3v4" />
      </symbol>
      <symbol id="i-avatar-pair" viewBox="0 0 24 24">
        <circle cx="8" cy="8.5" r="3.2" />
        <circle cx="16" cy="8.5" r="3.2" />
        <path d="M2.5 20c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8" />
        <path d="M10.5 20c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8" />
      </symbol>
      <symbol id="i-lock" viewBox="0 0 24 24">
        <rect x="4.5" y="10" width="15" height="10" rx="2.5" />
        <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
      </symbol>
    </svg>
  );
}

export const ICON_IDS = [
  "i-logo",
  "i-bell",
  "i-doc",
  "i-home",
  "i-user",
  "i-chat",
  "i-shield",
  "i-help",
  "i-gear",
  "i-check",
  "i-chevron",
  "i-calendar",
  "i-avatar-pair",
  "i-lock",
] as const;

export type IconName = (typeof ICON_IDS)[number];

export interface IconProps {
  name: IconName;
  className?: string;
}

/** `<use href="#i-...">` で IconSprite の symbol を参照するアイコン */
export function Icon({ name, className }: IconProps) {
  return (
    <svg className={className ? `icon ${className}` : "icon"} aria-hidden="true" focusable="false">
      <use href={`#${name}`} />
    </svg>
  );
}
