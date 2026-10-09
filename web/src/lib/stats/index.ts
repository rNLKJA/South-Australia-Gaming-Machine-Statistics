/**
 * Small numeric helpers shared by the domain modules. The inference toolkit behind the Analysis
 * pages lives next to this file and is imported by path (`@/lib/stats/ols`, `@/lib/stats/stl`, ...)
 * so client bundles only pull in what they use.
 */
export * from "./basic"
