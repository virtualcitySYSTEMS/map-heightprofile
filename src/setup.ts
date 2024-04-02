import {
  Collection,
  CreateFeatureSession,
  EditGeometrySession,
  GeometryType,
  SessionType,
  VectorLayer,
  markVolatile,
  mercatorProjection,
  startCreateFeatureSession,
} from '@vcmap/core';
import { ToolboxType, VcsAction, VcsUiApp, WindowSlot } from '@vcmap/ui';
import { ShallowRef, shallowRef, watch, nextTick, reactive } from 'vue';
import Feature from 'ol/Feature.js';
import { Coordinate } from 'ol/coordinate.js';
import { unByKey } from 'ol/Observable';
import { EventsKey } from 'ol/events';
import HeightProfileEditorComponent, {
  windowIdHeightProfile,
} from './HeightProfileEditor.vue';
import { name } from '../package.json';

export type ElevationType = 'both' | 'terrain';

export type HeightProfileResult = {
  name: string;
  properties: {
    title: string;
  };
  resolution: number;
  elevationType: ElevationType;
  layerNames: string[];
  resultPoints: Coordinate[];
};

export type HeightProfilFeatureProperties = {
  results: HeightProfileResult[];
};

export type HeightProfileSessionType =
  | CreateFeatureSession<GeometryType.LineString>
  | EditGeometrySession
  | undefined;

function createFeatureListeners(feature: Feature): () => void {
  const geometryChangeHandler = (): void => {
    const result = feature.get('results') as Collection<HeightProfileResult>;
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

  const destroy = (): void => {
    unByKey(featureGeomListener!);
    unByKey(featureGeomChangedListener);
  };
  return destroy;
}

function createSourceListeners(layer: VectorLayer): () => void {
  const featureListeners = new Map<Feature, () => void>();
  // plugin.measurementLayer.removeAllFeatures() -- MeasurementLayer löschen
  const sourceChangeFeature = layer.source.on('addfeature', (event) => {
    const f = event.feature as Feature;

    f.set('results', new Collection());
    featureListeners.set(f, createFeatureListeners(f));
  });

  const sourceRemoveFeature: EventsKey = layer.source.on(
    'removefeature',
    (event) => {
      const f = event.feature as Feature;
      featureListeners.get(f)?.();
      featureListeners.delete(f);
    },
  );

  const destroy = (): void => {
    featureListeners.forEach((listener) => listener());
    featureListeners.clear();
    unByKey(sourceChangeFeature);
    unByKey(sourceRemoveFeature);
  };
  return destroy;
}

export async function createVectorLayer(
  app: VcsUiApp,
): Promise<{ destroy: () => void; layer: VectorLayer }> {
  const layer = new VectorLayer({
    projection: mercatorProjection.toJSON(),
    vectorProperties: {
      classificationType: 'both',
    },
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

export async function createHeightProfileLayer(
  app: VcsUiApp,
): Promise<{ destroy: () => void; layer: VectorLayer }> {
  const { destroy, layer } = await createVectorLayer(app);
  const destroyLayerListener = createSourceListeners(layer);

  return {
    destroy: (): void => {
      destroy();
      destroyLayerListener();
    },
    layer,
  };
}

export function createSessionReference(app: VcsUiApp): {
  session: ShallowRef<
    CreateFeatureSession<GeometryType.LineString> | undefined
  >;
  destroy: () => void;
} {
  const session = shallowRef<
    CreateFeatureSession<GeometryType.LineString> | undefined
  >(undefined);

  const sessionWatcher = watch(session, (newSession) => {
    if (newSession) {
      newSession.creationFinished.addEventListener((feature) => {
        if (feature) {
          newSession?.stop();
        }
      });

      newSession.featureCreated.addEventListener((f) => {
        const featureId = f.getId();
        const contentComponent = {
          id: windowIdHeightProfile,
          component: HeightProfileEditorComponent,
          slot: WindowSlot.DYNAMIC_LEFT,
          state: {
            headerTitle: 'heightProfile.title',
          },
          props: {
            featureId,
          },
        };
        app.windowManager.add(contentComponent, name);
      });

      newSession.stopped.addEventListener(async () => {
        await nextTick();
        if (session.value === newSession) {
          session.value = undefined;
        }
      });
    }
  });
  const destroy = (): void => {
    sessionWatcher();
    session.value?.stop();
  };
  return { session, destroy };
}

export function createAction(
  app: VcsUiApp,
  layer: VectorLayer,
  session: ShallowRef<
    | CreateFeatureSession<GeometryType.LineString>
    | EditGeometrySession
    | undefined
  >,
): { action: VcsAction; destroy: () => void } {
  const action = reactive<VcsAction>({
    name: 'heightProfile.create',
    title: 'heightProfile.create',
    icon: '$vcsElevationProfile',
    active: false,
    callback(): void {
      if (session.value?.type === SessionType.CREATE) {
        session.value?.stop();
      } else {
        app.windowManager.remove(windowIdHeightProfile);
        layer.removeAllFeatures();
        session.value = startCreateFeatureSession(
          app,
          layer,
          GeometryType.LineString,
        );
      }
    },
  });

  const destroy = watch(session, (newSession) => {
    action.active = newSession?.type === SessionType.CREATE;
  });

  return { action, destroy };
}

export function createToolboxButton(
  app: VcsUiApp,
  layer: VectorLayer,
  session: ShallowRef<HeightProfileSessionType>,
): () => void {
  const { action, destroy: destroyAction } = createAction(app, layer, session);

  app.toolboxManager.add(
    {
      id: 'HeightProfileEditorComponent',
      type: ToolboxType.SINGLE,
      action,
    },
    name,
  );
  const destroy = (): void => {
    app.toolboxManager.remove('HeightProfileEditorComponent');
    destroyAction();
  };
  return destroy;
}
