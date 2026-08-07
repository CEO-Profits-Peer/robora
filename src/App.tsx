import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Mic, Library as LibraryIcon, Camera, Globe2, UserCircle, type LucideIcon } from "lucide-react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import Auth from "./components/Auth";
import Recorder from "./components/Recorder";
import Library from "./components/Library";
import PhotoScan from "./components/PhotoScan";
import Discover from "./components/Discover";
import Account from "./components/Account";
import MiniPlayer from "./components/MiniPlayer";
import { PlayerProvider } from "./context/PlayerContext";

type Tab = "record" | "library" | "scan" | "discover" | "account";

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "record", label: "Aufnehmen", icon: Mic },
  { id: "library", label: "Anhören", icon: LibraryIcon },
  { id: "scan", label: "Foto-Scan", icon: Camera },
  { id: "discover", label: "Entdecken", icon: Globe2 },
  { id: "account", label: "Account", icon: UserCircle },
];

const TAB_TITLES: Record<Tab, string> = {
  record: "Aufnehmen",
  library: "Anhören",
  scan: "Foto-Scan",
  discover: "Entdecken",
  account: "Account",
};

const TAB_DESCRIPTIONS: Record<Tab, string> = {
  record: "Nimm eine neue Vokabel- oder Grammatik-Einheit auf.",
  library: "Deine gespeicherten Aufnahmen, jederzeit abspielbar.",
  scan: "Foto von Vokabeln oder Grammatik → automatische Karten.",
  discover: "Öffentliche Aufnahmen anderer Lernender durchsuchen.",
  account: "Profil und Einstellungen.",
};

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-terracotta/25 bg-ink-3 font-display text-lg text-gold shadow-lg shadow-black/30">
        R
      </div>
      <div>
        <h1 className="font-display text-lg font-semibold leading-tight tracking-tight text-parchment">ROBORA</h1>
        <p className="text-[10px] leading-tight text-parchment-dim/60">by Lorenz Peer</p>
      </div>
    </div>
  );
}

function AppShell({ user }: { user: User }) {
  const [tab, setTab] = useState<Tab>("library");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <PlayerProvider>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-parchment/10 bg-ink-2/60 px-5 py-6 md:flex">
        <Brand />
        <nav className="mt-10 flex flex-1 flex-col gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                tab === t.id ? "bg-terracotta text-ink" : "text-parchment-dim hover:bg-ink-3"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="min-h-screen md:pl-64">
        <div className="mx-auto max-w-md px-4 pb-28 pt-6 md:max-w-3xl md:px-8 md:pt-10 xl:max-w-5xl">
          <header className="mb-6 flex items-center justify-between md:hidden">
            <Brand />
          </header>

          <header className="mb-8 hidden md:block">
            <h2 className="font-display text-2xl font-semibold text-parchment">{TAB_TITLES[tab]}</h2>
            <p className="mt-1 text-sm text-parchment-dim">{TAB_DESCRIPTIONS[tab]}</p>
          </header>

          <main>
            {tab === "record" && (
              <Recorder
                user={user}
                onSaved={() => {
                  setRefreshKey((k) => k + 1);
                  setTab("library");
                }}
              />
            )}
            {tab === "library" && <Library user={user} refreshKey={refreshKey} />}
            {tab === "scan" && <PhotoScan user={user} />}
            {tab === "discover" && <Discover />}
            {tab === "account" && <Account user={user} />}
          </main>
        </div>
      </div>

      <MiniPlayer />

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-parchment/10 bg-ink-2/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] transition ${
                tab === t.id ? "text-gold" : "text-parchment-dim"
              }`}
            >
              <t.icon className="h-5 w-5" />
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </PlayerProvider>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) return null;
  if (!user) return <Auth />;
  return <AppShell user={user} />;
}
