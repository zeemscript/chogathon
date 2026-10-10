import Link from "next/link";
import WalletButton from "./WalletButton";

export default function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-night/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-chog shadow-hard transition-transform group-hover:-rotate-6">
            <span className="font-display text-lg text-white">S</span>
          </span>
          <span className="font-display text-2xl tracking-wide">
            Chog <span className="text-gradient">Souls</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          <Link href="/#mine" className="label-mono text-muted-foreground transition-colors hover:text-foreground">
            My Chogs
          </Link>
          <Link href="/#meet" className="label-mono text-muted-foreground transition-colors hover:text-foreground">
            Meet
          </Link>
          <Link href="/town" className="label-mono flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
            <span className="size-1.5 animate-pulse-dot rounded-full bg-chog-pink" />
            Town Square
          </Link>
        </nav>
        <WalletButton />
      </div>
    </header>
  );
}
