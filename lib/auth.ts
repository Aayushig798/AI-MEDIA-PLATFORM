import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export const DEMO_USER_ID = "usr_demo123";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Field Officer Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "demo@impactmedia.org" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        const user = await db.user.findUnique({ where: { email: credentials.email.toLowerCase() } });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name || "Field Officer" };
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

/**
 * The user acting on this request. Signing in is optional for the demo, so
 * anonymous requests act as the seeded demo field officer; the ledger records
 * which one it was.
 */
export async function getActor(): Promise<{ id: string; label: string; signedIn: boolean }> {
  const session = await getServerSession(authOptions);
  const id = (session?.user as any)?.id as string | undefined;
  if (id) return { id, label: session?.user?.email || id, signedIn: true };
  return { id: DEMO_USER_ID, label: `${DEMO_USER_ID} (anonymous demo session)`, signedIn: false };
}
