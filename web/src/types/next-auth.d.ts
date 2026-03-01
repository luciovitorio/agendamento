import NextAuth, { DefaultSession, DefaultUser } from "next-auth";
import "next-auth/jwt";

// Define the Role enum manually or import from Prisma,
// but since we want clean types, let's keep it aligned.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    id: string;
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
  }
}
