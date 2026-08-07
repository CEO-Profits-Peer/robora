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
