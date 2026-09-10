export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertProductionSecretsOrThrow } = await import("@/lib/security/startup-validation");
    assertProductionSecretsOrThrow();
  }
}
