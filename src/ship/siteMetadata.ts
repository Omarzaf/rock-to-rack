export const SITE_METADATA = {
  title: 'Rock to Rack',
  description: 'A browser game where you bring a public-interest AI online, then trace every chip choice back through the semiconductor supply chain.',
  url: 'https://rock-to-rack.vercel.app',
  faviconPath: '/favicon.svg',
  coverImagePath: '/og-cover.svg',
  manifestPath: '/site.webmanifest',
  feedbackHref: '',
  themeColor: '#14213d'
} as const;

export const LOADING_FACTS = [
  'A single wafer can hold thousands of tiny chip dies.',
  'Chip fabs control dust because one speck can ruin a circuit.',
  'Data centers turn chip choices into heat, power, and network tradeoffs.',
  'Silicon starts as quartz before it becomes a polished wafer.',
  'Packaging decides which chips become fast, slow, or specialized parts.',
  'The supply chain only works when mining, refining, fabs, and racks line up.'
] as const;
