import { AvatarMenu } from "./AvatarMenu";

/** Header shared by the four tabs: a small line, the screen title, optional actions, and the avatar menu. */
export function TabHeader({
  kicker,
  title,
  actions,
}: {
  kicker?: React.ReactNode;
  title: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-3 border-b border-rpg-line px-5 pb-3.5 pt-5">
      <div className="flex min-w-0 flex-col gap-1">
        {kicker != null && <div className="text-xs text-rpg-muted">{kicker}</div>}
        <h1 className="truncate font-rpg-head text-[34px] font-bold uppercase leading-none">{title}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <AvatarMenu />
      </div>
    </header>
  );
}
