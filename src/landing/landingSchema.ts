import { ANDROID_RELEASE, LITE_AUTHOR, OFFICIAL_PROJECT, PRO_AUTHOR, SITE_URL } from './officialProject';

export function buildSoftwareApplicationSchema(
  pageUrl: string,
  description: string
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'AnimaStage Lite',
    alternateName: 'AnimaStage Lite — Official Browser MMD Studio',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web, Android',
    url: pageUrl,
    downloadUrl: ANDROID_RELEASE.playStore.url ?? ANDROID_RELEASE.directUrl,
    softwareVersion: ANDROID_RELEASE.version,
    fileSize: `${ANDROID_RELEASE.sizeMb}MB`,
    description,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: {
      '@type': 'Person',
      name: LITE_AUTHOR.name,
      url: LITE_AUTHOR.url,
    },
    contributor: {
      '@type': 'Person',
      name: PRO_AUTHOR.name,
      url: PRO_AUTHOR.url,
      description: 'AnimaStage Pro edition author',
    },
    publisher: {
      '@type': 'Organization',
      name: 'AnimaStage',
      url: SITE_URL,
    },
    isPartOf: {
      '@type': 'WebSite',
      name: 'AnimaStage Lite',
      url: SITE_URL,
    },
  };
}

export function buildOrganizationSchema(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'AnimaStage',
    url: SITE_URL,
    sameAs: [
      OFFICIAL_PROJECT.liteRepo,
      OFFICIAL_PROJECT.proRepo,
      OFFICIAL_PROJECT.proSite,
      LITE_AUTHOR.url,
      PRO_AUTHOR.url,
    ],
  };
}

export function buildWebPageSchema(
  name: string,
  description: string,
  url: string
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name,
    description,
    url,
    isPartOf: { '@type': 'WebSite', name: 'AnimaStage Lite', url: SITE_URL },
    author: {
      '@type': 'Person',
      name: LITE_AUTHOR.name,
      url: LITE_AUTHOR.url,
    },
  };
}
