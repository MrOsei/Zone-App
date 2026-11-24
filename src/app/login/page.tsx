import { AuthForm } from "@/components/zone/auth-form";
import { AuthPage } from "@/components/zone/app-shell";

export const metadata = { title: "Sign in" };
export default function LoginPage() { return <AuthPage><AuthForm mode="login" /></AuthPage>; }
