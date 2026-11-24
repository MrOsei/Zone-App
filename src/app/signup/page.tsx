import { AuthForm } from "@/components/zone/auth-form";
import { AuthPage } from "@/components/zone/app-shell";

export const metadata = { title: "Create your account" };
export default function SignupPage() { return <AuthPage><AuthForm mode="signup" /></AuthPage>; }
