import {
  createListExportAction,
  createListImportAction,
  downloadText,
  EditorCollectionComponentClass,
  NotificationType,
  VcsUiApp,
} from '@vcmap/ui';
import { parseGeoJSON, writeGeoJSON } from '@vcmap/core';
import Feature from 'ol/Feature';
import { LineString } from 'ol/geom';
import { name } from '../../package.json';
import { HeightProfileItem } from './heightProfileEditorHelper.js';
import {
  HeightProfileFeature,
  resultCollectionSymbol,
} from '../heightProfileFeature.js';

// eslint-disable-next-line import/prefer-default-export
export function createImportExport(
  app: VcsUiApp,
  editorCollection: EditorCollectionComponentClass<HeightProfileItem>,
): () => void {
  const { action: importAction, destroy: destroyImportAction } =
    createListImportAction(
      async (files): Promise<boolean> => {
        const { vueI18n } = app;

        const featuresAll = await Promise.all(
          files.map(async (file) => {
            const text = await file.text();
            const { features: geojson } = parseGeoJSON(text);
            return geojson;
          }),
        );

        const features = featuresAll.flat();

        try {
          const featureToImport = features.filter(
            (f): f is Feature<LineString> =>
              f.getGeometry()?.getType() === 'LineString',
          );
          const predicateDelta = features.length - featureToImport.length;
          if (predicateDelta > 0) {
            app.notifier.add({
              type: NotificationType.WARNING,
              message: app.vueI18n.t('components.import.predicateFailure', [
                predicateDelta,
              ]),
            });
          }

          const imported = featureToImport
            .map((f) => {
              const feature = f as HeightProfileFeature;

              return editorCollection.collection.add(feature);
            })
            .filter((id) => id != null);

          const importedDelta = featureToImport.length - imported.length;
          if (importedDelta > 0) {
            app.notifier.add({
              type: NotificationType.WARNING,
              message: app.vueI18n.t('components.import.addFailure', [
                importedDelta,
              ]),
            });
          }

          if (imported.length > 0) {
            app.notifier.add({
              type: NotificationType.SUCCESS,
              message: app.vueI18n.t('components.import.featuresAdded', [
                imported.length,
              ]),
            });
          } else {
            app.notifier.add({
              type: NotificationType.ERROR,
              message: app.vueI18n.t('components.import.nothingAdded'),
            });
          }

          return true;
        } catch (e) {
          app.notifier.add({
            type: NotificationType.ERROR,
            message: vueI18n.t('components.import.failure').toString(),
          });
          return false;
        }
      },
      app.windowManager,
      name,
      'category-manager',
    );

  const { action: exportAction, destroy: destroyExportAction } =
    createListExportAction(
      editorCollection.selection,
      () => {
        const features = [...editorCollection.selection.value].map(
          (listItem) => {
            return editorCollection.collection.getByKey(
              listItem.name,
            )! as HeightProfileFeature;
          },
        );
        features.map((f): void => {
          f.setProperties({ vcsHeightProfile: [...f[resultCollectionSymbol]] });
          return undefined;
        });

        const heightProfileText = writeGeoJSON(
          {
            features,
          },
          {
            writeStyle: true,
            embedIcons: true,
            prettyPrint: true,
            writeId: true,
          },
        );

        downloadText(heightProfileText, 'heightProfile.json');
      },
      name,
    );

  editorCollection.addActions([importAction, exportAction]);
  return (): void => {
    destroyImportAction();
    destroyExportAction();
  };
}
