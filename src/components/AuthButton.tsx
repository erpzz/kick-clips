import { signIn, signOut, useSession } from "next-auth/react";

export default function AuthButton() {
  const { data: session, status } = useSession();
  if (status === "loading") return null;

  return session ? (
    <div className="flex items-center gap-3">
      <span className="text-sm opacity-80">
        Signed in as {session.user?.name ?? "Kick user"}
      </span>
      <button onClick={() => signOut()} className="px-3 py-1 rounded border">
        Sign out
      </button>
    </div>
  ) : (
    <button      
      onClick={() => signIn("kick")}
      className="px-4 py-2 rounded bg-[#39ff14] text-gray-900 font-semibold"
    >
      Sign in with Kick
    </button>
  );
}
