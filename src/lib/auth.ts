import NextAuth from "next-auth";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    {
      id: "authentik",
      name: "Authentik",
      type: "oidc",
      issuer: process.env.AUTH_AUTHENTIK_ISSUER,
      clientId: process.env.AUTH_AUTHENTIK_ID,
      clientSecret: process.env.AUTH_AUTHENTIK_SECRET,
      authorization: { params: { scope: "openid email profile role github_username" } },
    },
  ],
  callbacks: {
    jwt({ token, profile }) {
      if (profile) {
        token.role = (profile as { role?: string }).role ?? "member";
        token.githubUsername =
          (profile as { github_username?: string }).github_username ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role = (token.role as string) ?? "member";
        session.user.githubUsername = token.githubUsername ?? null;
      }
      return session;
    },
  },
});
