import type {
  CreateFeatureSession,
  EditGeometrySession,
  GeometryType,
} from '@vcmap/core';
import { SessionType } from '@vcmap/core';
import type { EditorCollectionComponentClass, VcsUiApp } from '@vcmap/ui';
import { NotificationType, WindowSlot } from '@vcmap/ui';
import type { ShallowRef } from 'vue';
import { nextTick, shallowRef, watch } from 'vue';
import {
  isHeightProfileFeature,
  resultCollectionComponentSymbol,
  resultCollectionSymbol,
} from '../heightProfileFeature.js';
import HeightProfileParameterComponent, {
  windowIdSetParameter,
} from '../HeightProfileParameterComponent.vue';
import type { HeightProfileItem } from './heightProfileEditorHelper.js';
import {
  getHeightProfileEditorId,
  addHeightProfileEditorComponent,
} from './heightProfileEditorHelper.js';
import { name } from '../../package.json';

export type HeightProfileSessionType =
  | CreateFeatureSession<GeometryType.LineString>
  | EditGeometrySession
  | undefined;

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
            if (isHeightProfileFeature(feature)) {
              newSession?.stop();

              const collection = feature[resultCollectionSymbol];

              const collectionComponent =
                feature[resultCollectionComponentSymbol];
              const contentComponent = {
                id: windowIdSetParameter,
                parentId: windowIdHeightProfile,
                component: HeightProfileParameterComponent,
                slot: WindowSlot.DYNAMIC_CHILD,
                state: {
                  headerTitle: 'heightProfile.parameterComponent',
                  infoUrlCallback: app.getHelpUrlCallback(
                    'tools/heightProfileTool.html',
                  ),
                },
                props: {
                  featureId: feature.getId(),
                },
                provides: {
                  collection,
                  collectionComponent,
                },
              };
              app.windowManager.add(contentComponent, name);
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
            const listItem = heightProfileCategory.getListItemForItem(item);
            if (listItem) {
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
