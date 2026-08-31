/**
 * Modular editor interface versions.
 * UI 1.0 remains supported; UI 3.0 is the long-term professional shell.
 */

export type EditorInterfaceId = 'ui1' | 'ui3';

export interface EditorInterfaceMeta {
  id: EditorInterfaceId;
  label: string;
  shortLabel: string;
  description: string;
  /** Recommended audience */
  level: 'beginner' | 'pro';
  advantages: string[];
  features: string[];
  /** If true, factory default when user has not chosen yet */
  isDefault?: boolean;
  recommended?: boolean;
}

export const EDITOR_INTERFACE_REGISTRY: readonly EditorInterfaceMeta[] = [
  {
    id: 'ui1',
    label: 'UI 1.0 Classic',
    shortLabel: 'UI 1.0',
    description: 'Simple, lightweight editor — easy to learn, lower hardware load.',
    level: 'beginner',
    isDefault: true,
    advantages: [
      'Simple & lightweight',
      'Easy to learn',
      'Basic editing focused',
      'Lower hardware requirements',
    ],
    features: ['Classic sidebar', 'Core timeline', 'Templates', 'Export'],
  },
  {
    id: 'ui3',
    label: 'UI 3.0 Studio',
    shortLabel: 'UI 3.0',
    description: 'Professional dockable workspace with Camera Studio, Cinema Render and AI tools.',
    level: 'pro',
    recommended: true,
    advantages: [
      'Professional studio workspace',
      'Advanced rendering & materials',
      'Camera Studio & Cinema Render',
      'AI tools & visual styles',
    ],
    features: [
      'Dockable panels',
      'Camera Studio',
      'Cinema Render',
      'Cinematic templates',
      'ASRP / Visual Styles',
      'Smart Studio',
      'Adaptive responsive layout',
    ],
  },
] as const;

export const DEFAULT_EDITOR_INTERFACE: EditorInterfaceId = 'ui1';

export function isEditorInterfaceId(value: unknown): value is EditorInterfaceId {
  return value === 'ui1' || value === 'ui3';
}

export function getEditorInterfaceMeta(id: EditorInterfaceId): EditorInterfaceMeta {
  return (
    EDITOR_INTERFACE_REGISTRY.find((m) => m.id === id) ?? EDITOR_INTERFACE_REGISTRY[0]!
  );
}

