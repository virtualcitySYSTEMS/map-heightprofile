import { VcsAction, VcsUiApp } from '@vcmap/ui';
import { SessionType, vcsLayerName } from '@vcmap/core';
import { HeightProfilePlugin } from 'src';
import Feature from 'ol/Feature';
import { Geometry } from 'ol/geom.js';
import { createEditAction } from './helper/actionHelper.js';

// eslint-disable-next-line import/prefer-default-export
export function createContextMenu(
  app: VcsUiApp,
  plugin: HeightProfilePlugin,
  owner: string,
): () => void {
  let editDestroyAction = (): void => {};
  app.contextMenuManager.addEventHandler((event) => {
    const actions: VcsAction[] = [];

    if (event.feature && event.feature[vcsLayerName] === plugin.layer.name) {
      if (plugin.session.value?.type !== SessionType.CREATE) {
        const feature = event.feature as Feature<Geometry>;

        const { action: editAction, destroy: editDestroy } = createEditAction(
          app,
          feature,
          plugin,
        );
        editDestroyAction = editDestroy;
        editAction.title = undefined;
        actions.push(editAction);

        return actions;
      }
    }
    return actions;
  }, owner);

  return () => {
    app.contextMenuManager.clear();
    editDestroyAction();
  };
}
