import { useState } from "react";
import { Landmark } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

type Method = "magic" | "password";

export default function Auth() {
  const [method, setMethod] = useState<Method>("password");
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [googleError, setGoogleError] = useState("");

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("sent");
    }
  }

  async function signInWithGoogle() {
    setGoogleError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setGoogleError(error.message);
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");
    setInfoMsg("");

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setStatus("error");
        setErrorMsg(error.message);
      } else if (!data.session) {
        setStatus("idle");
        setInfoMsg("Konto erstellt. Bestätige deine E-Mail-Adresse über den Link, den wir dir geschickt haben, und logg dich danach ein.");
      }
      // if a session came back immediately, onAuthStateChange in App.tsx logs the user in
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus("error");
        setErrorMsg(error.message);
      }
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 p-6 text-center">
        <Landmark className="h-10 w-10 text-terracotta" strokeWidth={1.5} />
        <h1 className="font-display text-xl font-semibold text-parchment">Supabase ist noch nicht verbunden</h1>
        <p className="text-sm text-parchment-dim">
          Trage <code className="rounded bg-parchment/10 px-1.5 py-0.5">VITE_SUPABASE_URL</code> und{" "}
          <code className="rounded bg-parchment/10 px-1.5 py-0.5">VITE_SUPABASE_ANON_KEY</code> in deiner{" "}
          <code className="rounded bg-parchment/10 px-1.5 py-0.5">.env</code> ein und starte den Server neu.
          Details stehen in der README.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-terracotta/25 bg-ink-2 font-display text-3xl text-gold shadow-lg shadow-black/40">
          R
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-parchment">ROBORA</h1>
        <p className="mt-1 text-sm text-parchment-dim">Deine Vokabeln & Grammatik, immer griffbereit.</p>
      </div>

      <button
        onClick={signInWithGoogle}
        className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-parchment/15 bg-ink-2 px-4 py-3 text-sm font-medium text-parchment active:scale-[0.98]"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.07 7.94-2.9l-3.88-3.01c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.95H1.26v3.11A12 12 0 0 0 12 24Z"
          />
          <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.6H1.26a12 12 0 0 0 0 10.8l4.01-3.11Z" />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.6l4.01 3.11C6.22 6.86 8.87 4.75 12 4.75Z"
          />
        </svg>
        Mit Google anmelden
      </button>
      {googleError && <p className="text-center text-xs text-red-400">{googleError}</p>}

      <div className="flex w-full items-center gap-3 text-xs text-parchment-dim/50">
        <div className="h-px flex-1 bg-parchment/10" />
        oder
        <div className="h-px flex-1 bg-parchment/10" />
      </div>

      <div className="flex w-full rounded-xl bg-ink-2 p-1">
        {(["password", "magic"] as Method[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMethod(m);
              setStatus("idle");
              setErrorMsg("");
              setInfoMsg("");
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              method === m ? "bg-terracotta text-ink" : "text-parchment-dim"
            }`}
          >
            {m === "password" ? "Passwort" : "Magic Link"}
          </button>
        ))}
      </div>

      {method === "magic" ? (
        status === "sent" ? (
          <div className="w-full rounded-xl border border-parchment/10 bg-ink-2 p-4 text-center text-sm text-parchment-dim">
            Link verschickt an <span className="font-medium text-parchment">{email}</span>. Öffne dein E-Mail-Postfach zum Einloggen.
          </div>
        ) : (
          <form onSubmit={sendLink} className="w-full space-y-3">
            <input
              type="email"
              required
              placeholder="deine@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-parchment/10 bg-ink-2 px-4 py-3 text-sm text-parchment outline-none placeholder:text-parchment-dim/50 focus:border-terracotta"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-xl bg-terracotta px-4 py-3 text-sm font-semibold text-ink shadow-lg shadow-black/30 transition active:scale-[0.98] disabled:opacity-50"
            >
              {status === "sending" ? "Sende Link…" : "Magic Link senden"}
            </button>
            {status === "error" && <p className="text-center text-xs text-red-400">{errorMsg}</p>}
          </form>
        )
      ) : (
        <form onSubmit={submitPassword} className="w-full space-y-3">
          <input
            type="email"
            required
            placeholder="deine@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-parchment/10 bg-ink-2 px-4 py-3 text-sm text-parchment outline-none placeholder:text-parchment-dim/50 focus:border-terracotta"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-parchment/10 bg-ink-2 px-4 py-3 text-sm text-parchment outline-none placeholder:text-parchment-dim/50 focus:border-terracotta"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full rounded-xl bg-terracotta px-4 py-3 text-sm font-semibold text-ink shadow-lg shadow-black/30 transition active:scale-[0.98] disabled:opacity-50"
          >
            {status === "sending" ? "Bitte warten…" : isSignUp ? "Konto erstellen" : "Einloggen"}
          </button>
          {status === "error" && <p className="text-center text-xs text-red-400">{errorMsg}</p>}
          {infoMsg && <p className="text-center text-xs text-emerald-400">{infoMsg}</p>}
          <button
            type="button"
            onClick={() => {
              setIsSignUp((v) => !v);
              setErrorMsg("");
              setInfoMsg("");
            }}
            className="w-full text-center text-xs text-parchment-dim"
          >
            {isSignUp ? "Schon ein Konto? Einloggen" : "Noch kein Konto? Registrieren"}
          </button>
        </form>
      )}
    </div>
  );
}
