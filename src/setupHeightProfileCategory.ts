import { getDefaultHighlightStyle } from '@vcmap/core';
import {
  EditorCollectionComponentClass,
  makeEditorCollectionComponentClass,
  VcsUiApp,
} from '@vcmap/ui';
import { watch } from 'vue';
import { Style } from 'ol/style';
import type { HeightProfilePlugin } from './index.js';
import HeightProfileEditorComponent from './HeightProfileEditor.vue';
import { name } from '../package.json';
import {
  getHeightProfileEditorId,
  HeightProfileItem,
} from './helper/heightProfileEditorHelper.js';

// eslint-disable-next-line import/prefer-default-export
export async function createCategory(
  app: VcsUiApp,
  plugin: HeightProfilePlugin,
): Promise<{
  editorCollection: EditorCollectionComponentClass<HeightProfileItem>;
  destroy: () => void;
}> {
  const { collectionComponent } =
    await app.categoryManager.requestCategory<HeightProfileItem>(
      {
        name: 'HeightProfile',
        title: 'heightProfile.title',
        // @ts-expect-error id is private and therefore not typed
        keyProperty: 'id_',
      },
      name,
      {
        selectable: true,
        renamable: true,
        removable: true,
      },
    );

  const highlightStyle = getDefaultHighlightStyle();
  const workspaceSelectionWatcher = watch(
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
          infoUrlCallback: app.getHelpUrlCallback(
            'tools/heightProfileTool.html',
          ),
        },
        props: {
          featureId: item.getId(),
        },
      }),
    },
    'category-manager',
  );

  const listeners = [
    collectionComponent.collection.added.addEventListener((added) => {
      plugin.layer.addFeatures([added]);
    }),
    collectionComponent.collection.removed.addEventListener((removed) => {
      plugin.layer.removeFeaturesById([String(removed.getId())]);
    }),
  ];
  collectionComponent.addItemMapping({
    mappingFunction: (item, _c, listItem) => {
      listItem.title = item.getProperty('name');

      listItem.titleChanged = (title): void => {
        item.setProperties({ name: title });
        listItem.title = title;

        const heightProfileWindow = app.windowManager.get(
          getHeightProfileEditorId(editorCollection),
        );
        if (
          heightProfileWindow &&
          (heightProfileWindow.props as { featureId?: string }).featureId ===
            item.getId()
        ) {
          heightProfileWindow.state.headerTitle = title;
        }
      };
    },
    owner: name,
  });
  return {
    editorCollection,
    destroy: (): void => {
      workspaceSelectionWatcher();
      listeners.forEach((listener) => listener());
    },
  };
}
