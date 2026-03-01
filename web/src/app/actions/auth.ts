"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function authenticate(
  _prevState: string | undefined,
  formData: FormData,
) {
  try {
    const { email, password } = Object.fromEntries(formData);
    // Explicitly call the credential provider via ID "credentials"
    await signIn("credentials", { email, password, redirectTo: "/admin" });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return "E-mail ou senha incorretos.";
        default:
          return "Erro ao fazer login.";
      }
    }
    // NEXT_REDIRECT errors are thrown to indicate routing, we must rethrow them
    throw error;
  }
}
