"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown, Plus, Search } from "lucide-react";
import { CreateClientModal } from "@/components/dashboard/CreateClientModal";

const SECTIONS = new Set([
  "team",
  "facebook",
  "settings",
  "projects",
  "profile",
  "testimonials",
  "form",
  "instant-forms",
  "campaigns",
  "audiences",
]);

export type PlatformClientOption = { id: string; name: string };

/** Hide the shell title when the organisation header already names the page. */
export function platformShellHidesTitle(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "dashboard" || parts[1] !== "clients" || parts.length < 3) return false;
  return parts.length <= 4;
}

function clientIdFromPath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "dashboard" || parts[1] !== "clients" || !parts[2]) return null;
  return parts[2];
}

function hrefForClient(pathname: string, id: string) {
  const parts = pathname.split("/").filter(Boolean);
  const section = parts[3];
  if (section && SECTIONS.has(section) && parts.length === 4) return `/dashboard/clients/${id}/${section}`;
  return `/dashboard/clients/${id}`;
}

export function PlatformClientSwitcher({ clients }: { clients: PlatformClientOption[] }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const currentId = clientIdFromPath(pathname);
  const current = clients.find((client) => client.id === currentId) ?? null;

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-client-switcher]")) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () => clients.filter((client) => client.name.toLowerCase().includes(needle)),
    [clients, needle]
  );

  function go(id: string) {
    setOpen(false);
    setQuery("");
    router.push(hrefForClient(pathname, id));
  }

  return (
    <div className="pc-switch" data-client-switcher="">
      <button
        type="button"
        className="re-top-btn re-top-property"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={current ? `Current client, ${current.name}` : "Clients"}
        onClick={() => {
          setOpen((value) => !value);
          setQuery("");
        }}
      >
        <Building2 size={14} strokeWidth={2} aria-hidden />
        <span className="re-top-screen">{current?.name ?? "Clients"}</span>
        <ChevronsUpDown size={14} strokeWidth={2} aria-hidden className="re-top-swap" />
      </button>
      {open ? (
        <div id={listId} role="dialog" aria-label="Clients" className="re-sb-pop re-top-pop re-top-stock">
          <label className="re-sb-search">
            <Search size={16} strokeWidth={2} aria-hidden />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a client"
              aria-label="Find a client"
            />
            <kbd>Esc</kbd>
          </label>
          <div className="pc-client-list">
            {visible.length > 0 ? (
              visible.map((client) => {
                const selected = client.id === current?.id;
                return (
                  <button
                    key={client.id}
                    type="button"
                    className={selected ? "re-prop is-current" : "re-prop"}
                    aria-current={selected ? "true" : undefined}
                    onClick={() => go(client.id)}
                  >
                    <Building2 size={14} strokeWidth={2} aria-hidden />
                    <span className="re-prop-name">{client.name}</span>
                    {selected ? <Check size={14} strokeWidth={2} aria-hidden /> : null}
                  </button>
                );
              })
            ) : (
              <p className="re-top-empty">{clients.length === 0 ? "No clients yet." : "No clients match."}</p>
            )}
          </div>
          <button
            type="button"
            className="re-top-add"
            onClick={() => {
              setOpen(false);
              setCreating(true);
            }}
          >
            <Plus size={15} strokeWidth={2} aria-hidden />
            <span>New organisation</span>
          </button>
        </div>
      ) : null}
      <CreateClientModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
