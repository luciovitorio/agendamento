import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

async function persistLastLogin(userId: string) {
  await prisma
    .$executeRaw`
      UPDATE "User"
      SET "lastLoginAt" = NOW()
      WHERE "id" = ${userId}
    `
    .catch((error) => {
      console.error("Failed to persist last login timestamp:", error);
    });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email as string,
          },
        });

        if (!user) {
          return null;
        }

        // Block login for non-active users (PENDING = hasn't set password yet, BLOCKED = admin blocked)
        if (user.status !== "ACTIVE") {
          return null;
        }

        // Reject non-bcrypt credentials to avoid plaintext password fallback.
        if (!user.password.startsWith("$2")) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password,
        );

        if (!isPasswordValid) {
          return null;
        }

        // Track the latest successful login without blocking authentication
        await persistLastLogin(user.id);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;

        // Extra safeguard: when a fresh sign-in succeeds, persist last login timestamp.
        await persistLastLogin(user.id as string);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login", // We will build this page
  },
  session: {
    strategy: "jwt",
  },
});
