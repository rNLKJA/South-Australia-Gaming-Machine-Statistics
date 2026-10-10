# Reference values for the TypeScript STL port (web/src/lib/stats/stl.ts).
#
# Runs R's stats::stl() on two series and writes the components to
# web/src/lib/stats/__fixtures__/stl-reference.json, which stats.test.ts compares against.
#
#   Rscript scripts/stl_reference.R     (from the repository root; needs jsonlite)

suppressPackageStartupMessages(library(jsonlite))

sw <- fromJSON("web/src/data/statewide.json")$rows
post <- sw[sw$month >= "2015-07", ]
ngr <- ts(post$ngr, frequency = 12, start = c(2015, 7))

run <- function(name, x, s.window, robust = FALSE, s.degree = 0, t.window = NULL,
                jump1 = FALSE) {
  args <- list(x = x, s.window = s.window, s.degree = s.degree, robust = robust)
  if (!is.null(t.window)) args$t.window <- t.window
  if (jump1) {
    args$s.jump <- 1
    args$t.jump <- 1
    args$l.jump <- 1
  }
  fit <- do.call(stl, args)
  list(
    name = name,
    x = as.numeric(x),
    period = frequency(x),
    sWindow = s.window,
    sDegree = s.degree,
    tWindow = if (is.null(t.window)) NULL else t.window,
    robust = robust,
    jump1 = jump1,
    used = list(
      sWindow = fit$win[["s"]], tWindow = fit$win[["t"]], lWindow = fit$win[["l"]],
      sJump = fit$jump[["s"]], tJump = fit$jump[["t"]], lJump = fit$jump[["l"]],
      inner = fit$inner, outer = fit$outer
    ),
    seasonal = as.numeric(fit$time.series[, "seasonal"]),
    trend = as.numeric(fit$time.series[, "trend"]),
    remainder = as.numeric(fit$time.series[, "remainder"]),
    weights = as.numeric(fit$weights)
  )
}

cases <- list(
  run("nottem, s.window = 7, R defaults", nottem, 7),
  run("nottem, robust, every point fitted", nottem, 11, robust = TRUE, jump1 = TRUE),
  run("NGR from July 2015, s.window = 13, robust (the Analysis page's call)", ngr, 13,
      robust = TRUE),
  run("NGR from July 2015, every point fitted", ngr, 13, jump1 = TRUE),
  run("NGR from July 2015, seasonal degree 1, t.window = 15, robust", ngr, 9,
      robust = TRUE, s.degree = 1, t.window = 15)
)

out <- list(
  generated_by = "scripts/stl_reference.R",
  r_version = R.version.string,
  cases = cases
)
dir.create("web/src/lib/stats/__fixtures__", showWarnings = FALSE, recursive = TRUE)
write(toJSON(out, auto_unbox = TRUE, digits = NA, null = "null", pretty = FALSE),
      "web/src/lib/stats/__fixtures__/stl-reference.json")
cat("wrote web/src/lib/stats/__fixtures__/stl-reference.json\n")
