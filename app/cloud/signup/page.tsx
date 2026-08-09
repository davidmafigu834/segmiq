import CloudAuthShell from "@/components/auth/CloudAuthShell";
import CloudSignupForm from "./CloudSignupForm";

export default function CloudSignupPage() {
  return (
    <CloudAuthShell formMaxWidthClass="max-w-[460px]">
      <CloudSignupForm />
    </CloudAuthShell>
  );
}
