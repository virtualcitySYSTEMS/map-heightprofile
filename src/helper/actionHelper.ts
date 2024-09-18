import {
  EditorCollectionComponentClass,
  ToolboxType,
  VcsAction,
  VcsUiApp,
  WindowSlot,
} from '@vcmap/ui';
import {
  CreateFeatureSession,
  EditGeometrySession,
  GeometryType,
  SessionType,
  startCreateFeatureSession,
  startEditGeometrySession,
  VectorLayer,
} from '@vcmap/core';
import { nextTick, reactive, ShallowRef, watch } from 'vue';
import Feature from 'ol/Feature';
import { Geometry } from 'ol/geom';
import {
  getHeightProfileEditorId,
  HeightProfileItem,
} from './heightProfileEditorHelper.js';
import HeightProfileWrapper from '../CreateProfileFeatureWrapper.vue';
import type { HeightProfilePlugin } from '../index.js';
import { HeightProfileSessionType } from './sessionHelper.js';
import { name } from '../../package.json';

export function createCreateAction(
  app: VcsUiApp,
  layer: VectorLayer,
  session: ShallowRef<
    | CreateFeatureSession<GeometryType.LineString>
    | EditGeometrySession
    | undefined
  >,
  heightProfileCategory: EditorCollectionComponentClass<HeightProfileItem>,
): { action: VcsAction; destroy: () => void } {
  const windowIdHeightProfile = getHeightProfileEditorId(heightProfileCategory);

  const action = reactive<VcsAction>({
    name: 'heightProfile.create',
    title: 'heightProfile.tip',
    icon: '$vcsElevationProfile',
    active: false,
    async callback(): Promise<void> {
      if (session.value?.type === SessionType.CREATE) {
        session.value?.stop();
      } else {
        app.windowManager.remove(windowIdHeightProfile);

        const featuresToRemove = layer
          .getFeatures()
          .filter(
            (feature) =>
              !heightProfileCategory.collection.hasKey(feature.getId()),
          )
          .map((f) => f.getId() as string);

        layer.removeFeaturesById(featuresToRemove);

        session.value = startCreateFeatureSession(
          app,
          layer,
          GeometryType.LineString,
        );
        const contentComponent = {
          id: windowIdHeightProfile,
          component: HeightProfileWrapper,
          slot: WindowSlot.DYNAMIC_LEFT,
          state: {
            headerTitle: 'heightProfile.tempTitle',
            infoUrlCallback: app.getHelpUrlCallback(
              'tools/heightProfileTool.html#id_heightProfile_calculateProfile',
            ),
          },
        };
        await nextTick();
        app.windowManager.add(contentComponent, name);
      }
    },
  });

  const destroy = watch(session, (newSession) => {
    action.active = newSession?.type === SessionType.CREATE;
  });

  return { action, destroy };
}

export function createEditAction(
  app: VcsUiApp,
  feature: Feature<Geometry>,
  plugin: HeightProfilePlugin,
): { action: VcsAction; destroy: () => void } {
  const action = reactive<VcsAction>({
    name: 'heightProfile.edit',
    title: 'heightProfile.edit',
    icon: '$vcsEditVertices',
    disabled: plugin.session.value?.type === SessionType.CREATE,
    active: plugin.session.value?.type === SessionType.EDIT_GEOMETRY,
    callback(): void {
      if (plugin.session.value?.type === SessionType.EDIT_GEOMETRY) {
        plugin.session.value?.stop();
        plugin.session.value = undefined;
      } else {
        plugin.session.value = startEditGeometrySession(app, plugin.layer);
        plugin.session.value.setFeature(feature);
      }
    },
  });

  const destroy = watch(plugin.session, (newSession) => {
    action.active = newSession?.type === SessionType.EDIT_GEOMETRY;
    action.disabled = newSession?.type === SessionType.CREATE;
  });

  return { action, destroy };
}

export function createToolboxButton(
  app: VcsUiApp,
  layer: VectorLayer,
  session: ShallowRef<HeightProfileSessionType>,
  heightProfileCategory: EditorCollectionComponentClass<HeightProfileItem>,
): () => void {
  const { action, destroy: destroyAction } = createCreateAction(
    app,
    layer,
    session,
    heightProfileCategory,
  );

  if (app.toolboxManager.has('HeightProfileEditorComponent')) {
    app.toolboxManager.remove('HeightProfileEditorComponent');
  }
  app.toolboxManager.add(
    {
      id: 'HeightProfileEditorComponent',
      type: ToolboxType.SINGLE,
      action,
    },
    name,
  );
  return (): void => {
    app.toolboxManager.remove('HeightProfileEditorComponent');
    destroyAction();
  };
}
