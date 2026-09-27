import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";

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
        if (!credentials?.email) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        });

        // For demo convenience, allow demo@impactmedia.org or any valid user
        if (user) {
          return {
            id: user.id,
            email: user.email,
            name: user.name || "Field Officer",
          };
        }

        // Auto-seed demo user if requested
        if (credentials.email === "demo@impactmedia.org") {
          const newUser = await db.user.create({
            data: {
              id: "usr_demo123",
              email: "demo@impactmedia.org",
              name: "Field Officer Elena",
              password: credentials.password || "demo123",
            },
          });
          return {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name || "Field Officer",
          };
        }

        return null;
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
  pages: {
    signIn: "/auth/signin",
  },
  secret: process.env.NEXTAUTH_SECRET || "impact-platform-super-secret-default-key-32chars",
};
