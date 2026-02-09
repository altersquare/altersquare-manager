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
      authorization: { params: { scope: "openid email profile role" } },
    },
  ],
  callbacks: {
    jwt({ token, profile }) {
      if (profile) {
        token.role = (profile as { role?: string }).role ?? "member";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role = (token.role as string) ?? "member";
      }
      return session;
    },
  },
});
