import {
  Collection,
  CreateFeatureSession,
  EditGeometrySession,
  GeometryType,
  getDefaultHighlightStyle,
  markVolatile,
  mercatorProjection,
  SessionType,
  startCreateFeatureSession,
  startEditGeometrySession,
  VectorLayer,
} from '@vcmap/core';
import {
  CollectionComponentListItem,
  EditorCollectionComponentClass,
  makeEditorCollectionComponentClass,
  NotificationType,
  ToolboxType,
  VcsAction,
  VcsUiApp,
  WindowSlot,
} from '@vcmap/ui';
import { nextTick, reactive, ShallowRef, shallowRef, watch } from 'vue';
import Feature from 'ol/Feature.js';
import { Coordinate } from 'ol/coordinate.js';
import { unByKey } from 'ol/Observable';
import { EventsKey } from 'ol/events';
import { Geometry } from 'ol/geom';
import { Style } from 'ol/style';
import type { HeightProfilePlugin } from './index.js';
import HeightProfileEditorComponent from './HeightProfileEditor.vue';
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

export function addHeightProfileEditorComponent(
  windowIdHeightProfile: string,
  featureId: string,
  app: VcsUiApp,
): void {
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
}
export function getHeightProfileEditorId(
  heightProfileCategory: EditorCollectionComponentClass<HeightProfileItem>,
): string {
  return `${heightProfileCategory.id}-editor`;
}

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

  return (): void => {
    unByKey(featureGeomListener!);
    unByKey(featureGeomChangedListener);
  };
}

function createSourceListeners(layer: VectorLayer): () => void {
  const featureListeners = new Map<Feature, () => void>();
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

  return (): void => {
    featureListeners.forEach((listener) => listener());
    featureListeners.clear();
    unByKey(sourceChangeFeature);
    unByKey(sourceRemoveFeature);
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

export function createSessionReference(
  app: VcsUiApp,
  heightProfileCategory: EditorCollectionComponentClass<HeightProfileItem>,
): {
  session: ShallowRef<
    | CreateFeatureSession<GeometryType.LineString>
    | EditGeometrySession
    | undefined
  >;
  destroy: () => void;
} {
  const session = shallowRef<
    | CreateFeatureSession<GeometryType.LineString>
    | EditGeometrySession
    | undefined
  >(undefined);

  const windowIdHeightProfile = getHeightProfileEditorId(heightProfileCategory);

  const sessionWatcher = watch(
    session,
    (
      newSession:
        | CreateFeatureSession<GeometryType.LineString>
        | EditGeometrySession
        | undefined,
    ) => {
      if (newSession) {
        if (newSession.type === SessionType.CREATE) {
          newSession.creationFinished.addEventListener((feature) => {
            if (feature) {
              newSession?.stop();
            }
          });
          newSession.featureCreated.addEventListener((f) => {
            const featureId = f.getId() as string;
            addHeightProfileEditorComponent(
              windowIdHeightProfile,
              featureId,
              app,
            );
          });
        } else if (newSession.type === SessionType.EDIT_GEOMETRY) {
          const item = heightProfileCategory.collection.getByKey(
            newSession.feature?.getId(),
          );
          if (item) {
            const listItem = heightProfileCategory.getListItemForItem(
              item,
            ) as CollectionComponentListItem;
            if (
              !heightProfileCategory.selection.value.find(
                (l) => l.name === listItem.name,
              )
            ) {
              heightProfileCategory.selection.value = [
                listItem,
                ...heightProfileCategory.selection.value,
              ];
            }
          } else if (!app.windowManager.has(windowIdHeightProfile)) {
            addHeightProfileEditorComponent(
              windowIdHeightProfile,
              newSession.feature?.getId() as string,
              app,
            );
          }

          app.notifier.add({
            type: NotificationType.WARNING,
            message: String('heightProfile.editSessionWarning'),
          });
        }
        newSession.stopped.addEventListener(async () => {
          await nextTick();
          if (session.value === newSession) {
            session.value = undefined;
          }
        });
      }
    },
  );

  const destroy = (): void => {
    sessionWatcher();
    session.value?.stop();
  };
  return { session, destroy };
}

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
    title: 'heightProfile.create',
    icon: '$vcsElevationProfile',
    active: false,
    callback(): void {
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
    title: 'heightProfile.create',
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

export type HeightProfileItem = { name: string; feature: Feature };

export async function createCategory(
  app: VcsUiApp,
  plugin: HeightProfilePlugin,
): Promise<{
  editorCollection: EditorCollectionComponentClass<HeightProfileItem>;
  workbenchSelectionWatcher: () => void;
}> {
  const { collectionComponent } =
    await app.categoryManager.requestCategory<HeightProfileItem>(
      {
        name: 'HeightProfile',
        title: 'heightProfile.title',
      },
      name,
      {
        selectable: true,
        renamable: true,
        removable: true,
      },
    );
  const highlightStyle = getDefaultHighlightStyle();
  const workbenchSelectionWatcher = watch(
    collectionComponent.selection,
    (selection, oldSelection) => {
      const selectedIds = selection.map((selectionItem) => selectionItem.name);
      const oldSelectedIds = oldSelection.map(
        (oldSelectionItem) => oldSelectionItem.name,
      );
      const idsOnlySelected = selectedIds.filter(
        (id) => !oldSelectedIds.includes(id),
      );
      const idsOnlyOldSelected = oldSelectedIds.filter(
        (id) => !selectedIds.includes(id),
      );

      const objectsToSelect: Record<string, Style> = idsOnlySelected.reduce(
        (acc, id) => {
          acc[id] = highlightStyle;
          return acc;
        },
        {} as Record<string, Style>,
      );
      plugin.layer.featureVisibility.highlight(objectsToSelect);
      plugin.layer.featureVisibility.unHighlight(idsOnlyOldSelected);
    },
  );

  const editorCollection = makeEditorCollectionComponentClass(
    app,
    collectionComponent,
    {
      editor: (item: HeightProfileItem) => ({
        component: HeightProfileEditorComponent,
        state: {
          headerTitle: 'heightProfile.titleTemporary',
          headerIcon: '$vcsElevationProfile',
        },
        props: {
          featureId: item.feature.getId(),
        },
      }),
    },
    'category-manager',
  );

  return { editorCollection, workbenchSelectionWatcher };
}
