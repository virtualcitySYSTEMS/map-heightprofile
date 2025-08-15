import type {
  EditorCollectionComponentClass,
  VcsAction,
  VcsUiApp,
} from '@vcmap/ui';
import { ToolboxType, WindowSlot } from '@vcmap/ui';
import type {
  CreateFeatureSession,
  EditGeometrySession,
  VectorLayer,
} from '@vcmap/core';
import {
  GeometryType,
  SessionType,
  startCreateFeatureSession,
  startEditGeometrySession,
} from '@vcmap/core';
import type { ShallowRef } from 'vue';
import { nextTick, reactive, watch } from 'vue';
import type Feature from 'ol/Feature';
import type { HeightProfileItem } from './heightProfileEditorHelper.js';
import { getHeightProfileEditorId } from './heightProfileEditorHelper.js';
import HeightProfileWrapper from '../CreateProfileFeatureWrapper.vue';
import type { HeightProfilePlugin } from '../index.js';
import type { HeightProfileSessionType } from './sessionHelper.js';
import { name } from '../../package.json';

export async function createNewProfile(
  app: VcsUiApp,
  layer: VectorLayer,
  session: ShallowRef<
    | CreateFeatureSession<GeometryType.LineString>
    | EditGeometrySession
    | undefined
  >,
  heightProfileCategory: EditorCollectionComponentClass<HeightProfileItem>,
): Promise<void> {
  const windowIdHeightProfile = getHeightProfileEditorId(heightProfileCategory);
  if (session.value?.type === SessionType.CREATE) {
    session.value?.stop();
  } else {
    app.windowManager.remove(windowIdHeightProfile);

    const featuresToRemove = layer
      .getFeatures()
      .filter(
        (feature) => !heightProfileCategory.collection.hasKey(feature.getId()),
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
}

export function createEditAction(
  app: VcsUiApp,
  feature: Feature,
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
  const action = reactive<VcsAction>({
    name: 'heightProfile.create',
    title: 'heightProfile.toolbarTitle',
    icon: '$vcsElevationProfile',
    active: false,
    async callback(): Promise<void> {
      await createNewProfile(app, layer, session, heightProfileCategory);
    },
  });

  const destroy = watch(session, (newSession) => {
    action.active = newSession?.type === SessionType.CREATE;
  });

  const toolbarId = 'HeightProfileEditorComponent';
  if (app.toolboxManager.has(toolbarId)) {
    app.toolboxManager.remove(toolbarId);
  }
  app.toolboxManager.add(
    { id: toolbarId, type: ToolboxType.SINGLE, action },
    name,
  );
  return (): void => {
    app.toolboxManager.remove(toolbarId);
    destroy();
  };
}
