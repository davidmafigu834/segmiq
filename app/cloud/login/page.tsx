import CloudAuthShell from "@/components/auth/CloudAuthShell";
import CloudLoginForm from "./CloudLoginForm";

export default function CloudLoginPage() {
  return (
    <CloudAuthShell>
      <CloudLoginForm />
    </CloudAuthShell>
  );
}
