import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    CredentialsProvider({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: {
            department: true,
            role: true,
          },
        });

        if (!user || !user.isActive || !user.role) {
          return null;
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValidPassword) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roleId: user.roleId,
          roleCode: user.role.code,
          roleName: user.role.name,
          departmentId: user.departmentId,
          departmentName: user.department?.name,
          permissions: user.role.permissions,
          // Legacy support
          role: user.role.code,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.roleId = user.roleId;
        token.roleCode = user.roleCode;
        token.roleName = user.roleName;
        token.departmentId = user.departmentId;
        token.departmentName = user.departmentName;
        token.permissions = user.permissions;
        // Legacy support
        token.role = user.roleCode;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.roleId = token.roleId as string;
        session.user.roleCode = token.roleCode as string;
        session.user.roleName = token.roleName as string;
        session.user.departmentId = token.departmentId as string | null;
        session.user.departmentName = token.departmentName as string | null;
        session.user.permissions = token.permissions as string;
        // Legacy support
        session.user.role = token.roleCode as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
});
