import { NextAuthOptions, getServerSession } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./db";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    // Dev login - no email verification needed
    CredentialsProvider({
      id: "dev-login",
      name: "Dev Login",
      credentials: {
        email: { label: "Email", type: "email" },
        name: { label: "Name", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;

        const email = credentials.email.toLowerCase().trim();
        const name = credentials.name || email.split("@")[0];

        // Find or create user
        let user = await prisma.user.findUnique({
          where: { email },
          include: { agencies: { include: { agency: true } } },
        });

        if (!user) {
          user = await prisma.user.create({
            data: { email, name },
            include: { agencies: { include: { agency: true } } },
          });
        }

        // Create agency if none exists
        if (user.agencies.length === 0) {
          const agency = await prisma.agency.create({
            data: {
              name: `${name}'s Agency`,
              members: {
                create: { userId: user.id, role: "owner" },
              },
            },
          });

          // Create default style profile
          await prisma.styleProfile.create({
            data: {
              agencyId: agency.id,
              name: "Default Style",
              isDefault: true,
            },
          });
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
