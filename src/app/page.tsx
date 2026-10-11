"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Spinner } from "@/components/Spinner";

export default function Home() {
  const { user, profile, loading, signIn } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    router.replace(profile ? "/home" : "/onboarding");
  }, [loading, user, profile, router]);

  if (loading || user) return <Spinner />;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Do You Even Log, Bro?</h1>
        <p className="mt-2 text-muted">
          Track sets, reps and weight. Free, no subscription.
        </p>
      </div>
      <button
        onClick={() => signIn().catch((e: Error) => setError(e.message))}
        className="rounded-xl bg-white py-3 font-semibold text-zinc-900"
      >
        Continue with Google
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </main>
  );
}
