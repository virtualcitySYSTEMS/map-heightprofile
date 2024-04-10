import Feature from 'ol/Feature';
import { LineString } from 'ol/geom';
import { Collection } from '@vcmap/core';
import { CollectionComponentClass } from '@vcmap/ui';
import { HeightProfileResult } from './setup.js';

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
