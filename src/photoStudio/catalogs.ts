/**
 * Photo Studio 2.0 one-click catalogs. All entries patch the existing renderer.
 */
import type {
  PhotoAtmosphereDef,
  PhotoCameraDef,
  PhotoCinematicFxDef,
  PhotoCompositionDef,
  PhotoDofDef,
  PhotoGradeDef,
  PhotoLightingDef,
  PhotoSceneDef,
  PhotoSocialExportDef,
  PhotoWeatherDef,
} from './types';

export const PHOTO_SCENES: PhotoSceneDef[] = [
  ['japanese_street', 'Japanese Street', 'Anime city street', 'outdoor', 'anime_day'],
  ['school', 'School', 'School exterior', 'outdoor', 'anime_day'],
  ['classroom', 'Classroom', 'Soft indoor daylight', 'studio', 'studio'],
  ['bedroom', 'Bedroom', 'Warm private interior', 'studio', 'warm_summer'],
  ['shrine', 'Shrine', 'Traditional shrine mood', 'outdoor', 'golden_hour'],
  ['temple', 'Temple', 'Cinematic temple light', 'outdoor', 'foggy_morning'],
  ['park', 'Park', 'Green outdoor light', 'outdoor', 'sunny_day'],
  ['forest', 'Forest', 'Deep natural environment', 'outdoor', 'foggy_morning'],
  ['cherry_blossoms', 'Cherry Blossoms', 'Spring anime scene', 'outdoor', 'anime_day'],
  ['cafe', 'Cafe', 'Warm soft interior', 'studio', 'warm_summer'],
  ['beach', 'Beach', 'Bright coastal daylight', 'outdoor', 'sunny_day'],
  ['ocean', 'Ocean', 'Blue open horizon', 'outdoor', 'sunny_day'],
  ['night_city', 'Night City', 'Night urban backdrop', 'nightclub', 'night'],
  ['cyberpunk', 'Cyberpunk', 'Wet neon city', 'cyber', 'cyberpunk'],
  ['concert', 'Concert', 'Performance stage', 'stage', 'night'],
  ['studio', 'Studio', 'Neutral photo studio', 'studio', 'studio'],
  ['white_bg', 'White Background', 'Clean white product background', 'studio', 'studio'],
  ['black_bg', 'Black Background', 'Black portrait background', 'studio', 'night'],
  ['infinity_room', 'Infinity Room', 'Minimal seamless room', 'studio', 'studio'],
  ['fantasy_castle', 'Fantasy Castle', 'Epic fantasy mood', 'sunset', 'golden_hour'],
  ['magic_forest', 'Magic Forest', 'Mystical moonlit forest', 'outdoor', 'moonlight'],
].map(([id, label, description, scenePreset, sky]) => ({
  id: id as PhotoSceneDef['id'],
  label,
  description,
  visualFx: {
    scenePreset: scenePreset as PhotoSceneDef['visualFx']['scenePreset'],
    particlesEnabled: id === 'cherry_blossoms' || id === 'magic_forest',
    particlePreset: id === 'cherry_blossoms' ? 'petals' : id === 'magic_forest' ? 'fireflies' : 'none',
  },
  dynamicSky: { enabled: true, presetId: sky as NonNullable<PhotoSceneDef['dynamicSky']>['presetId'] },
}));

const light = (
  id: PhotoLightingDef['id'],
  label: string,
  lightPreset: PhotoLightingDef['visualFx']['lightPreset'],
  bloom: number,
  exposure: number,
  timeHours?: number
): PhotoLightingDef => ({
  id,
  label,
  visualFx: {
    lightPreset,
    bloomEnabled: bloom > 0,
    bloomIntensity: bloom,
  },
  composer: { exposure },
  dynamicSky: timeHours == null ? undefined : { enabled: true, timeHours },
});

export const PHOTO_LIGHTING: PhotoLightingDef[] = [
  light('anime_portrait', 'Anime Portrait', 'anime', 0.5, 1.06),
  light('golden_hour', 'Golden Hour', 'rim', 0.62, 1.04, 17.5),
  light('sunset', 'Sunset', 'rim', 0.7, 0.98, 19),
  light('soft_studio', 'Soft Studio', 'natural', 0.35, 1.08),
  light('moonlight', 'Moonlight', 'rim', 0.5, 0.9, 0.5),
  light('concert', 'Concert', 'concert', 0.9, 1.02),
  light('cyberpunk', 'Cyberpunk', 'neon', 0.95, 0.95, 21.5),
  light('fantasy', 'Fantasy', 'rim', 0.85, 1.04),
  light('dream', 'Dream', 'anime', 0.78, 1.12),
  light('horror', 'Horror', 'spotlight', 0.25, 0.72),
  light('neon', 'Neon', 'neon', 0.88, 0.94),
  light('warm', 'Warm', 'natural', 0.44, 1.08, 16),
  light('cold', 'Cold', 'rim', 0.38, 0.98, 7),
  light('natural', 'Natural', 'natural', 0.3, 1),
  light('realistic', 'Realistic', 'natural', 0.18, 1),
];

export const PHOTO_ATMOSPHERES: PhotoAtmosphereDef[] = [
  { id: 'none', label: 'None', visualFx: { particlesEnabled: false, weatherPreset: 'clear', precipIntensity: 0 } },
  { id: 'snow', label: 'Snow', visualFx: { particlesEnabled: true, particlePreset: 'snow', weatherPreset: 'snow', precipIntensity: 0.75 } },
  { id: 'rain', label: 'Rain', visualFx: { particlesEnabled: false, weatherPreset: 'rain', precipIntensity: 0.7, wetness: 0.8 } },
  { id: 'fog', label: 'Fog', visualFx: { weatherPreset: 'fog' } },
  { id: 'clouds', label: 'Clouds', visualFx: { weatherPreset: 'fog' } },
  { id: 'petals', label: 'Petals', visualFx: { particlesEnabled: true, particlePreset: 'petals', particleIntensity: 0.8 } },
  { id: 'leaves', label: 'Leaves', visualFx: { particlesEnabled: true, particlePreset: 'petals', particleIntensity: 0.55 } },
  { id: 'fireflies', label: 'Fireflies', visualFx: { particlesEnabled: true, particlePreset: 'fireflies', particleIntensity: 0.8 } },
  { id: 'sparkles', label: 'Sparkles', visualFx: { particlesEnabled: true, particlePreset: 'sparkles', particleIntensity: 0.7 } },
  { id: 'dust', label: 'Dust', visualFx: { particlesEnabled: true, particlePreset: 'dust', particleIntensity: 0.5 } },
  { id: 'magic', label: 'Magic Particles', visualFx: { particlesEnabled: true, particlePreset: 'sparkles', particleIntensity: 1 } },
  { id: 'butterflies', label: 'Butterflies', visualFx: { particlesEnabled: true, particlePreset: 'petals', particleIntensity: 0.4 } },
  { id: 'confetti', label: 'Confetti', visualFx: { particlesEnabled: true, particlePreset: 'confetti', particleIntensity: 0.9 } },
  { id: 'wind', label: 'Wind', visualFx: { particlesEnabled: true, particlePreset: 'dust', particleIntensity: 0.35 } },
];

const cam = (
  id: PhotoCameraDef['id'],
  label: string,
  focusTarget: 'face' | 'body' | 'full',
  orbitPreset: 'face_portrait' | 'full_body' | 'hero_low' | 'manual',
  description = label,
  aspect?: number
): PhotoCameraDef => ({
  id, label, description, aspect,
  cameraStudio: { autoFocus: true, focusTarget, orbitPreset, directPlacement: true },
});

export const PHOTO_CAMERAS: PhotoCameraDef[] = [
  cam('anime_portrait', 'Anime Portrait', 'face', 'face_portrait'),
  cam('full_body', 'Full Body', 'full', 'full_body'),
  cam('half_body', 'Half Body', 'body', 'face_portrait'),
  cam('close_face', 'Close Face', 'face', 'face_portrait'),
  cam('hero_shot', 'Hero Shot', 'full', 'hero_low'),
  cam('low_angle', 'Low Angle', 'full', 'hero_low'),
  cam('high_angle', 'High Angle', 'body', 'manual'),
  cam('dutch_angle', 'Dutch Angle', 'body', 'manual'),
  cam('side_view', 'Side View', 'body', 'manual'),
  cam('over_shoulder', 'Over Shoulder', 'body', 'manual'),
  cam('cinematic', 'Cinematic', 'body', 'hero_low', 'Wide cinematic frame', 16 / 9),
  cam('movie_poster', 'Movie Poster', 'full', 'hero_low', 'Vertical poster', 2 / 3),
  cam('wallpaper', 'Wallpaper', 'full', 'full_body', 'Desktop wallpaper', 16 / 9),
  cam('youtube_thumbnail', 'YouTube Thumbnail', 'body', 'face_portrait', '16:9 thumbnail', 16 / 9),
  cam('discord_banner', 'Discord Banner', 'body', 'face_portrait', 'Wide banner', 5 / 2),
  cam('profile_picture', 'Profile Picture', 'face', 'face_portrait', 'Square avatar', 1),
  cam('steam_artwork', 'Steam Artwork', 'full', 'full_body', 'Vertical artwork', 2 / 3),
];

export const PHOTO_COMPOSITIONS: PhotoCompositionDef[] = [
  { id: 'rule_of_thirds', label: 'Rule of Thirds', description: 'Place eyes and subject on thirds', subjectBiasX: -0.16, subjectBiasY: 0.1, cameraStudio: { autoFocus: true, focusTarget: 'face' } },
  { id: 'golden_ratio', label: 'Golden Ratio', description: 'Golden spiral subject placement', subjectBiasX: 0.12, subjectBiasY: 0.08, cameraStudio: { autoFocus: true, focusTarget: 'body' } },
  { id: 'leading_lines', label: 'Leading Lines', description: 'Strong cinematic depth', subjectBiasX: 0.12, subjectBiasY: 0, cameraStudio: { orbitPreset: 'hero_low', focusTarget: 'full' } },
  { id: 'balanced', label: 'Balanced', description: 'Centered stable frame', subjectBiasX: 0, subjectBiasY: 0, cameraStudio: { orbitPreset: 'full_body', focusTarget: 'full' } },
  { id: 'portrait_framing', label: 'Portrait Framing', description: 'Face and shoulder crop', subjectBiasX: 0, subjectBiasY: 0.14, cameraStudio: { orbitPreset: 'face_portrait', focusTarget: 'face' } },
  { id: 'negative_space', label: 'Negative Space', description: 'Room for titles and layout', subjectBiasX: -0.25, subjectBiasY: 0, cameraStudio: { orbitPreset: 'full_body', focusTarget: 'full' } },
];

export const PHOTO_DOF: PhotoDofDef[] = [
  ['portrait', 'Portrait', true, 0.018, 3.2],
  ['macro', 'Macro', true, 0.009, 6],
  ['cinema', 'Cinema', true, 0.024, 3.8],
  ['anime', 'Anime', true, 0.03, 2.5],
  ['movie', 'Movie', true, 0.02, 4.5],
  ['strong_blur', 'Strong Blur', true, 0.014, 7],
  ['soft_blur', 'Soft Blur', true, 0.035, 1.8],
  ['off', 'Off', false, 0.02, 0],
].map(([id, label, enabled, focus, bokeh]) => ({
  id: id as PhotoDofDef['id'], label: String(label),
  visualFx: { dofEnabled: Boolean(enabled), dofFocusDistance: Number(focus), dofBokehScale: Number(bokeh) },
}));

export const PHOTO_CINEMATIC_FX: PhotoCinematicFxDef[] = [
  { id: 'bloom', label: 'Bloom', visualFx: { bloomEnabled: true, bloomIntensity: 0.7 } },
  { id: 'god_rays', label: 'God Rays', visualFx: { godRaysEnabled: true, godRaysDensity: 0.72 } },
  { id: 'volumetric_fog', label: 'Volumetric Fog', visualFx: { weatherPreset: 'fog' } },
  { id: 'lens_dirt', label: 'Lens Dirt', visualFx: { bloomEnabled: true, bloomRadius: 0.7 } },
  { id: 'lens_flare', label: 'Lens Flare', visualFx: { bloomEnabled: true, bloomIntensity: 0.9, godRaysEnabled: true } },
  { id: 'chromatic', label: 'Chromatic Aberration', visualFx: { chromaticAberration: 0.0025 } },
  { id: 'film_grain', label: 'Film Grain', visualFx: { colorGrade: 'cinematic' } },
  { id: 'vignette', label: 'Vignette', visualFx: { vignetteEnabled: true, vignetteIntensity: 0.55 } },
  { id: 'glow', label: 'Glow', visualFx: { bloomEnabled: true, bloomIntensity: 1, bloomThreshold: 0.35 } },
  { id: 'screen_reflection', label: 'Screen Reflection', visualFx: { floorReflection: 0.92 } },
];

export const PHOTO_GRADES: PhotoGradeDef[] = [
  ['anime', 'Anime', 'anime'], ['soft_anime', 'Soft Anime', 'anime'],
  ['makoto', 'Makoto-inspired', 'warm'], ['ufotable', 'Cinematic Anime', 'cinematic'],
  ['warm_sunset', 'Warm Sunset', 'warm'], ['cold_blue', 'Cold Blue', 'cold'],
  ['fantasy', 'Fantasy', 'vaporwave'], ['cyberpunk', 'Cyberpunk', 'vaporwave'],
  ['golden_hour', 'Golden Hour', 'warm'], ['dream', 'Dream', 'anime'],
  ['pastel', 'Pastel', 'anime'], ['blockbuster', 'Blockbuster', 'cinematic'],
  ['netflix', 'Streaming Drama', 'cinematic'],
].map(([id, label, grade]) => ({
  id: id as PhotoGradeDef['id'], label,
  visualFx: { colorGrade: grade as PhotoGradeDef['visualFx']['colorGrade'] },
}));

export const PHOTO_WEATHER: PhotoWeatherDef[] = [
  { id: 'sunny', label: 'Sunny', dynamicSky: { enabled: true, weather: 'clear', timeHours: 13 } },
  { id: 'rain', label: 'Rain', dynamicSky: { enabled: true, weather: 'rain' }, visualFx: { weatherPreset: 'rain', precipIntensity: 0.75, wetness: 0.8 } },
  { id: 'snow', label: 'Snow', dynamicSky: { enabled: true, weather: 'snow' }, visualFx: { weatherPreset: 'snow', precipIntensity: 0.7 } },
  { id: 'fog', label: 'Fog', dynamicSky: { enabled: true, weather: 'fog' }, visualFx: { weatherPreset: 'fog' } },
  { id: 'storm', label: 'Storm', dynamicSky: { enabled: true, weather: 'storm' }, visualFx: { weatherPreset: 'storm', precipIntensity: 1 } },
  { id: 'cloudy', label: 'Cloudy', dynamicSky: { enabled: true, weather: 'cloudy' } },
  { id: 'wind', label: 'Wind', dynamicSky: { enabled: true, weather: 'wind', windStrength: 0.8 } },
  { id: 'golden_hour', label: 'Golden Hour', dynamicSky: { enabled: true, weather: 'clear', timeHours: 17.5 } },
  { id: 'blue_hour', label: 'Blue Hour', dynamicSky: { enabled: true, weather: 'clear', timeHours: 20.2 } },
];

export const PHOTO_SOCIAL_EXPORTS: PhotoSocialExportDef[] = [
  { id: 'wallpaper', label: 'Wallpaper', width: 3840, height: 2160, mime: 'image/png' },
  { id: 'phone_wallpaper', label: 'Phone Wallpaper', width: 2160, height: 3840, mime: 'image/png' },
  { id: 'desktop_wallpaper', label: 'Desktop Wallpaper', width: 3840, height: 2160, mime: 'image/png' },
  { id: 'discord_banner', label: 'Discord Banner', width: 960, height: 384, mime: 'image/png' },
  { id: 'twitter_header', label: 'Twitter Header', width: 1500, height: 500, mime: 'image/jpeg' },
  { id: 'youtube_thumbnail', label: 'YouTube Thumbnail', width: 1280, height: 720, mime: 'image/jpeg' },
  { id: 'steam_artwork', label: 'Steam Artwork', width: 1000, height: 1500, mime: 'image/png' },
  { id: 'instagram', label: 'Instagram', width: 1080, height: 1350, mime: 'image/jpeg' },
  { id: 'tiktok_cover', label: 'TikTok Cover', width: 1080, height: 1920, mime: 'image/jpeg' },
];
