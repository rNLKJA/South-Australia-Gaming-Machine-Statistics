import { describe, expect, it } from "vitest"

import { rehypeTypography, smartQuotes } from "./typography"

describe("typography", () => {
  it("curls quotes and apostrophes", () => {
    expect(smartQuotes(`What I'd change`)).toBe("What I’d change")
    expect(smartQuotes(`the visitor's key`)).toBe("the visitor’s key")
    expect(smartQuotes(`Text-to-SQL ("Ask the data")`)).toBe("Text-to-SQL (“Ask the data”)")
    expect(smartQuotes(`'quoted' word`)).toBe("‘quoted’ word")
    expect(smartQuotes(`"`, false)).toBe("”")
  })

  it("leaves code alone and subscripts d_z in a hast tree", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "p",
          children: [
            { type: "text", value: `It's d_z = 1.01 and "fine"` },
            { type: "element", tagName: "code", children: [{ type: "text", value: `'raw'` }] },
          ],
        },
      ],
    }
    rehypeTypography()(tree)
    const p = tree.children[0] as unknown as {
      children: { type: string; value?: string; tagName?: string; children?: { value: string }[] }[]
    }
    expect(p.children[0].value).toBe("It’s ")
    expect(p.children[1].value).toBe("d")
    expect(p.children[2].tagName).toBe("sub")
    expect(p.children[2].children![0].value).toBe("z")
    expect(p.children[3].value).toBe(" = 1.01 and “fine”")
    expect(p.children[4].tagName).toBe("code")
    expect(p.children[4].children![0].value).toBe("'raw'")
  })
})
