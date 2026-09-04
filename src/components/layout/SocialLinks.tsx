const LINKS = [
  {
    label: "X",
    href: "https://x.com/Pivahprotocol",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "Telegram Community",
    href: "https://t.me/pivahprotocolofficial",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
        <path d="M21.94 4.36 18.63 20.2c-.25 1.1-.9 1.37-1.83.85l-5.06-3.73-2.44 2.35c-.27.27-.5.5-1.02.5l.36-5.14 9.36-8.46c.41-.36-.09-.56-.63-.2L6.6 12.83l-5.03-1.57c-1.1-.34-1.11-1.1.23-1.63L20.5 3.13c.91-.34 1.7.2 1.44 1.23z" />
      </svg>
    ),
  },
  {
    label: "Telegram Channel",
    href: "https://t.me/Pivahprotocol",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
        <path d="M21.94 4.36 18.63 20.2c-.25 1.1-.9 1.37-1.83.85l-5.06-3.73-2.44 2.35c-.27.27-.5.5-1.02.5l.36-5.14 9.36-8.46c.41-.36-.09-.56-.63-.2L6.6 12.83l-5.03-1.57c-1.1-.34-1.11-1.1.23-1.63L20.5 3.13c.91-.34 1.7.2 1.44 1.23z" />
      </svg>
    ),
  },
] as const;

export function SocialLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {LINKS.map((l) => (
        <a
          key={l.href}
          href={l.href}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={l.label}
          title={l.label}
          className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
        >
          {l.icon}
        </a>
      ))}
    </div>
  );
}
