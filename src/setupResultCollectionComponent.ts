import {
  CollectionComponentClass,
  CollectionComponentListItem,
  VcsAction,
  VcsUiApp,
  WindowComponentOptions,
  WindowSlot,
} from '@vcmap/ui';
import { Collection } from '@vcmap/core';
import { nextTick, watch } from 'vue';
import { Coordinate } from 'ol/coordinate';
import { HeightProfileFeature } from './heightProfileFeature.js';
import type { HeightProfilePlugin } from './index';
import HeightProfileParameterComponent, {
  windowIdSetParameter,
} from './HeightProfileParameterComponent.vue';
import { windowIdGraph } from './chart.js';
import { getHeightProfileEditorId } from './helper/heightProfileEditorHelper.js';
import { name } from '../package.json';
import GraphComponent from './GraphComponent.vue';

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

export function createGraphComponentOptions(
  props: {
    featureId: string;
    resultNames: string[];
  },
  collection: Collection<HeightProfileResult>,
  parentId: string,
  app: VcsUiApp,
): WindowComponentOptions {
  return {
    id: windowIdGraph,
    parentId,
    component: GraphComponent,
    slot: WindowSlot.DYNAMIC_CHILD,
    position: {
      left: '35%',
      right: '35%',
      top: '10%',
    },
    state: {
      headerTitle: 'heightProfile.diagram',
      infoUrlCallback: app.getHelpUrlCallback('tools/heightProfileTool.html'),
    },
    props,
    provides: {
      collection,
    },
  };
}

function createAddHeightProfileAction(
  contentComponent: WindowComponentOptions,
  app: VcsUiApp,
): VcsAction {
  return {
    name: 'heightProfile.collection.add',
    title: 'heightProfile.collection.add',
    icon: '$vcsPlus',
    callback(): void {
      app.windowManager.add(contentComponent, name);
    },
  };
}

export default (
  app: VcsUiApp,
  feature: HeightProfileFeature,
): {
  destroy: () => void;
  collectionComponent: CollectionComponentClass<HeightProfileResult>;
} => {
  const plugin = app.plugins.getByKey(name) as HeightProfilePlugin;
  const windowIdHeightProfile = getHeightProfileEditorId(
    plugin.heightProfileCategory,
  );

  const results = feature.getProperty('vcsHeightProfile');
  if (results) {
    feature.unset('vcsHeightProfile');
  }

  const collection: Collection<HeightProfileResult> = results
    ? Collection.from(results)
    : new Collection();
  const collectionComponent = new CollectionComponentClass(
    {
      id: 'heightProfileCollection',
      title: 'heightProfile.calcResults',
      draggable: false,
      renamable: true,
      removable: true,
      selectable: true,
      collection,
    },
    name,
  );

  const featureId = String(feature.getId());
  const contentComponent = {
    id: windowIdSetParameter,
    parentId: windowIdHeightProfile,
    component: HeightProfileParameterComponent,
    slot: WindowSlot.DYNAMIC_CHILD,
    state: {
      headerTitle: 'heightProfile.parameterComponent',
      infoUrlCallback: app.getHelpUrlCallback('tools/heightProfileTool.html'),
    },
    props: {
      featureId,
    },
    provides: {
      collection,
      collectionComponent,
    },
  };

  const addAnchorAction = createAddHeightProfileAction(contentComponent, app);

  collectionComponent.addActions([
    {
      action: addAnchorAction,
      owner: name,
    },
  ]);

  function showGraphAction(
    item: HeightProfileResult,
    listItem: CollectionComponentListItem,
  ): VcsAction {
    return {
      name: 'heightProfile.graphAction',
      title: 'heightProfile.graphAction',
      callback(): void {
        const props = {
          featureId,
          resultNames: [item.name],
        };
        if (!app.windowManager.has(windowIdGraph)) {
          app.windowManager.add(
            createGraphComponentOptions(
              props,
              collection,
              windowIdHeightProfile,
              app,
            ),
            name,
          );
        }
        if (
          !collectionComponent.selection.value.find(
            (l) => l.name === listItem.name,
          )
        ) {
          collectionComponent.selection.value = [
            listItem,
            ...collectionComponent.selection.value,
          ];
        }
      },
    };
  }

  collectionComponent.addItemMapping({
    mappingFunction: (item, _c, listItem) => {
      listItem.actions = [...listItem.actions, showGraphAction(item, listItem)];
    },
    owner: name,
  });

  const selectionWatcher = watch(
    collectionComponent.selection,
    async (newValue, oldValue) => {
      if (newValue !== oldValue) {
        const names = [];
        for (const item of newValue) {
          names.push(item.name);
        }
        app.windowManager.remove(windowIdGraph);

        const props = {
          featureId,
          resultNames: names,
        };
        await nextTick();
        if (names.length > 0) {
          app.windowManager.add(
            createGraphComponentOptions(
              props,
              collection,
              windowIdHeightProfile,
              app,
            ),
            name,
          );
        }
      }
    },
  );

  return {
    destroy: (): void => {
      selectionWatcher();
      collectionComponent.destroy();
    },
    collectionComponent,
  };
};
