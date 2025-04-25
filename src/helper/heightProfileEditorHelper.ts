import type { EditorCollectionComponentClass, VcsUiApp } from '@vcmap/ui';
import { WindowSlot } from '@vcmap/ui';
import type Feature from 'ol/Feature';
import type { LineString } from 'ol/geom';
import HeightProfileEditorComponent from '../HeightProfileEditor.vue';
import { name } from '../../package.json';

export type HeightProfileItem = Feature<LineString>;

export function getHeightProfileEditorId(
  heightProfileCategory: EditorCollectionComponentClass<HeightProfileItem>,
): string {
  return `${heightProfileCategory.id}-editor`;
}

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
      headerTitle: 'heightProfile.tempTitle',
    },
    props: {
      featureId,
    },
  };
  if (!app.windowManager.has(windowIdHeightProfile)) {
    app.windowManager.add(contentComponent, name);
  }
}
