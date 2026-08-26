"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export default function AccountPage() {
	const { user, loading, signIn, signUp, signInWithGoogle, logOut } = useAuth();
	const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaving(true);
		setError(null);
		try {
			if (mode === "signIn") await signIn(email, password);
			else await signUp(email, password);
		} catch (authError) {
			console.error(authError);
			const code = typeof authError === "object" && authError !== null && "code" in authError ? String(authError.code) : "";
			const messages: Record<string, string> = {
				"auth/invalid-credential": "That email or password is incorrect. If you used Google to create the account, use Google sign-in instead.",
				"auth/user-not-found": "No email/password account exists for this email. Create an account first or use Google sign-in.",
				"auth/wrong-password": "That password is incorrect. Try again or create a new account.",
				"auth/email-already-in-use": "This email already has an account. Use the existing password or choose Google sign-in.",
				"auth/weak-password": "Choose a password with at least 6 characters.",
				"auth/operation-not-allowed": "Email/password sign-in is disabled in Firebase Authentication.",
				"auth/invalid-api-key": "Firebase Authentication is not configured correctly for this deployment.",
			};
			setError(messages[code] ?? "Email authentication failed. Check your details and try again.");
		} finally {
			setSaving(false);
		}
	}

	async function googleSignIn() {
		setSaving(true);
		setError(null);
		try {
			await signInWithGoogle();
		} catch (authError) {
			console.error(authError);
			setError("Google sign-in failed. Confirm Google is enabled and localhost is authorized.");
			setSaving(false);
		}
	}

	if (loading) return <main className="mx-auto w-full max-w-lg px-5 py-12"><div className="h-64 animate-pulse rounded-2xl bg-[var(--surface)]" /></main>;

	if (user) return <main className="mx-auto w-full max-w-lg px-5 py-12"><div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Overtone / Account</p><h1 className="mt-3 text-3xl font-semibold">Your account</h1><p className="mt-3 text-sm text-[var(--muted)]">Signed in as {user.email}</p><button type="button" onClick={logOut} className="mt-8 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-semibold hover:border-[var(--accent)] hover:text-[var(--accent)]">Sign out</button><Link href="/log" className="mt-4 block text-center text-sm text-[var(--muted)]">Back to training -&gt;</Link></div></main>;

	return <main className="mx-auto w-full max-w-lg px-5 py-12"><div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Overtone / Account</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Keep your training yours.</h1><p className="mt-3 text-sm leading-6 text-[var(--muted)]">Sign in to keep personal exercises and training data separate.</p>{error && <div role="alert" className="mt-5 rounded-xl border border-[#C97064]/40 bg-[#C97064]/10 px-4 py-3 text-sm text-[#E3A99E]">{error}</div>}<form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-medium">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[#0d1110] px-3 py-3 text-sm outline-none focus:border-[var(--accent)]" /></label><label className="block text-sm font-medium">Password<input required minLength={6} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[#0d1110] px-3 py-3 text-sm outline-none focus:border-[var(--accent)]" /></label><button disabled={saving} className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--accent-ink)] disabled:opacity-50">{saving ? "Working…" : mode === "signIn" ? "Sign in" : "Create account"}</button></form>{mode === "signIn" && <><div className="my-5 flex items-center gap-3 text-xs text-[var(--muted)]"><span className="h-px flex-1 bg-[var(--line)]" /><span>or</span><span className="h-px flex-1 bg-[var(--line)]" /></div><button type="button" onClick={googleSignIn} disabled={saving} className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-3 text-sm font-semibold disabled:opacity-50">{saving ? "Opening Google…" : "Continue with Google"}</button></>}<button type="button" onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")} className="mt-5 w-full text-sm text-[var(--muted)]">{mode === "signIn" ? "New to Overtone? Create an account" : "Already have an account? Sign in"}</button></div></main>;
}
