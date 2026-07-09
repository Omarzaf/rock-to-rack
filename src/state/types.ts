export type TextMode = 'kid' | 'nerd';
export type TextSize = 'normal' | 'large';

export type MineralType = 'quartz' | 'copper' | 'lithium' | 'cobalt' | 'rareEarths';

export interface MineDepositProgress {
  id: string;
  mineral: MineralType;
  x: number;
  y: number;
  depth: number;
  richness: number;
  remaining: number;
}

export interface PlacedMinerProgress {
  id: string;
  depositId: string;
  mineral: MineralType;
  depth: number;
}

export interface Preferences {
  textMode: TextMode;
  muted: boolean;
  textSize: TextSize;
}

export interface ProgressState {
  currentChapter: number;
  unlockedChapters: number[];
  activeScene: string;
}

export interface ResourceState {
  minerals: Record<MineralType, number>;
  wafers: number;
  chips: number;
  energy: number;
  water: number;
  credits: number;
}

export interface ChapterOneProgress {
  firstMined: MineralType[];
  deposits: MineDepositProgress[];
  miners: PlacedMinerProgress[];
  elapsedSeconds: number;
  triggeredEvents: string[];
  completed: boolean;
  completedAtSeconds: number | null;
  quizCorrect: boolean | null;
}

export interface ChapterTwoProgress {
  completed: boolean;
  completedAtSeconds: number | null;
  quizCorrect: boolean | null;
  siliconPurityNines: number;
  refinedOutputs: Partial<Record<'copper' | 'lithium' | 'cobalt', number>>;
  slag: number;
  storedSlag: number;
  firstFacts: string[];
}

export interface ChapterThreeProgress {
  completed: boolean;
  completedAtSeconds: number | null;
  quizCorrect: boolean | null;
  ingotQuality: number;
  waferQuality: number;
  wafersProduced: number;
  retryUsed: boolean;
  firstFacts: string[];
}

export type FabNodeId = '90nm' | '28nm' | '7nm';
export type DieBinId = 'perfect' | 'good' | 'salvage';
export type ChipTypeId = 'cpu' | 'gpu' | 'dram' | 'nand' | 'nic' | 'pmic' | 'nova';

export interface FabNodeYield {
  node: FabNodeId;
  yieldPercent: number;
  goodDies: number;
  defectiveDies: number;
}

export interface ChapterFourProgress {
  completed: boolean;
  completedAtSeconds: number | null;
  quizCorrect: boolean | null;
  wafersProcessed: number;
  averageYield: number;
  bestYield: number;
  chipsProduced: number;
  nodeYields: FabNodeYield[];
  firstFacts: string[];
}

export interface ChapterFiveProgress {
  completed: boolean;
  completedAtSeconds: number | null;
  quizCorrect: boolean | null;
  sortedDies: number;
  bins: Record<DieBinId, number>;
  selectedChipIds: ChipTypeId[];
  builtChips: Array<{
    chipId: ChipTypeId;
    builtAtSeconds: number;
  }>;
  perfect7nmDies: number;
  triggeredEvents: string[];
  firstFacts: string[];
}

export type DatacenterBuildingType = 'rack' | 'power' | 'cooling' | 'network' | 'battery';
export type DatacenterStage = 'build' | 'contracts' | 'crisis' | 'nova' | 'victory';
export type DatacenterContractId = 'cartoonStream' | 'weatherAi' | 'cityBackup' | 'hospitalNova';

export interface DatacenterGridPosition {
  column: number;
  row: number;
}

export interface DatacenterBuildingProgress {
  id: string;
  type: DatacenterBuildingType;
  column: number;
  row: number;
  installedChipIds: ChipTypeId[];
}

export interface DatacenterEventDeltas {
  powerCapacity: number;
  cooling: number;
  batteryCharge: number;
}

export interface ChapterSixProgress {
  completed: boolean;
  completedAtSeconds: number | null;
  quizCorrect: boolean | null;
  stage: DatacenterStage;
  buildings: DatacenterBuildingProgress[];
  servedContracts: DatacenterContractId[];
  availableChipIds: ChipTypeId[];
  installedChipIds: ChipTypeId[];
  novaBuilt: boolean;
  heat: number;
  powerCapacity: number;
  powerLoad: number;
  cooling: number;
  networkLinks: number;
  batteryCharge: number;
  cityLights: number;
  eventDeltas: DatacenterEventDeltas;
  triggeredEvents: string[];
  firstFacts: string[];
}

export interface ChapterProgressState {
  ch1: ChapterOneProgress;
  ch2: ChapterTwoProgress;
  ch3: ChapterThreeProgress;
  ch4: ChapterFourProgress;
  ch5: ChapterFiveProgress;
  ch6: ChapterSixProgress;
}

export type CrisisRunGrade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface CrisisRunResult {
  runId: string;
  mode: 'crisis';
  completedAt: string;
  elapsedSeconds: number;
  cityLights: number;
  servedContracts: number;
  powerEfficiency: number;
  heatPeak: number;
  mistakes: number;
  score: number;
  grade: CrisisRunGrade;
  shareLine: string;
}

export interface MetaProgressState {
  crisisRuns: CrisisRunResult[];
  bestCrisisRun: CrisisRunResult | null;
  totalCrisisRuns: number;
}

export interface GameState {
  version: number;
  preferences: Preferences;
  progress: ProgressState;
  resources: ResourceState;
  chapters: ChapterProgressState;
  meta: MetaProgressState;
  updatedAt: string;
}
