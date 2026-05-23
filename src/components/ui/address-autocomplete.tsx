// src/components/ui/address-autocomplete.tsx
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

type AddressComponents = {
  street: string;
  city: string;
  state: string;
  zip: string;
  full: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (parts: AddressComponents) => void;
  placeholder?: string;
  className?: string;
};

// Minimal types to avoid @types/google.maps dependency issues
type GACComponent = { types: string[]; long_name: string; short_name: string };
type PlaceResult = { address_components?: GACComponent[]; formatted_address?: string };
type Autocomplete = {
  getPlace: () => PlaceResult;
  addListener: (event: string, handler: () => void) => void;
};

declare global {
  interface Window {
    initGooglePlaces?: () => void;
    google?: {
      maps: {
        places: {
          Autocomplete: new (
            input: HTMLInputElement,
            opts?: object
          ) => Autocomplete;
        };
      };
    };
  }
}

let scriptLoaded = false;
let scriptLoading = false;
const callbacks: (() => void)[] = [];

function loadGooglePlaces(apiKey: string): Promise<void> {
  return new Promise((resolve) => {
    if (scriptLoaded) { resolve(); return; }
    callbacks.push(resolve);
    if (scriptLoading) return;
    scriptLoading = true;
    window.initGooglePlaces = () => {
      scriptLoaded = true;
      callbacks.forEach(cb => cb());
      callbacks.length = 0;
    };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGooglePlaces`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  });
}

export function AddressAutocomplete({
  value, onChange, onSelect,
  placeholder = "123 Main St", className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const acRef    = useRef<Autocomplete | null>(null);
  const [ready, setReady] = useState(scriptLoaded);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined;
    if (!apiKey) return;
    loadGooglePlaces(apiKey).then(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready || !inputRef.current || acRef.current || !window.google) return;

    acRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      componentRestrictions: { country: "us" },
      fields: ["address_components", "formatted_address"],
    });

    acRef.current.addListener("place_changed", () => {
      const place = acRef.current!.getPlace();
      if (!place.address_components) return;

      const get = (type: string) =>
        place.address_components!.find(c => c.types.includes(type))?.long_name ?? "";
      const getShort = (type: string) =>
        place.address_components!.find(c => c.types.includes(type))?.short_name ?? "";

      const street = [get("street_number"), get("route")].filter(Boolean).join(" ");
      const city   = get("locality") || get("sublocality") || get("neighborhood");
      const state  = getShort("administrative_area_level_1");
      const zip    = get("postal_code");

      onSelect({ street, city, state, zip, full: place.formatted_address ?? "" });
      onChange(street);
    });
  }, [ready]);

  return (
    <Input
      ref={inputRef}
      className={className}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      name="address-autocomplete"
    />
  );
}
