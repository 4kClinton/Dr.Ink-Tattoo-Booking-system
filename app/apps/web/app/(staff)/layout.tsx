import { StaffProviders } from "@/components/providers";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <StaffProviders>{children}</StaffProviders>;
}
