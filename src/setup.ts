import {
  CreateFeatureSession,
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
import { unByKey } from 'ol/Observable';
import { EventsKey } from 'ol/events';
import HeightProfileEditorComponent, {
  windowIdHeightProfile,
} from './HeightProfileEditor.vue';
import { name } from '../package.json';

export type HeightProfilFeatureProperties = {
  state: 'initzialized' | 'created' | 'processing' | 'synced' | 'desynced';
  resolution: number;
  olcs_classificationType: 'both' | 'terrain';
};

function createFeatureListeners(feature: Feature): () => void {
  const changeHandler = (): void => {
    if (feature.get('state') === 'synced') {
      feature.set('state', 'desynced');
    }
  };
  let featureGeomListener: EventsKey | undefined;
  const setGeomListener = (): void => {
    if (featureGeomListener) {
      unByKey(featureGeomListener);
    }
    featureGeomListener = feature.getGeometry()!.on('change', changeHandler);
  };
  setGeomListener();

  const featureGeomChangedListener: EventsKey = feature.on(
    'change:geometry',
    () => {
      setGeomListener();
      changeHandler();
    },
  );
  const featurePropertyChangedListener = feature.on(
    'propertychange',
    (event) => {
      if (
        event.key === 'resolution' ||
        event.key === 'olcs_classificationType'
      ) {
        changeHandler();
      }
    },
  );

  const destroy = (): void => {
    unByKey(featureGeomListener!);
    unByKey(featurePropertyChangedListener);
    unByKey(featureGeomChangedListener);
  };
  return destroy;
}

function createSourceListeners(layer: VectorLayer): () => void {
  const featureListeners = new Map<Feature, () => void>();

  const sourceChangeFeature = layer.source.on('addfeature', (event) => {
    const f = event.feature as Feature;

    if (!f.getProperties().state) {
      const properties = {
        state: 'desynced',
        resolution: 1,
        olcs_classificationType: 'both',
      };
      f.setProperties(properties);
    } else {
      f.set('state', 'desynced');
    }
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

export async function createHeightProfileLayer(
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
  const destroyLayerListener = createSourceListeners(layer);
  const destroy = (): void => {
    layer.deactivate();
    app.layers.remove(layer);
    layer.destroy();
    destroyLayerListener();
  };
  return { destroy, layer };
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
          feature.set('state', 'created');
          newSession?.stop();
        }
      });

      newSession.featureCreated.addEventListener((f) => {
        const featureId = f.getId();
        f.set('state', 'initzialized');
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
    CreateFeatureSession<GeometryType.LineString> | undefined
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
  session: ShallowRef<
    CreateFeatureSession<GeometryType.LineString> | undefined
  >,
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
