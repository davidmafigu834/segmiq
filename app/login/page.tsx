import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { postLoginPath } from "@/lib/auth/post-login-redirect";
import AuthShell from "@/components/auth/AuthShell";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session?.userId && session.clientId) {
    redirect(
      postLoginPath({
        role: session.role,
        clientMode: session.clientMode,
        clientId: session.clientId,
      })
    );
  }

  return (
    <AuthShell variant="login">
      <LoginForm />
    </AuthShell>
  );
}
