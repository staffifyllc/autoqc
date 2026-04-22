import { NextAuthOptions, getServerSession } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    // Email + password. Rejects the login if the user has no passwordHash
    // on file. Existing users without a password must have one assigned
    // via scripts/set-user-password.ts (admin action) before they can log
    // in. Self-service password reset via email will be added in a
    // follow-up PR once SMTP is configured.
    CredentialsProvider({
      id: "dev-login",
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        const email = credentials.email.toLowerCase().trim();

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
          },
        });

        if (!user) {
          // Timing-equalize against the hash-compare path so attackers
          // cannot distinguish "no such user" from "wrong password".
          await bcrypt.compare(
            credentials.password,
            "$2a$10$abcdefghijklmnopqrstuu.abcdefghijklmnopqrstuvwxyzabcd"
          );
          console.warn("[auth] Rejected login for %s: no such user", email);
          return null;
        }

        if (!user.passwordHash) {
          console.warn(
            "[auth] Rejected login for %s: no password set. Run scripts/set-user-password.ts to assign one.",
            email
          );
          return null;
        }

        const valid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!valid) {
          console.warn("[auth] Rejected login for %s: wrong password", email);
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
    ...(process.env.EMAIL_SERVER_HOST
      ? [
          EmailProvider({
            server: {
              host: process.env.EMAIL_SERVER_HOST,
              port: Number(process.env.EMAIL_SERVER_PORT),
              auth: {
                user: process.env.EMAIL_SERVER_USER,
                pass: process.env.EMAIL_SERVER_PASSWORD,
              },
            },
            from: process.env.EMAIL_FROM || "noreply@autoqc.com",
          }),
        ]
      : []),
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;

        // Attach agency info
        const membership = await prisma.agencyMember.findFirst({
          where: { userId: session.user.id },
          include: { agency: true },
        });
        if (membership) {
          session.user.agencyId = membership.agencyId;
          session.user.agencyName = membership.agency.name;
          session.user.role = membership.role;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    newUser: "/onboarding",
  },
};

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireAgency() {
  const session = await requireAuth();
  if (!session.user.agencyId) {
    throw new Error("No agency found");
  }
  return session;
}
