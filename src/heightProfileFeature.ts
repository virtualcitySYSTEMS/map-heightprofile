import type Feature from 'ol/Feature';
import type { LineString } from 'ol/geom';
import type { Collection } from '@vcmap/core';
import type { CollectionComponentClass } from '@vcmap/ui';
import type { HeightProfileResult } from './setupResultCollectionComponent.js';

export const resultCollectionSymbol = Symbol('resultCollection');
export const resultCollectionComponentSymbol = Symbol(
  'resultCollectionComponent',
);
export interface HeightProfileFeature extends Feature<LineString> {
  [resultCollectionSymbol]: Collection<HeightProfileResult>;
  [resultCollectionComponentSymbol]: CollectionComponentClass<HeightProfileResult>;
}

export function isHeightProfileFeature(
  feature: unknown,
): feature is HeightProfileFeature {
  return (
    !!feature &&
    !!(feature as HeightProfileFeature)[resultCollectionSymbol] &&
    !!(feature as HeightProfileFeature)[resultCollectionComponentSymbol]
  );
}
