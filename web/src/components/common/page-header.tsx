import type { ReactNode } from "react"

export function PageHeader({
  kicker,
  title,
  children,
}: {
  kicker: string
  title: string
  children?: ReactNode
}) {
  return (
    <header className="pt-10 pb-8 sm:pt-14">
      <p className="kicker text-terracotta">{kicker}</p>
      <h1 className="mt-3 max-w-4xl text-4xl leading-[1.08] font-semibold sm:text-5xl">{title}</h1>
      {children ? (
        <div className="mt-5 max-w-[68ch] space-y-3 text-lg leading-relaxed text-ink-soft">
          {children}
        </div>
      ) : null}
    </header>
  )
}

export function SectionHeading({
  id,
  kicker,
  title,
  children,
}: {
  id?: string
  kicker?: string
  title: string
  children?: ReactNode
}) {
  return (
    <div className="mb-5 max-w-[72ch]">
      {kicker ? <p className="kicker mb-2 text-muted-foreground">{kicker}</p> : null}
      <h2 id={id} className="text-2xl font-semibold sm:text-[1.7rem]">
        {title}
      </h2>
      {children ? (
        <div className="mt-2 space-y-2 leading-relaxed text-ink-soft">{children}</div>
      ) : null}
    </div>
  )
}
