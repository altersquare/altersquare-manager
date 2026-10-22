"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * A string state mirrored to a URL query param, so filters and tabs survive
 * Back/Forward and can be shared as links. Default values are omitted from the URL.
 */
export function useUrlState<T extends string = string>(
  key: string,
  defaultValue: NoInfer<T>
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(defaultValue);

  // Read after mount to avoid a hydration mismatch with the server render
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get(key);
    if (fromUrl !== null) setValue(fromUrl as T);
  }, [key]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      const params = new URLSearchParams(window.location.search);
      if (next === defaultValue || next === "") params.delete(key);
      else params.set(key, next);
      const qs = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    },
    [key, defaultValue]
  );

  return [value, update];
}
