import type { ProjectAnalysisContext, SmartMetadataLocale, SocialPlatformId } from './types';
import { getMetadataUi } from './locale';
import { mulberry32, pickRandom, shuffleUnique, uniqueStrings } from './rng';

const TITLE_EMOJIS = ['✨', '🌸', '💫', '🎵', '🌙', '⚡', '🔥', '💎', '🎭', '🌟'];

type TitleBuilder = (ctx: ProjectAnalysisContext, rng: () => number) => string;

function char(ctx: ProjectAnalysisContext): string {
  return ctx.characterName ?? 'Anime Character';
}

function motion(ctx: ProjectAnalysisContext): string {
  return ctx.motionName ?? 'Dance';
}

function mood(ctx: ProjectAnalysisContext, rng: () => number): string {
  if (ctx.moodTags.length === 0) return pickRandom(['Dream', 'Epic', 'Beautiful', 'Neon'], rng);
  return ctx.moodTags[0]!.replace(/\b\w/g, (c) => c.toUpperCase());
}

function sceneWord(ctx: ProjectAnalysisContext, rng: () => number): string {
  if (ctx.stageName) return ctx.stageName;
  if (ctx.environment) return ctx.environment.split(' · ')[0]!;
  return pickRandom(['Stage', 'Studio', 'Fantasy Stage', 'Night Stage'], rng);
}

function styleWord(ctx: ProjectAnalysisContext, rng: () => number): string {
  if (ctx.visualStyle) return ctx.visualStyle;
  return pickRandom(['Anime', 'Cyber', 'Fantasy', 'Studio'], rng);
}

const EN_BUILDERS: TitleBuilder[] = [
  (ctx, rng) => `${char(ctx)} ${motion(ctx)} ${pickRandom(TITLE_EMOJIS, rng)}`,
  (ctx) => `${styleWord(ctx, () => 0.5)} Idol Performance`,
  (ctx, rng) => `${mood(ctx, rng)} ${sceneWord(ctx, rng)}`,
  (ctx) => `Anime ${motion(ctx)} Showcase`,
  (ctx, rng) => `${pickRandom(['Moonlight', 'Starlight', 'Midnight'], rng)} Performance`,
  (ctx, rng) => `${pickRandom(['Neon Dreams', 'Neon Nights', 'Neon Stage'], rng)}`,
  (ctx) => `Epic MMD ${motion(ctx)}`,
  (ctx) => `Studio Performance — ${char(ctx)}`,
  (ctx, rng) => `${pickRandom(['Cherry Blossom', 'Sakura', 'Spring'], rng)} Stage`,
  (ctx) => `Beautiful Anime ${motion(ctx)}`,
  (ctx, rng) => `${char(ctx)} on ${sceneWord(ctx, rng)}`,
  (ctx) => `${ctx.lightingPreset ?? 'Cinematic'} ${char(ctx)}`,
  (ctx, rng) => `${ctx.weather ?? mood(ctx, rng)} ${motion(ctx)}`,
  (ctx) => `${char(ctx)} · ${ctx.visualStyle ?? 'Anime'} Look`,
  (ctx, rng) => `${pickRandom(['Cyber Idol', 'Digital Idol', 'Virtual Idol'], rng)}`,
  (ctx) => `${sceneWord(ctx, () => 0.3)} Dance`,
];

const JA_BUILDERS: TitleBuilder[] = [
  (ctx, rng) => `${char(ctx)} ${motion(ctx)} ${pickRandom(TITLE_EMOJIS, rng)}`,
  (ctx) => `${char(ctx)}の${motion(ctx)}`,
  (ctx, rng) => `${mood(ctx, rng)}ステージ`,
  (ctx) => `MMD ${motion(ctx)}`,
  (ctx, rng) => `${sceneWord(ctx, rng)}パフォーマンス`,
  (ctx, rng) => `${styleWord(ctx, rng)}アイドル`,
  (ctx) => `夜の${motion(ctx)}`,
  (ctx) => `${char(ctx)} ダンス`,
  (ctx) => `アニメ ${motion(ctx)}`,
  (ctx, rng) => `${pickRandom(['ネオン', '月明かり', '幻想'], rng)}ステージ`,
];

const RU_BUILDERS: TitleBuilder[] = [
  (ctx, rng) => `${char(ctx)} — ${motion(ctx)} ${pickRandom(TITLE_EMOJIS, rng)}`,
  (ctx) => `${styleWord(ctx, () => 0.5)} выступление`,
  (ctx, rng) => `${mood(ctx, rng)} сцена`,
  (ctx) => `MMD ${motion(ctx)}`,
  (ctx) => `Аниме ${motion(ctx)}`,
  (ctx, rng) => `${pickRandom(['Неоновая', 'Лунная', 'Ночная'], rng)} сцена`,
  (ctx) => `${char(ctx)} на сцене`,
  (ctx) => `Красивый ${motion(ctx)}`,
  (ctx) => `Студийное выступление`,
  (ctx, rng) => `${sceneWord(ctx, rng)} — ${char(ctx)}`,
];

const LOCALE_BUILDERS: Partial<Record<SmartMetadataLocale, TitleBuilder[]>> = {
  en: EN_BUILDERS,
  ja: JA_BUILDERS,
  ru: RU_BUILDERS,
  es: EN_BUILDERS,
  fr: EN_BUILDERS,
  de: EN_BUILDERS,
  pt: EN_BUILDERS,
};

export function generateTitles(
  ctx: ProjectAnalysisContext,
  locale: SmartMetadataLocale,
  rng: () => number,
  count = 10
): string[] {
  const builders = LOCALE_BUILDERS[locale] ?? EN_BUILDERS;
  const shuffled = shuffleUnique(builders, builders.length, rng);
  const titles: string[] = [];

  for (const build of shuffled) {
    if (titles.length >= count) break;
    const title = build(ctx, rng).replace(/\s+/g, ' ').trim();
    if (title.length > 3) titles.push(title);
  }

  while (titles.length < count) {
    const extra = pickRandom(builders, rng)(ctx, rng).replace(/\s+/g, ' ').trim();
    titles.push(extra);
  }

  return uniqueStrings(titles).slice(0, count);
}

export function generateDescription(
  ctx: ProjectAnalysisContext,
  locale: SmartMetadataLocale
): string {
  const ui = getMetadataUi(locale);
  const lines: string[] = [ui.createdWith, ''];

  const add = (label: string, value?: string) => {
    if (value?.trim()) lines.push(`${label}: ${value.trim()}`);
  };

  add(ui.character, ctx.characterName);
  add(ui.motion, ctx.motionName);
  add(ui.stage, ctx.stageName);
  add(ui.visualStyle, ctx.visualStyle);
  add(ui.shaderPack, ctx.shaderPack);
  add(ui.lut, ctx.lut);
  add(ui.lighting, ctx.lightingPreset);
  add(ui.weather, ctx.weather);
  add(ui.timeOfDay, ctx.timeOfDay);
  add(ui.environment, ctx.environment);
  add(ui.background, ctx.background);
  add(ui.camera, ctx.cameraPreset);
  if (ctx.activeEffects.length) add(ui.effects, ctx.activeEffects.join(', '));
  add(ui.resolution, ctx.resolution);
  add(ui.fps, String(ctx.fps));
  add(ui.aspect, ctx.aspectRatio);
  add(ui.exportMode, ctx.exportMode === 'live' ? 'Live' : 'MP4 HQ');

  lines.push('', ui.autoGenerated);
  return lines.join('\n');
}

const BASE_HASHTAGS = [
  '#MMD',
  '#PMX',
  '#VMD',
  '#Anime',
  '#3D',
  '#Animation',
  '#AnimaStage',
  '#3DAnimation',
  '#VirtualIdol',
  '#Dance',
];

const PLATFORM_HASHTAGS: Record<SocialPlatformId, string[]> = {
  youtube: ['#YouTube', '#MMDCommunity'],
  youtube_shorts: ['#YouTubeShorts', '#Shorts', '#Vertical'],
  tiktok: ['#TikTok', '#FYP', '#ForYou'],
  instagram_reels: ['#InstagramReels', '#Reels', '#InstaAnime'],
  x: ['#X', '#AnimeArt'],
};

export function generateHashtags(
  ctx: ProjectAnalysisContext,
  platform: SocialPlatformId,
  max = 20
): string[] {
  const contextual: string[] = [];

  if (ctx.characterName) {
    const tag = ctx.characterName.replace(/\s+/g, '');
    if (tag.length <= 24) contextual.push(`#${tag}`);
  }
  if (ctx.motionName && /dance/i.test(ctx.motionName)) contextual.push('#DanceCover');
  if (ctx.visualStyle) {
    const t = ctx.visualStyle.replace(/\s+/g, '');
    if (t.length <= 20) contextual.push(`#${t}`);
  }
  if (ctx.lightingPreset?.toLowerCase().includes('neon')) contextual.push('#Cyberpunk');
  if (ctx.weather) contextual.push(`#${ctx.weather.replace(/\s+/g, '')}`);
  if (ctx.aspectRatio === '9:16') contextual.push('#VerticalVideo');
  if (ctx.exportMode === 'live') contextual.push('#LiveCapture');

  for (const mood of ctx.moodTags.slice(0, 4)) {
    const t = mood.replace(/[^a-z0-9]/gi, '');
    if (t.length >= 3 && t.length <= 18) contextual.push(`#${t.charAt(0).toUpperCase()}${t.slice(1)}`);
  }

  return uniqueStrings([
    ...BASE_HASHTAGS,
    ...PLATFORM_HASHTAGS[platform],
    ...contextual,
  ]).slice(0, max);
}

export function generateKeywords(ctx: ProjectAnalysisContext, locale: SmartMetadataLocale): string[] {
  const ui = getMetadataUi(locale);
  const words: string[] = [
    'Anime',
    'Dance',
    'Performance',
    'MMD',
    '3D',
    'Animation',
    'Idol',
    'Virtual',
  ];

  if (ctx.characterName) words.push(ctx.characterName);
  if (ctx.motionName) words.push(ctx.motionName);
  if (ctx.stageName) words.push(ctx.stageName);
  if (ctx.visualStyle) words.push(ctx.visualStyle);
  if (ctx.lightingPreset) words.push(ctx.lightingPreset);
  if (ctx.weather) words.push(ctx.weather);
  if (ctx.timeOfDay) words.push(ctx.timeOfDay);
  if (ctx.environment) words.push(...ctx.environment.split(' · '));

  for (const mood of ctx.moodTags) {
    if (/cyber|neon|night|fantasy|cute|dream/i.test(mood)) words.push(mood);
  }

  if (ctx.lightingPreset?.toLowerCase().includes('neon') || ctx.visualStyle?.toLowerCase().includes('cyber')) {
    words.push('Cyberpunk');
  }
  if (ctx.weather?.toLowerCase().includes('snow')) words.push('Winter');
  if (ctx.timeOfDay?.toLowerCase().includes('night')) words.push('Night');

  void ui;
  return uniqueStrings(words.map((w) => w.trim())).slice(0, 16);
}

export function generateSmartMetadata(
  ctx: ProjectAnalysisContext,
  options: {
    locale?: SmartMetadataLocale;
    platform?: SocialPlatformId;
    seed?: number;
    selectedTitleIndex?: number;
  } = {}
): import('./types').SmartVideoMetadata {
  const locale = options.locale ?? 'en';
  const platform = options.platform ?? (ctx.aspectRatio === '9:16' ? 'youtube_shorts' : 'youtube');
  const seed = options.seed ?? Date.now();
  const rng = mulberry32(seed);

  const titles = generateTitles(ctx, locale, rng, 10);
  const selectedTitleIndex = Math.min(
    options.selectedTitleIndex ?? 0,
    Math.max(0, titles.length - 1)
  );
  const description = generateDescription(ctx, locale);
  const hashtags = generateHashtags(ctx, platform);
  const keywords = generateKeywords(ctx, locale);

  const base = {
    locale,
    platform,
    exportMode: ctx.exportMode,
    titles,
    selectedTitleIndex,
    description,
    hashtags,
    keywords,
    generatedAt: Date.now(),
    generationSeed: seed,
    displayTitle: titles[selectedTitleIndex] ?? titles[0] ?? 'AnimaStage Video',
    displayDescription: description,
    displayHashtags: hashtags.join(' '),
  };

  return applySocialPreset(base, platform);
}

export function applySocialPresetToMetadata(
  meta: import('./types').SmartVideoMetadata,
  platform: SocialPlatformId
): import('./types').SmartVideoMetadata {
  return applySocialPreset(meta, platform);
}

function applySocialPreset(
  meta: Omit<
    import('./types').SmartVideoMetadata,
    'displayTitle' | 'displayDescription' | 'displayHashtags'
  > & {
    displayTitle: string;
    displayDescription: string;
    displayHashtags: string;
  },
  platform: SocialPlatformId
): import('./types').SmartVideoMetadata {
  const title = meta.titles[meta.selectedTitleIndex] ?? meta.titles[0] ?? 'AnimaStage Video';
  let displayTitle = title;
  let displayDescription = meta.description;
  let displayHashtags = meta.hashtags.join(' ');

  switch (platform) {
    case 'youtube_shorts': {
      displayTitle = title.length > 70 ? `${title.slice(0, 67)}…` : title;
      if (!displayTitle.toLowerCase().includes('short')) {
        displayTitle = `${displayTitle} #Shorts`;
      }
      displayDescription = `${meta.description}\n\n${meta.hashtags.slice(0, 12).join(' ')}`;
      displayHashtags = meta.hashtags.slice(0, 15).join(' ');
      break;
    }
    case 'tiktok': {
      displayTitle = `${title} ${pickRandom(TITLE_EMOJIS, mulberry32(meta.generationSeed))}`;
      displayHashtags = meta.hashtags.slice(0, 18).join(' ');
      displayDescription = `${title}\n\n${displayHashtags}`;
      break;
    }
    case 'instagram_reels': {
      displayTitle = title;
      displayDescription = `${title}\n\n${meta.description.split('\n').slice(0, 8).join('\n')}\n\n${meta.hashtags.slice(0, 10).join(' ')}`;
      displayHashtags = meta.hashtags.slice(0, 12).join(' ');
      break;
    }
    case 'x': {
      displayTitle = title.length > 100 ? `${title.slice(0, 97)}…` : title;
      const post = `${displayTitle}\n\n${meta.hashtags.slice(0, 6).join(' ')}`;
      displayDescription = post.length > 280 ? `${post.slice(0, 277)}…` : post;
      displayHashtags = meta.hashtags.slice(0, 8).join(' ');
      break;
    }
    case 'youtube':
    default: {
      displayTitle = title.length > 100 ? `${title.slice(0, 97)}…` : title;
      displayDescription = `${meta.description}\n\n${meta.hashtags.slice(0, 10).join(' ')}`;
      displayHashtags = meta.hashtags.join(' ');
      break;
    }
  }

  return {
    ...meta,
    platform,
    displayTitle,
    displayDescription,
    displayHashtags,
  };
}
