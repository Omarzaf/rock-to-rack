# Content Sources

M2 fact cards use short, classroom-safe summaries from the following current sources.

- USGS, Mineral Commodity Summaries 2026: Cobalt. Used for the DR Congo mined-cobalt share.
  https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-cobalt.pdf
- USGS, Mineral Commodity Summaries 2026: Silicon. Used for silicon metal and polysilicon semiconductor language.
  https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-silicon.pdf
- USGS, Mineral Commodity Summaries 2026: Lithium. Used for lithium demand and production context.
  https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-lithium.pdf
- USGS, Mineral Commodity Summaries 2026: Rare Earths. Used for rare-earth export-control and supply-chain context.
  https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-rare-earths.pdf
- USGS, Mineral Commodity Summaries 2026: Quartz. Used for high-purity quartz context.
  https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-quartz.pdf
- USGS, Mineral Commodity Summaries 2026: Copper. Used for copper electronics/end-use context.
  https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-copper.pdf

M3 refinery copy currently reuses the USGS Silicon summary for polysilicon and purification context, and Intel's 2026 Tech 101 explainer for the 6N-to-9N purity shorthand. Energy, water, recycling, and waste framing is intentionally non-numeric and classroom-level; the game treats refinery modules as approximations rather than facility-scale engineering claims.

- Intel Newsroom, Explaining Common Chip Terms. Used for silicon purity shorthand and general wafer terminology.
  https://newsroom.intel.com/tech101/explaining-common-chip-terms

M4 Grow & Slice copy uses broad semiconductor manufacturing background for the Czochralski method, round wafers, and diamond-wire wafering. Current player-facing benchmark copy is grounded in manufacturer/vendor references that describe controlled Czochralski pulling for large silicon ingots and 300 mm wafer thickness around 775 micrometers.

- PVA TePla, Czochralski Process. Used for controlled silicon crystal pulling and 300 mm industrial ingot framing.
  https://www.pvatepla.com/products-technologies/crystal-growth/czochralski-process/
- Silicon Valley Microelectronics, 300mm Silicon Wafer specification. Used for 300 mm wafer thickness of 775 plus/minus 25 micrometers.
  https://svmi.com/wp-content/uploads/2020/09/SV027.pdf

M5 Fab copy uses high-level cleanroom, photolithography, etching, doping, particle-control, EUV, and yield concepts for gameplay. ASML's public explainer is used for cleanroom/process background and for the EUV claim; player-facing copy avoids exact EUV scanner cost and market-share numbers. Yield is modeled as an instructional score, not a fabrication-process simulator. Node labels such as 90 nm, 28 nm, and 7 nm are taught as generation shorthand rather than exact transistor measurements.

- Intel Newsroom, Explaining Common Chip Terms. Used for the clarification that current process-node names are closer to density/performance generation labels than literal physical dimensions.
  https://newsroom.intel.com/tech101/explaining-common-chip-terms
- ASML, How microchips are made. Used for cleanroom, layered fabrication, hundreds-of-steps, and many-weeks process framing.
  https://www.asml.com/en/technology/all-about-microchips/how-microchips-are-made
- ASML, EUV lithography systems. Used for the EUV/ASML fact card and for advanced-node EUV framing.
  https://www.asml.com/en/products/euv-lithography-systems

July 2026 accuracy pass: player-facing benchmark copy now avoids exact unsourced cycle-time phrasing such as "3 months" and "over 1,000 tiny steps." The shipped wording uses "many weeks" and "hundreds to thousands" for advanced wafer fabrication, and labels 9N as a teaching shorthand rather than a universal material spec.

M6 Packaging copy uses conservative educational summaries of semiconductor packaging, electrical test, and binning. The chapter frames packaging as the step that connects a bare die to the outside system, binning as sorting chips by tested performance and power behavior, and GPUs as parallel processors useful for graphics and AI workloads. Intel's Tech 101 explainer is used for package, substrate, die, yield, and power/performance/area framing.

## M7 Chapter 6 Data Center Content

- Chapter 6 data-center content uses conservative educational statements about racks, power, cooling, networking, backup power, and throttling. The benchmark copy avoids hard MW claims and uses IEA's household-scale framing for AI-focused data centers.
- IEA, Energy and AI, Executive Summary. Used for AI data-center electricity-demand and household-scale framing.
  https://www.iea.org/reports/energy-and-ai/executive-summary
- Lawrence Berkeley National Laboratory, 2024 United States Data Center Energy Usage Report. Used as a background reference for U.S. data-center electricity-growth context; the shipped game avoids hard U.S.-share claims in player-facing copy.
  https://eta-publications.lbl.gov/sites/default/files/2024-12/lbnl-2024-united-states-data-center-energy-usage-report.pdf

## M8 Codex Content

- `codex.json` summarizes concepts already introduced by the M2-M7 chapter copy and avoids new volatile numeric claims.
- July 2026 accuracy pass reviewed all `realStat` fields against the sources listed above and kept them as conservative, non-volatile educational statements.

## Dr. Vega Guide Overlay

- `guide.ts` uses `nvidia-about` for industry framing of accelerated computing, AI factories, and data-center energy context, cited generically without naming or depicting any real individual.
  https://www.nvidia.com/en-us/about-nvidia/
- `guide.ts` uses `sia-101` for classroom-safe semiconductor process framing.
  https://www.semiconductors.org/semiconductors-101/
- The guide lines are voiced by Dr. Vega, a fictional in-game character, not by any real person or company representative.
