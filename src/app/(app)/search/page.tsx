"use client";

import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FollowButton, UserRow } from "@/components/Follow";
import { Spinner } from "@/components/Spinner";
import { PageHeader } from "@/components/ui";
import { searchUsers } from "@/lib/follows";
import type { UserProfile } from "@/lib/types";

/** Find people by username, like Hevy's search. */
export default function SearchPage() {
  const [text, setText] = useState("");
  const [results, setResults] = useState<{ text: string; users: UserProfile[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const term = text.trim();

  useEffect(() => {
    if (!term) return;
    // Wait for a pause in typing so every keystroke isn't a query.
    const timer = setTimeout(() => {
      searchUsers(term)
        .then((users) => {
          setResults({ text: term, users });
          setError(null);
        })
        .catch((e: Error) => setError(e.message));
    }, 250);
    return () => clearTimeout(timer);
  }, [term]);

  const shown = term && results?.text === term ? results.users : null;

  return (
    <div>
      <PageHeader title="Search" />
      <label className="flex items-center gap-2 rounded-xl bg-surface px-3 focus-within:ring-2 focus-within:ring-accent">
        <Search size={20} className="shrink-0 text-muted" />
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search users"
          aria-label="Search users"
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent py-3 outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
        />
        {text && (
          <button onClick={() => setText("")} aria-label="Clear search" className="p-1 text-muted">
            <X size={18} />
          </button>
        )}
      </label>

      <div className="mt-2">
        {error && <p className="py-4 text-sm text-red-400">{error}</p>}
        {!term ? (
          <p className="py-16 text-center text-muted">Find friends by their username.</p>
        ) : !shown ? (
          !error && <Spinner />
        ) : shown.length === 0 ? (
          <p className="py-16 text-center text-muted">No users found for &ldquo;{term}&rdquo;.</p>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((u) => (
              <UserRow key={u.uid} user={u}>
                <FollowButton target={u} />
              </UserRow>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
