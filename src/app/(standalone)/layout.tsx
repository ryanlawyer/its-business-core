import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Time Clock — ITS",
  description: "Quick clock in and out",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Clock",
  },
};

export default function StandaloneLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
