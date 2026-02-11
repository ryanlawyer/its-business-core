import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Validate NEXTAUTH_SECRET at startup - reject placeholder values
// Skip validation during Next.js build phase (page data collection)
const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
if (!isBuildPhase && process.env.NODE_ENV === 'production' && (!secret || secret === 'change-this-to-a-random-secret-in-production')) {
  throw new Error('NEXTAUTH_SECRET must be set to a strong random value in production');
}

// In-memory rate limiter for login attempts
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(email);

  if (!record || now > record.resetAt) {
    loginAttempts.set(email, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    return false;
  }

  record.count++;
  return true;
}

function resetRateLimit(email: string): void {
  loginAttempts.delete(email);
}

// JWT re-validation interval (5 minutes)
const JWT_REVALIDATION_INTERVAL_MS = 5 * 60 * 1000;

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret,
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

        const email = (credentials.email as string).toLowerCase().trim();

        // Rate limiting
        if (!checkRateLimit(email)) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            department: true,
            role: true,
          },
        });

        if (!user || !user.isActive || !user.role || !user.password) {
          return null;
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValidPassword) {
          return null;
        }

        // Successful login - reset rate limit
        resetRateLimit(email);

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
        token.lastValidated = Date.now();
        // Legacy support
        token.role = user.roleCode;
      }

      // Re-validate permissions every 5 minutes
      const lastValidated = (token.lastValidated as number) || 0;
      if (token.id && Date.now() - lastValidated > JWT_REVALIDATION_INTERVAL_MS) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            include: { role: true, department: true },
          });

          if (!dbUser || !dbUser.isActive || !dbUser.role) {
            // User deactivated or role removed - invalidate token
            return { ...token, id: null };
          }

          // Update token with current permissions
          token.roleId = dbUser.roleId;
          token.roleCode = dbUser.role.code;
          token.roleName = dbUser.role.name;
          token.departmentId = dbUser.departmentId;
          token.departmentName = dbUser.department?.name;
          token.permissions = dbUser.role.permissions;
          token.role = dbUser.role.code;
          token.lastValidated = Date.now();
        } catch {
          // DB error - keep existing token, try again next time
        }
      }

      return token;
    },
    async session({ session, token }) {
      // If token was invalidated (user deactivated), clear session
      if (!token.id) {
        return { ...session, user: undefined } as any;
      }

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
    maxAge: 8 * 60 * 60, // 8 hours
  },
  trustHost: true,
  cookies: {
    sessionToken: {
      name: "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
      },
    },
    callbackUrl: {
      name: "authjs.callback-url",
      options: {
        httpOnly: false,
        sameSite: "lax",
        path: "/",
        secure: false,
      },
    },
    csrfToken: {
      name: "authjs.csrf-token",
      options: {
        httpOnly: false,
        sameSite: "lax",
        path: "/",
        secure: false,
      },
    },
  },
});
