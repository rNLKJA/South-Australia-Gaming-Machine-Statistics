"use client"

import { useCallback, useMemo, useSyncExternalStore } from "react"

import { DEFAULT_SETTINGS } from "@/lib/ai/models"
import { aiStore, SETTINGS_EVENT } from "@/lib/ai/settings"
import type { AiSettings, Provider } from "@/lib/ai/types"

interface Snapshot {
  settings: AiSettings
  hasKey: Record<Provider, boolean>
}

const SERVER = JSON.stringify({
  settings: DEFAULT_SETTINGS,
  hasKey: { anthropic: false, openai: false },
} satisfies Snapshot)

function subscribe(onChange: () => void) {
  window.addEventListener(SETTINGS_EVENT, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(SETTINGS_EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}

function snapshot(): string {
  const store = aiStore()
  return JSON.stringify({
    settings: store.getSettings(),
    hasKey: { anthropic: !!store.getKey("anthropic"), openai: !!store.getKey("openai") },
  } satisfies Snapshot)
}

/**
 * AI settings for React. The snapshot says whether a key is saved but never holds the key itself;
 * components read it from the store only at the moment they call the provider.
 */
export function useAiSettings() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => SERVER)
  const snap = useMemo(() => JSON.parse(raw) as Snapshot, [raw])
  const keyFor = useCallback((p: Provider) => aiStore().getKey(p), [])
  return {
    settings: snap.settings,
    hasKey: snap.hasKey[snap.settings.provider],
    hasAnyKey: snap.hasKey.anthropic || snap.hasKey.openai,
    keySaved: snap.hasKey,
    keyFor,
  }
}
