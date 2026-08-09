import AuthShell from "@/components/auth/AuthShell";
import ResetPasswordForm from "./ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <AuthShell variant="reset">
      <ResetPasswordForm />
    </AuthShell>
  );
}
