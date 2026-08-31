import type {
  AshfallCameraSpotDef,
  AshfallDistrictDef,
  AshfallLandmarkDef,
  AshfallPhotoSpotDef,
  AshfallStudioPresetId,
  AshfallVariantId,
} from './types';
import type { EnvironmentPatches } from '../environmentBuilder/types';

export const ASHFALL_DISTRICTS: AshfallDistrictDef[] = [
  {
    id: 'central_plaza',
    label: 'Central Plaza',
    description: 'Ash-stained circular plaza around the Spire of Embers',
    center: [0, 0, 0],
    extent: [18, 18],
    connectsTo: ['business', 'residential', 'park', 'old_town'],
  },
  {
    id: 'residential',
    label: 'Residential Area',
    description: 'Stacked mid-rises with shattered balconies',
    center: [-28, 0, 12],
    extent: [16, 14],
    connectsTo: ['central_plaza', 'old_town', 'park'],
  },
  {
    id: 'business',
    label: 'Business District',
    description: 'Glass towers and dead holographic ads',
    center: [26, 0, -8],
    extent: [18, 16],
    connectsTo: ['central_plaza', 'bridge', 'rooftops'],
  },
  {
    id: 'metro',
    label: 'Underground Metro',
    description: 'Sunken station mouth and tunnel mouth',
    center: [-8, -1.2, -22],
    extent: [12, 10],
    connectsTo: ['central_plaza', 'tunnel', 'old_town'],
  },
  {
    id: 'industrial',
    label: 'Industrial Zone',
    description: 'Silent stacks, burned loaders, wire fences',
    center: [32, 0, 28],
    extent: [16, 14],
    connectsTo: ['bridge', 'collapsed_highway', 'river'],
  },
  {
    id: 'old_town',
    label: 'Old Town',
    description: 'Crooked lanes and overgrown courtyard walls',
    center: [-24, 0, -18],
    extent: [14, 12],
    connectsTo: ['central_plaza', 'residential', 'metro'],
  },
  {
    id: 'collapsed_highway',
    label: 'Collapsed Highway',
    description: 'Broken elevated roadway over the ash flats',
    center: [8, 4, 34],
    extent: [22, 8],
    connectsTo: ['industrial', 'bridge', 'tunnel'],
  },
  {
    id: 'bridge',
    label: 'Bridge District',
    description: 'Twin-arch river crossing with missing decking',
    center: [18, 1.5, 18],
    extent: [14, 10],
    connectsTo: ['business', 'industrial', 'river', 'collapsed_highway'],
  },
  {
    id: 'rooftops',
    label: 'Rooftops',
    description: 'Skyline walkways above the business canyon',
    center: [26, 18, -8],
    extent: [12, 12],
    connectsTo: ['business'],
  },
  {
    id: 'park',
    label: 'Park',
    description: 'Reclaimed green island reclaiming the plaza edge',
    center: [-14, 0, 22],
    extent: [12, 12],
    connectsTo: ['central_plaza', 'residential', 'river'],
  },
  {
    id: 'river',
    label: 'River',
    description: 'Ash-grey canal cutting the east side',
    center: [10, -0.4, 22],
    extent: [28, 6],
    connectsTo: ['bridge', 'industrial', 'park'],
  },
  {
    id: 'tunnel',
    label: 'Tunnel',
    description: 'Dark underpass linking metro to highway ruins',
    center: [0, -0.8, 26],
    extent: [10, 8],
    connectsTo: ['metro', 'collapsed_highway'],
  },
];

export const ASHFALL_LANDMARKS: AshfallLandmarkDef[] = [
  {
    id: 'spire_of_embers',
    label: 'Spire of Embers',
    districtId: 'central_plaza',
    position: [0, 0, -6],
    note: 'Twisted landmark tower — city signature silhouette',
  },
  {
    id: 'veil_gates',
    label: 'Veil Gates',
    districtId: 'central_plaza',
    position: [0, 0, 16],
    note: 'City entrance arches for anime intros',
  },
  {
    id: 'echo_bridge',
    label: 'Echo Bridge',
    districtId: 'bridge',
    position: [18, 0, 18],
    note: 'Partially collapsed twin-arch crossing',
  },
  {
    id: 'cinder_stacks',
    label: 'Cinder Stacks',
    districtId: 'industrial',
    position: [34, 0, 30],
    note: 'Industrial chimneys with looping smoke',
  },
  {
    id: 'hollow_station',
    label: 'Hollow Station',
    districtId: 'metro',
    position: [-8, 0, -22],
    note: 'Metro mouth with warning beacons',
  },
  {
    id: 'rift_overpass',
    label: 'Rift Overpass',
    districtId: 'collapsed_highway',
    position: [8, 0, 34],
    note: 'Broken highway slab for battle / chase framing',
  },
];

function cam(
  id: AshfallCameraSpotDef['id'],
  label: string,
  districtId: AshfallCameraSpotDef['districtId'],
  position: [number, number, number],
  target: [number, number, number],
  fov: number,
  description: string
): AshfallCameraSpotDef {
  return {
    id,
    label,
    districtId,
    description,
    snapshot: {
      position,
      target,
      fov,
      rotation: [0, 0, 0],
    },
  };
}

export const ASHFALL_CAMERA_SPOTS: AshfallCameraSpotDef[] = [
  cam('city_entrance', 'City Entrance', 'central_plaza', [0, 8, 28], [0, 6, 0], 42, 'Veil Gates approach'),
  cam('main_street', 'Main Street', 'business', [14, 5, 2], [26, 8, -8], 40, 'Business canyon street'),
  cam('bridge', 'Bridge', 'bridge', [10, 6, 22], [18, 4, 18], 38, 'Echo Bridge three-quarter'),
  cam('collapsed_highway', 'Collapsed Highway', 'collapsed_highway', [0, 10, 42], [8, 6, 34], 44, 'Rift Overpass wide'),
  cam('central_plaza', 'Central Plaza', 'central_plaza', [-10, 7, 12], [0, 8, -4], 40, 'Spire of Embers plaza'),
  cam('rooftop', 'Roof Top', 'rooftops', [22, 22, 0], [8, 6, 8], 36, 'Skyline overlook'),
  cam('alley', 'Alley', 'old_town', [-28, 3, -14], [-22, 4, -18], 35, 'Old Town lane'),
  cam('metro_entrance', 'Metro Entrance', 'metro', [-4, 4, -16], [-8, 1, -22], 38, 'Hollow Station mouth'),
  cam('industrial_yard', 'Industrial Yard', 'industrial', [26, 5, 36], [34, 8, 30], 42, 'Cinder Stacks yard'),
  cam('river_side', 'River Side', 'river', [4, 4, 26], [14, 2, 22], 40, 'Canal reflection'),
  cam('park', 'Park', 'park', [-20, 5, 28], [-14, 3, 22], 40, 'Reclaimed park'),
  cam('observation_deck', 'Observation Deck', 'rooftops', [30, 24, -12], [0, 10, 0], 48, 'Full city read'),
];

export const ASHFALL_PHOTO_SPOTS: AshfallPhotoSpotDef[] = [
  {
    id: 'portrait',
    label: 'Portrait Spot',
    description: 'Face / bust against Spire haze',
    characterPosition: [0, 0, 6],
    snapshot: { position: [0, 5.2, 11], target: [0, 4.6, 6], fov: 32, rotation: [0, 0, 0] },
  },
  {
    id: 'full_body',
    label: 'Full Body Spot',
    description: 'Full figure on plaza tiles',
    characterPosition: [0, 0, 4],
    snapshot: { position: [0, 6, 14], target: [0, 5, 4], fov: 38, rotation: [0, 0, 0] },
  },
  {
    id: 'group',
    label: 'Group Shot',
    description: 'Wide plaza for 2–4 characters',
    characterPosition: [0, 0, 2],
    snapshot: { position: [-6, 7, 16], target: [0, 5, 2], fov: 48, rotation: [0, 0, 0] },
  },
  {
    id: 'wallpaper',
    label: 'Wallpaper Spot',
    description: 'Cinematic skyline wallpaper',
    characterPosition: [2, 0, 8],
    snapshot: { position: [-16, 10, 20], target: [4, 8, -4], fov: 50, rotation: [0, 0, 0] },
  },
  {
    id: 'poster',
    label: 'Poster Spot',
    description: 'Vertical poster framing',
    characterPosition: [0, 0, 5],
    snapshot: { position: [0, 6.5, 12], target: [0, 5.5, 5], fov: 34, rotation: [0, 0, 0] },
  },
  {
    id: 'hero',
    label: 'Hero Shot',
    description: 'Low-angle hero under Veil Gates',
    characterPosition: [0, 0, 12],
    snapshot: { position: [0, 2.5, 18], target: [0, 6, 10], fov: 36, rotation: [0, 0, 0] },
  },
  {
    id: 'anime_intro',
    label: 'Anime Intro Shot',
    description: 'Establishing shot into the city',
    characterPosition: [0, 0, 10],
    snapshot: { position: [0, 12, 34], target: [0, 8, 0], fov: 46, rotation: [0, 0, 0] },
  },
  {
    id: 'shorts_vertical',
    label: 'Shorts Vertical Shot',
    description: '9:16 social framing on plaza',
    characterPosition: [0, 0, 5],
    snapshot: { position: [0, 5.5, 13], target: [0, 5, 5], fov: 40, rotation: [0, 0, 0] },
  },
];

export interface AshfallVariantDef {
  id: AshfallVariantId;
  label: string;
  description: string;
  patches: EnvironmentPatches;
}

export const ASHFALL_VARIANTS: AshfallVariantDef[] = [
  {
    id: 'clean',
    label: 'Clean',
    description: 'Clear abandoned day — dust only',
    patches: {
      visualFx: {
        scenePreset: 'outdoor',
        lightPreset: 'natural',
        weatherPreset: 'clear',
        bloomEnabled: true,
        bloomIntensity: 0.42,
      },
      dynamicSky: { enabled: true, presetId: 'anime_day', timeHours: 11, weatherId: 'clear' },
      message: 'Ashfall · Clean day',
    },
  },
  {
    id: 'fog',
    label: 'Fog',
    description: 'Signature ash fog atmosphere',
    patches: {
      visualFx: {
        scenePreset: 'outdoor',
        lightPreset: 'rim',
        weatherPreset: 'fog',
        bloomIntensity: 0.55,
        particlesEnabled: true,
        particlePreset: 'dust',
      },
      dynamicSky: { enabled: true, presetId: 'foggy_morning', timeHours: 8, weatherId: 'fog' },
      sceneComposer: { fogEnabled: true, fogDensity: 0.55, fogColor: '#8a8e96' },
      message: 'Ashfall · Fog',
    },
  },
  {
    id: 'rain',
    label: 'Rain',
    description: 'Wet streets and cold light',
    patches: {
      visualFx: {
        scenePreset: 'cyber',
        lightPreset: 'rim',
        weatherPreset: 'rain',
        wetness: 0.75,
        precipIntensity: 0.7,
        bloomIntensity: 0.5,
      },
      dynamicSky: { enabled: true, timeHours: 15, weatherId: 'rain' },
      message: 'Ashfall · Rain',
    },
  },
  {
    id: 'snow',
    label: 'Snow',
    description: 'Ash-snow silence',
    patches: {
      visualFx: {
        scenePreset: 'outdoor',
        lightPreset: 'natural',
        weatherPreset: 'snow',
        precipIntensity: 0.65,
        particlesEnabled: true,
        particlePreset: 'snow',
      },
      dynamicSky: { enabled: true, timeHours: 10, weatherId: 'snow' },
      message: 'Ashfall · Snow',
    },
  },
  {
    id: 'night',
    label: 'Night',
    description: 'Broken neon and moon fill',
    patches: {
      visualFx: {
        scenePreset: 'cyber',
        lightPreset: 'neon',
        weatherPreset: 'clear',
        bloomEnabled: true,
        bloomIntensity: 0.75,
      },
      dynamicSky: { enabled: true, timeHours: 22.5, weatherId: 'clear' },
      message: 'Ashfall · Night',
    },
  },
  {
    id: 'golden_hour',
    label: 'Golden Hour',
    description: 'Warm ruin light through dust',
    patches: {
      visualFx: {
        scenePreset: 'sunset',
        lightPreset: 'rim',
        bloomIntensity: 0.7,
        weatherPreset: 'fog',
      },
      dynamicSky: { enabled: true, presetId: 'golden_hour', timeHours: 17.6, weatherId: 'fog' },
      message: 'Ashfall · Golden Hour',
    },
  },
  {
    id: 'storm',
    label: 'Storm',
    description: 'Heavy weather and distant flashes',
    patches: {
      visualFx: {
        scenePreset: 'cyber',
        lightPreset: 'rim',
        weatherPreset: 'storm',
        precipIntensity: 0.9,
        wetness: 0.85,
        bloomIntensity: 0.55,
      },
      dynamicSky: { enabled: true, timeHours: 16, weatherId: 'storm' },
      sceneComposer: { fogEnabled: true, fogDensity: 0.65, fogColor: '#4a5060' },
      message: 'Ashfall · Storm',
    },
  },
  {
    id: 'cyber',
    label: 'Cyber',
    description: 'Flicker-holo ruins after dark',
    patches: {
      visualFx: {
        scenePreset: 'cyber',
        lightPreset: 'neon',
        weatherPreset: 'rain',
        wetness: 0.7,
        bloomIntensity: 0.95,
      },
      dynamicSky: { enabled: true, timeHours: 21, weatherId: 'rain' },
      message: 'Ashfall · Cyber',
    },
  },
  {
    id: 'fantasy',
    label: 'Fantasy',
    description: 'Soft ember glow reclaiming the city',
    patches: {
      visualFx: {
        scenePreset: 'sunset',
        lightPreset: 'rim',
        weatherPreset: 'fog',
        particlesEnabled: true,
        particlePreset: 'fireflies',
        bloomIntensity: 0.68,
      },
      dynamicSky: { enabled: true, timeHours: 19.2, weatherId: 'fog' },
      message: 'Ashfall · Fantasy',
    },
  },
];

export interface AshfallStudioPresetDef {
  id: AshfallStudioPresetId;
  label: string;
  description: string;
  variantId: AshfallVariantId;
  cameraSpotId: AshfallCameraSpotDef['id'];
  photoSpotId?: AshfallPhotoSpotDef['id'];
}

export const ASHFALL_STUDIO_PRESETS: AshfallStudioPresetDef[] = [
  {
    id: 'anime_intro',
    label: 'Anime Intro',
    description: 'Establishing Veil Gates push-in',
    variantId: 'fog',
    cameraSpotId: 'city_entrance',
    photoSpotId: 'anime_intro',
  },
  {
    id: 'battle',
    label: 'Battle Scene',
    description: 'Collapsed highway confrontation',
    variantId: 'storm',
    cameraSpotId: 'collapsed_highway',
    photoSpotId: 'hero',
  },
  {
    id: 'music_video',
    label: 'Music Video',
    description: 'Neon night street energy',
    variantId: 'cyber',
    cameraSpotId: 'main_street',
    photoSpotId: 'full_body',
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    description: 'Golden ruin atmosphere',
    variantId: 'golden_hour',
    cameraSpotId: 'central_plaza',
    photoSpotId: 'wallpaper',
  },
  {
    id: 'photo',
    label: 'Photo',
    description: 'Clean portrait light',
    variantId: 'clean',
    cameraSpotId: 'central_plaza',
    photoSpotId: 'portrait',
  },
  {
    id: 'wallpaper',
    label: 'Wallpaper',
    description: 'Wide skyline wallpaper',
    variantId: 'fog',
    cameraSpotId: 'observation_deck',
    photoSpotId: 'wallpaper',
  },
  {
    id: 'poster',
    label: 'Poster',
    description: 'Vertical poster framing',
    variantId: 'night',
    cameraSpotId: 'rooftop',
    photoSpotId: 'poster',
  },
  {
    id: 'youtube_thumb',
    label: 'YouTube Thumbnail',
    description: 'Bold hero thumbnail read',
    variantId: 'cyber',
    cameraSpotId: 'bridge',
    photoSpotId: 'hero',
  },
];

export function getAshfallVariant(id: AshfallVariantId): AshfallVariantDef {
  return ASHFALL_VARIANTS.find((v) => v.id === id) ?? ASHFALL_VARIANTS[1]!;
}

export function getAshfallCameraSpot(id: string): AshfallCameraSpotDef | undefined {
  return ASHFALL_CAMERA_SPOTS.find((s) => s.id === id);
}

export function getAshfallPhotoSpot(id: string): AshfallPhotoSpotDef | undefined {
  return ASHFALL_PHOTO_SPOTS.find((s) => s.id === id);
}

export function getAshfallStudioPreset(id: AshfallStudioPresetId): AshfallStudioPresetDef | undefined {
  return ASHFALL_STUDIO_PRESETS.find((p) => p.id === id);
}
