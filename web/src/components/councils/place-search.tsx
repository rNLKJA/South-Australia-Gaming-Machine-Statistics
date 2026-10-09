"use client"

import { Loader2, MapPin, Search, X } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"

import { Input } from "@/components/ui/input"

export interface PlaceResult {
  label: string
  detail: string
  lon: number
  lat: number
}

/**
 * Suburb or address search (Photon, via our /api/geocode route). Picking a result tells the
 * explorer where to look; the council is then found locally by point-in-polygon.
 */
export function PlaceSearch({ onPick }: { onPick: (place: PlaceResult) => void }) {
  const [q, setQ] = useState("")
  const [results, setResults] = useState<PlaceResult[]>([])
  const [state, setState] = useState<"idle" | "loading" | "error" | "empty">("idle")
  const [message, setMessage] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const listId = useId()
  const abort = useRef<AbortController | null>(null)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 3) return
    const t = setTimeout(async () => {
      abort.current?.abort()
      const ctrl = new AbortController()
      abort.current = ctrl
      setState("loading")
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(term)}`, {
          signal: ctrl.signal,
        })
        const body = (await res.json()) as { places: PlaceResult[]; error?: string }
        if (!res.ok) {
          setResults([])
          setState("error")
          setMessage(body.error ?? "Search failed.")
          return
        }
        setResults(body.places)
        setActive(body.places.length ? 0 : -1)
        setState(body.places.length ? "idle" : "empty")
        setOpen(true)
      } catch (e) {
        if ((e as Error).name === "AbortError") return
        setState("error")
        setMessage(
          "Place search is unavailable right now. Pick an area on the map or in the table instead."
        )
      }
    }, 350)
    return () => clearTimeout(t)
  }, [q])

  const pick = (p: PlaceResult) => {
    onPick(p)
    setQ(p.label)
    setOpen(false)
  }

  return (
    <div className="relative">
      <label htmlFor={`${listId}-input`} className="kicker mb-1.5 block text-muted-foreground">
        Find a suburb or address
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={`${listId}-input`}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            if (e.target.value.trim().length < 3) {
              setResults([])
              setOpen(false)
              setState("idle")
            }
          }}
          onFocus={() => results.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (!open || !results.length) return
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setActive((a) => (a + 1) % results.length)
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setActive((a) => (a - 1 + results.length) % results.length)
            } else if (e.key === "Enter" && active >= 0) {
              e.preventDefault()
              pick(results[active])
            } else if (e.key === "Escape") {
              setOpen(false)
            }
          }}
          placeholder="e.g. Mawson Lakes, or 1 King William St"
          className="h-9 bg-card pr-8 pl-8"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
        />
        {state === "loading" ? (
          <Loader2
            className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-label="Searching"
          />
        ) : q ? (
          <button
            type="button"
            onClick={() => {
              setQ("")
              setResults([])
              setOpen(false)
              setState("idle")
            }}
            className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      {open && results.length ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-lg"
        >
          {results.map((r, i) => (
            <li
              key={`${r.label}-${r.lon}-${r.lat}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(r)
              }}
              onMouseEnter={() => setActive(i)}
              className="flex cursor-pointer items-start gap-2 px-3 py-2 text-sm aria-selected:bg-accent"
            >
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-teal" aria-hidden />
              <span>
                <span className="font-medium">{r.label}</span>{" "}
                <span className="text-muted-foreground">{r.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-1 min-h-4 text-xs text-muted-foreground" aria-live="polite">
        {state === "error"
          ? message
          : state === "empty"
            ? "No South Australian places matched."
            : "Search by OpenStreetMap Photon."}
      </p>
    </div>
  )
}
