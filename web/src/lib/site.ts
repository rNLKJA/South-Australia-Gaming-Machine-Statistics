export const site = {
  name: "SA Gaming Machine Statistics",
  shortName: "SA Gaming Stats",
  description:
    "An explorer for South Australia's gaming-machine statistics from Consumer and Business Services: statewide revenue and tax, councils, licences and manufacturers, FY 2009/10 to FY 2024/25.",
  repo: "https://github.com/rNLKJA/South-Australia-Gaming-Machine-Statistics",
  author: "Sunchuangyu (Rin) Huang",
  authorHandle: "rNLKJA",
  cbsUrl: "https://www.cbs.sa.gov.au/sections/LGL/gaming-statistics",
  cbsName: "Consumer and Business Services, Government of South Australia",
  helpLine: "1800 858 858",
  helpLineHref: "tel:1800858858",
  helpOnline: "https://www.gamblinghelponline.org.au",
} as const

export const nav = [
  {
    href: "/statewide",
    label: "Statewide",
    description: "Monthly revenue, tax, machines and venues",
  },
  { href: "/councils", label: "Councils", description: "Map and ranking by local government area" },
  {
    href: "/licences",
    label: "Licences",
    description: "Entitlements and live machines by category",
  },
  { href: "/manufacturers", label: "Manufacturers", description: "Market share and concentration" },
  {
    href: "/analysis",
    label: "Analysis",
    description: "Trends, councils and concentration with intervals",
  },
  { href: "/ask", label: "Ask", description: "Read-only SQL, optional AI with your own key" },
  { href: "/methods", label: "Methods", description: "Methods, decision records and model cards" },
  { href: "/data-quality", label: "Data quality", description: "Checks, gaps and corrections" },
  { href: "/downloads", label: "Downloads", description: "Tidy CSVs with attribution" },
  { href: "/tour", label: "Tour", description: "Recorded walkthroughs and screenshots" },
] as const

/** The data sections (everything in the nav except the guided tour). */
export const sections = nav.filter((n) => n.href !== "/tour")
