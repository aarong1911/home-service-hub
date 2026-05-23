// src/components/ui/address-autocomplete.tsx
import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";

export type AddressParts = {
  street: string; city: string; state: string; zip: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (parts: AddressParts) => void;
  placeholder?: string;
  className?: string;
};

type GACComponent = { types: string[]; long_name: string; short_name: string };

declare global {
  interface Window {
    __googlePlacesReady?: boolean;
    __googlePlacesCallbacks?: (() => void)[];
    initGooglePlacesCallback?: () => void;
  }
}

function loadScript(apiKey: string, onReady: () => void) {
  if (window.__googlePlacesReady) { onReady(); return; }
  if (!window.__googlePlacesCallbacks) window.__googlePlacesCallbacks = [];
  window.__googlePlacesCallbacks.push(onReady);
  if (document.querySelector("script[data-google-places]")) return;
  window.initGooglePlacesCallback = () => {
    window.__googlePlacesReady = true;
    window.__googlePlacesCallbacks?.forEach(cb => cb());
    window.__googlePlacesCallbacks = [];
  };
  const s = document.createElement("script");
  s.setAttribute("data-google-places", "true");
  s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGooglePlacesCallback&loading=async`;
  s.async = true;
  document.head.appendChild(s);
}

export function AddressAutocomplete({ value, onChange, onSelect, placeholder = "123 Main St", className }: Props) {
  const inputRef    = useRef<HTMLInputElement>(null);
  const acRef       = useRef<unknown>(null);
  const onSelectRef = useRef(onSelect);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined;
    if (!apiKey) { console.warn("[AddressAutocomplete] VITE_GOOGLE_PLACES_API_KEY not set"); return; }

    let mounted = true;
    acRef.current = null; // always reset on mount

    // Watch for pac-container and fix it — keep watching (don't disconnect)
    // so new containers created on dialog re-open also get fixed
    const observer = new MutationObserver(() => {
      document.querySelectorAll(".pac-container").forEach(pac => {
        const el = pac as HTMLElement;
        if (el.dataset.fixed) return;
        el.dataset.fixed = "true";
        el.style.zIndex = "99999";
        el.style.pointerEvents = "auto";
        el.addEventListener("mousedown", e => e.stopPropagation(), true);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    loadScript(apiKey, () => {
      if (!mounted || !inputRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const google = (window as any).google;
      if (!google?.maps?.places) return;

      // Always create fresh Autocomplete instance on each mount
      const ac = new google.maps.places.Autocomplete(inputRef.current, {
        types: ["address"],
        componentRestrictions: { country: "us" },
        fields: ["address_components"],
      });
      acRef.current = ac;

      ac.addListener("place_changed", () => {
        if (!mounted) return;
        const place = ac.getPlace();
        if (!place?.address_components) return;
        const get      = (t: string) => (place.address_components as GACComponent[]).find(c => c.types.includes(t))?.long_name  ?? "";
        const getShort = (t: string) => (place.address_components as GACComponent[]).find(c => c.types.includes(t))?.short_name ?? "";
        const street = [get("street_number"), get("route")].filter(Boolean).join(" ");
        const city   = get("locality") || get("sublocality") || get("neighborhood");
        const state  = getShort("administrative_area_level_1");
        const zip    = get("postal_code");
        onSelectRef.current({ street, city, state, zip });
        onChangeRef.current(street);
      });
    });

    return () => {
      mounted = false;
      observer.disconnect();
      acRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Input
      ref={inputRef}
      className={className}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
    />
  );
}
