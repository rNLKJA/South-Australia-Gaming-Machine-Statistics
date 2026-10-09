import { describe, expect, it } from "vitest"

import { downloadByFile, downloads } from "./downloads"

describe("downloads", () => {
  const files = downloads()

  it("builds every file with a header row and the advertised row count", () => {
    for (const f of files.filter((x) => x.file.endsWith(".csv"))) {
      const lines = f.body().trimEnd().split("\r\n")
      expect(lines[0].split(",")).toEqual(f.columns)
      expect(lines.length - 1).toBe(f.rows)
    }
  })

  it("keeps combined groups whole in the council table", () => {
    const body = downloadByFile("lga-published-areas.csv")!.body()
    expect(body).toContain('2013-14,"Barunga West, Copper Coast",group,Barunga West; Copper Coast')
    expect(body).toContain("10277669.86")
  })

  it("ships a read-me with the attribution", () => {
    const readme = downloadByFile("README.txt")!.body()
    expect(readme).toContain("Consumer and Business Services, Government of South Australia")
    expect(readme).toContain("CC BY 4.0")
  })
})
