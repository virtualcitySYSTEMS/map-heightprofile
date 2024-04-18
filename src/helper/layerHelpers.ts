import {
  markVolatile,
  maxZIndex,
  mercatorProjection,
  VectorLayer,
} from '@vcmap/core';
import { VcsUiApp } from '@vcmap/ui';
import Feature from 'ol/Feature';
import { EventsKey } from 'ol/events';
import { unByKey } from 'ol/Observable';
import {
  HeightProfileFeature,
  resultCollectionComponentSymbol,
  resultCollectionSymbol,
} from '../heightProfileFeature.js';
import setupResultCollectionComponent from '../setupResultCollectionComponent.js';

function createFeatureListeners(feature: HeightProfileFeature): () => void {
  const geometryChangeHandler = (): void => {
    const result = feature[resultCollectionSymbol];
    result?.clear();
  };
  let featureGeomListener: EventsKey | undefined;
  const setGeomListener = (): void => {
    if (featureGeomListener) {
      unByKey(featureGeomListener);
    }
    featureGeomListener = feature
      .getGeometry()
      ?.on('change', geometryChangeHandler);
  };
  setGeomListener();

  const featureGeomChangedListener: EventsKey = feature.on(
    'change:geometry',
    () => {
      setGeomListener();
      geometryChangeHandler();
    },
  );

  return (): void => {
    unByKey(featureGeomListener!);
    unByKey(featureGeomChangedListener);
  };
}

export async function createVectorLayer(
  app: VcsUiApp,
): Promise<{ destroy: () => void; layer: VectorLayer }> {
  const layer = new VectorLayer({
    projection: mercatorProjection.toJSON(),
    vectorProperties: {
      classificationType: 'both',
    },
    zIndex: maxZIndex,
  });

  markVolatile(layer);
  app.layers.add(layer);
  await layer.activate();
  const destroy = (): void => {
    layer.deactivate();
    app.layers.remove(layer);
    layer.destroy();
  };
  return { destroy, layer };
}

export function createSourceListeners(
  layer: VectorLayer,
  app: VcsUiApp,
): () => void {
  const featureListeners = new Map<Feature, () => void>();
  const sourceChangeFeature = layer.source.on('addfeature', (event) => {
    const f = event.feature as HeightProfileFeature;

    const featureNumber = layer.getFeatures().length;

    f.setProperties({ name: `heightProfile-${featureNumber}` });
    const { collectionComponent, destroy: destroyCollectionComponent } =
      setupResultCollectionComponent(app, f);
    f[resultCollectionSymbol] = collectionComponent.collection;
    f[resultCollectionComponentSymbol] = collectionComponent;

    featureListeners.set(f, () => {
      destroyCollectionComponent();
      createFeatureListeners(f);
    });
  });

  const sourceRemoveFeature: EventsKey = layer.source.on(
    'removefeature',
    (event) => {
      const f = event.feature as Feature;
      featureListeners.get(f)?.();
      featureListeners.delete(f);
    },
  );

  return (): void => {
    featureListeners.forEach((listener) => listener());
    featureListeners.clear();
    unByKey(sourceChangeFeature);
    unByKey(sourceRemoveFeature);
  };
}

export async function createHeightProfileLayer(
  app: VcsUiApp,
): Promise<{ destroy: () => void; layer: VectorLayer }> {
  const { destroy, layer } = await createVectorLayer(app);
  const destroyLayerListener = createSourceListeners(layer, app);

  return {
    destroy: (): void => {
      destroy();
      destroyLayerListener();
    },
    layer,
  };
}
