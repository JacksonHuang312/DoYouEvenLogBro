/**
 * Frame for the RPG tab screens. Paints the fixed RPG background behind the (themed) page, lets
 * the content run edge to edge of the phone, and caps it at a readable width beside the desktop
 * sidebar. Screens inside use 20px side padding.
 */
export function RpgScreen({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div aria-hidden className="fixed inset-0 -z-10 bg-rpg-bg" />
      <div className="-mx-4">
        <div className="mx-auto max-w-[28rem] font-rpg-body text-rpg-text">{children}</div>
      </div>
    </>
  );
}

/** A static stand-in for a value that is still loading (no animation, per 7.1). */
export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`block bg-rpg-line ${className}`} />;
}

/** Copy for a feature that isn't built yet: what it will be, and which phase brings it. */
export function ComingSoon({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-5 py-8">
      <h2 className="font-rpg-head text-xl font-semibold uppercase">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-rpg-text-2">{children}</p>
    </section>
  );
}
