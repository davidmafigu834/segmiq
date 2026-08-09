import AuthShell from "@/components/auth/AuthShell";
import ForgotPasswordForm from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <AuthShell variant="forgot">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
