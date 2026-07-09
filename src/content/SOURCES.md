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

M3 refinery copy currently reuses the USGS Silicon summary for polysilicon and purification context. Energy, water, recycling, and waste framing are conservative educational summaries and should be tightened against additional public sources before final publishing.

M4 Grow & Slice copy uses broad semiconductor manufacturing background for the Czochralski method, round wafers, and diamond-wire wafering. Current player-facing benchmark copy is grounded in manufacturer/vendor references that describe controlled Czochralski pulling for large silicon ingots and 300 mm wafer thickness around 775 micrometers.

- PVA TePla, Czochralski Process. Used for controlled silicon crystal pulling and 300 mm industrial ingot framing.
  https://www.pvatepla.com/products-technologies/crystal-growth/czochralski-process/
- Silicon Valley Microelectronics, 300mm Silicon Wafer specification. Used for 300 mm wafer thickness of 775 plus/minus 25 micrometers.
  https://svmi.com/wp-content/uploads/2020/09/SV027.pdf

M5 Fab copy uses high-level cleanroom, photolithography, etching, doping, particle-control, EUV, and yield concepts for gameplay. EUV/ASML wording is simplified for educational play; verify exact public cost and market-share wording against current manufacturer or industry sources before publication. Yield is modeled as an instructional score, not a fabrication-process simulator. Node labels such as 90 nm, 28 nm, and 7 nm are taught as generation shorthand rather than exact transistor measurements.

- Intel Newsroom, Explaining Common Chip Terms. Used for the clarification that current process-node names are closer to density/performance generation labels than literal physical dimensions.
  https://newsroom.intel.com/tech101/explaining-common-chip-terms

M6 Packaging copy uses conservative educational summaries of semiconductor packaging, electrical test, and binning. The chapter frames packaging as the step that connects a bare die to the outside system, binning as sorting chips by tested performance and power behavior, and GPUs as parallel processors useful for graphics and AI workloads. Tighten final publishing copy against semiconductor manufacturer, university, or standards-body references.

## M7 Chapter 6 Data Center Content

- Chapter 6 data-center content uses conservative, non-numeric educational statements about racks, power, cooling, networking, backup power, and throttling.
- The M7 implementation intentionally avoids volatile current market stats. M8/M10 should fact-check any specific data-center power draw, cooling, or facility-size statistic before adding it to player-facing copy.

## M8 Codex Content

- `codex.json` summarizes concepts already introduced by the M2-M7 chapter copy and avoids new volatile numeric claims.
- Before public launch, review all "realStat" fields against current semiconductor manufacturer, standards-body, university, or government sources.

## Jensen Guide Overlay

- `guide.ts` uses `nvidia-management` for Jensen Huang's role as NVIDIA founder, president, and CEO.
  https://investor.nvidia.com/governance/management-team/default.aspx
- `guide.ts` uses `nvidia-about` for NVIDIA's high-level framing of accelerated computing, AI factories, and data-center energy context.
  https://www.nvidia.com/en-us/about-nvidia/
- `guide.ts` uses `sia-101` for classroom-safe semiconductor process framing.
  https://www.semiconductors.org/semiconductors-101/
- The pixel guide portrait is a stylized educational avatar. It does not use NVIDIA logos, does not imply endorsement, and should not be described as official.
