"use client"

import { KeyRound, Settings2 } from "lucide-react"
import Link from "next/link"
import { useId, useState } from "react"

import { Segmented } from "@/components/common/segmented"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useAiSettings } from "@/hooks/use-ai-settings"
import { ANTHROPIC_MODELS, DEFAULT_OPENAI_MODEL, KEY_HELP, PROVIDER_LABEL } from "@/lib/ai/models"
import { aiStore } from "@/lib/ai/settings"
import type { AiSettings, Provider } from "@/lib/ai/types"
import { cn } from "@/lib/utils"

/**
 * Bring-your-own-key settings. The key stays in this browser (sessionStorage by default) and goes
 * only to the chosen provider's API. The input is never pre-filled with a saved key.
 */
export function AiSettingsDialog({ className }: { className?: string }) {
  const { settings, keySaved } = useAiSettings()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<AiSettings>(settings)
  const [key, setKey] = useState("")
  const [saved, setSaved] = useState<string | null>(null)
  const ids = { key: useId(), model: useId(), remember: useId() }
  const provider = draft.provider
  const help = KEY_HELP[provider]
  const active = keySaved[settings.provider]

  const onOpenChange = (next: boolean) => {
    if (next) {
      setDraft(aiStore().getSettings())
      setKey("")
      setSaved(null)
    }
    setOpen(next)
  }

  const save = () => {
    const store = aiStore()
    store.saveSettings(draft)
    if (key.trim()) store.setKey(draft.provider, key, draft.remember)
    else if (keySaved[draft.provider]) {
      // move an existing key between session and local storage if the choice changed
      const existing = store.getKey(draft.provider)
      if (existing) store.setKey(draft.provider, existing, draft.remember)
    }
    setKey("")
    setSaved(`Saved. ${PROVIDER_LABEL[draft.provider]} will be used for AI features.`)
  }

  const forget = (p?: Provider) => {
    aiStore().forgetKey(p)
    setSaved(
      p ? `The ${PROVIDER_LABEL[p]} key was removed from this browser.` : "All keys removed."
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={<Button variant="outline" size="default" className={cn("gap-2", className)} />}
      >
        <Settings2 aria-hidden />
        AI settings
        <span
          className={cn(
            "inline-block size-2 rounded-full",
            active ? "bg-teal" : "bg-muted-foreground/40"
          )}
          aria-label={active ? "key saved" : "no key"}
        />
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>AI settings</DialogTitle>
        <DialogDescription>
          AI features on this site are optional and use your own API key. The key stays in this
          browser and is sent only to {PROVIDER_LABEL[provider]}’s API, directly from this page:
          never to this site’s server, never into the AI log. You pay the provider for the tokens
          you use.
        </DialogDescription>

        <Segmented
          label="Provider"
          value={provider}
          onChange={(p) => setDraft({ ...draft, provider: p })}
          options={[
            { value: "anthropic", label: "Anthropic" },
            { value: "openai", label: "OpenAI" },
          ]}
        />

        {provider === "anthropic" ? (
          <fieldset className="space-y-2">
            <legend className="kicker mb-1.5 text-muted-foreground">Model</legend>
            {ANTHROPIC_MODELS.map((m) => (
              <label
                key={m.id}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-lg border p-3",
                  draft.anthropicModel === m.id && "border-foreground bg-accent/50"
                )}
              >
                <input
                  type="radio"
                  name="anthropic-model"
                  value={m.id}
                  checked={draft.anthropicModel === m.id}
                  onChange={() => setDraft({ ...draft, anthropicModel: m.id })}
                  className="mt-1 accent-[var(--teal)]"
                />
                <span>
                  <span className="block font-medium">{m.label}</span>
                  <span className="block text-xs text-muted-foreground">{m.note}</span>
                  <code className="mt-1 block font-mono text-xs text-muted-foreground">{m.id}</code>
                </span>
              </label>
            ))}
          </fieldset>
        ) : (
          <div className="space-y-1.5">
            <label htmlFor={ids.model} className="kicker text-muted-foreground">
              Model id
            </label>
            <Input
              id={ids.model}
              value={draft.openaiModel}
              onChange={(e) => setDraft({ ...draft, openaiModel: e.target.value })}
              placeholder={DEFAULT_OPENAI_MODEL}
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              Any Chat Completions model that supports JSON-schema output. Default{" "}
              <code className="font-mono">{DEFAULT_OPENAI_MODEL}</code>.
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor={ids.key}
            className="kicker flex items-center gap-1.5 text-muted-foreground"
          >
            <KeyRound className="size-3.5" aria-hidden />
            {PROVIDER_LABEL[provider]} API key
          </label>
          <Input
            id={ids.key}
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={
              keySaved[provider] ? "A key is saved (type to replace it)" : `${help.prefix}…`
            }
            autoComplete="off"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            Create one at{" "}
            <a href={help.url} className="link" target="_blank" rel="noreferrer">
              {help.url.replace("https://", "")}
            </a>
            . A key with a low spending limit is a sensible choice.
          </p>
        </div>

        <label htmlFor={ids.remember} className="flex items-start gap-2.5">
          <input
            id={ids.remember}
            type="checkbox"
            checked={draft.remember}
            onChange={(e) => setDraft({ ...draft, remember: e.target.checked })}
            className="mt-0.5 accent-[var(--teal)]"
          />
          <span>
            <span className="font-medium">Remember on this device</span>
            <span className="block text-xs text-muted-foreground">
              Off: the key is kept for this tab only (sessionStorage) and is gone when you close it.
              On: it is kept in this browser’s localStorage until you forget it.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Button onClick={save}>Save</Button>
          <Button variant="outline" onClick={() => forget(provider)} disabled={!keySaved[provider]}>
            Forget {PROVIDER_LABEL[provider]} key
          </Button>
          {keySaved.anthropic && keySaved.openai ? (
            <Button variant="ghost" onClick={() => forget()}>
              Forget all keys
            </Button>
          ) : null}
        </div>
        {saved ? (
          <p role="status" className="text-sm text-teal">
            {saved}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Every AI call is recorded in this browser’s{" "}
          <Link href="/ai-log" className="link" onClick={() => setOpen(false)}>
            AI log
          </Link>{" "}
          (inputs, outputs, model, tokens and what you did with the answer, never the key). How the
          features work and what they never do:{" "}
          <Link href="/methods#ai-use-statement" className="link" onClick={() => setOpen(false)}>
            AI use statement
          </Link>
          .
        </p>
      </DialogContent>
    </Dialog>
  )
}
