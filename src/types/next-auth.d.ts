import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roleId: string;
      roleCode: string;
      roleName: string;
      departmentId: string | null;
      departmentName: string | null;
      permissions: string;
      // Legacy support
      role?: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    roleId: string;
    roleCode: string;
    roleName: string;
    departmentId?: string | null;
    departmentName?: string | null;
    permissions: string;
    // Legacy support
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    roleId: string;
    roleCode: string;
    roleName: string;
    departmentId?: string | null;
    departmentName?: string | null;
    permissions: string;
    // Legacy support
    role?: string;
  }
}
