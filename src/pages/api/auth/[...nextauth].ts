import NextAuth, { type NextAuthOptions } from "next-auth";

/** Refresh access_token using Kick's OAuth token endpoint */
async function refreshKickAccessToken(token: any) {
  try {
    const res = await fetch("https://id.kick.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.NEXT_PUBLIC_KICK_CLIENT_ID!,
        client_secret: process.env.KICK_CLIENT_SECRET!,
        refresh_token: token.refresh_token as string,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw data;

    const expiresIn = Number(data.expires_in ?? 3600);
    return {
      ...token,
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? token.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

/** Exported so we can reuse in getServerSession() */
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    {
      id: "kick",
      name: "Kick",
      type: "oauth",
      checks: ["pkce", "state"],
      client: { token_endpoint_auth_method: "client_secret_post" },
      authorization: {
        url: "https://id.kick.com/oauth/authorize",
        params: { response_type: "code", scope: "user:read" },
        // If Kick forces explicit redirect_uri on authorize, you can add:
        // params: {
        //   response_type: "code",
        //   scope: "user:read",
        //   redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/callback/kick`,
        // },
      },
      token: "https://id.kick.com/oauth/token",     // ← no manual params here
      userinfo: "https://api.kick.com/public/v1/users",
      clientId: process.env.NEXT_PUBLIC_KICK_CLIENT_ID!,
      clientSecret: process.env.KICK_CLIENT_SECRET!,
      async profile(raw: any) {
        const u = Array.isArray(raw?.data) ? raw.data[0] : raw;
        return {
          id: String(u?.user_id ?? ""),
          name: u?.name ?? null,
          email: u?.email ?? null,
          image: u?.profile_picture ?? null,
        };
      },
    } as any,
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        const expiresAt =
          (account as any).expires_at ??
          Math.floor(Date.now() / 1000) + Number((account as any).expires_in || 3600);
        token.access_token = account.access_token;
        token.refresh_token = account.refresh_token;
        token.expires_at = expiresAt;
      }

      // still valid?
      if (token.expires_at && Date.now() / 1000 < (token.expires_at as number) - 60) {
        return token;
      }

      // refresh if we can
      if (token.refresh_token) {
        return await refreshKickAccessToken(token);
      }

      return token;
    },
    async session({ session, token }) {
      // OPTIONAL: only keep if you need client-side Kick API calls
      // (session as any).accessToken = token.access_token;

      (session as any).error = token.error;
      (session.user as any).id = token.sub ?? null; // handy for DB ops
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return "/new-feed";
      else if (url.startsWith(baseUrl)) return "/new-feed";
      return baseUrl;
    }
  },
  // debug: true,
};

export default NextAuth(authOptions);
