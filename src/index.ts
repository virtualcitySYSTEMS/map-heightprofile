import { EditorCollectionComponentClass, VcsPlugin, VcsUiApp } from '@vcmap/ui';
import {
  CreateFeatureSession,
  EditGeometrySession,
  GeometryType,
  VectorLayer,
} from '@vcmap/core';
import { ShallowRef } from 'vue';
import { name, version, mapVersion } from '../package.json';

import { createToolboxButton } from './helper/actionHelper.js';
import { createCategory } from './setupHeightProfileCategory.js';
import { HeightProfileItem } from './helper/heightProfileEditorHelper.js';
import {
  HeightProfileSessionType,
  createSessionReference,
} from './helper/sessionHelper.js';
import {
  createVectorLayer,
  createHeightProfileLayer,
} from './helper/layerHelpers.js';
import { createContextMenu } from './contextMenu.js';
import { createImportExport } from './helper/importExportHelper.js';

type PluginConfig = Record<never, never>;
type PluginState = Record<never, never>;

export type HeightProfilePlugin = VcsPlugin<PluginConfig, PluginState> & {
  readonly layer: VectorLayer;
  readonly measurementLayer: VectorLayer;
  readonly heightProfileCategory: EditorCollectionComponentClass<HeightProfileItem>;
  readonly session: ShallowRef<HeightProfileSessionType>;
};

export default function plugin(): HeightProfilePlugin {
  let layer: VectorLayer | undefined;
  let measurementLayer: VectorLayer | undefined;
  let heightProfileCategory:
    | EditorCollectionComponentClass<HeightProfileItem>
    | undefined;
  const destroyListeners: Array<() => void> = [];

  let session: ShallowRef<HeightProfileSessionType> | undefined;

  return {
    get name(): string {
      return name;
    },
    get version(): string {
      return version;
    },
    get mapVersion(): string {
      return mapVersion;
    },
    get layer(): VectorLayer {
      if (!layer) {
        throw new Error('Layer not initialized');
      }
      return layer;
    },
    get measurementLayer(): VectorLayer {
      if (!measurementLayer) {
        throw new Error('Layer not initialized');
      }
      return measurementLayer;
    },
    get heightProfileCategory(): EditorCollectionComponentClass<HeightProfileItem> {
      if (!heightProfileCategory) {
        throw new Error('Height Profile Category not initialized');
      }
      return heightProfileCategory;
    },
    get session(): ShallowRef<
      | CreateFeatureSession<GeometryType.LineString>
      | EditGeometrySession
      | undefined
    > {
      if (!session) {
        throw new Error('Session not initialized');
      }
      return session;
    },
    async initialize(vcsUiApp: VcsUiApp): Promise<void> {
      const { destroy: destroyLayer, layer: layerHProfil } =
        await createHeightProfileLayer(vcsUiApp);
      layer = layerHProfil;

      const {
        editorCollection: heightProfileCategoryVar,
        destroy: destroySelectionWatcher,
      } = await createCategory(vcsUiApp, this);
      heightProfileCategory = heightProfileCategoryVar;

      const destroyImportExport = createImportExport(
        vcsUiApp,
        heightProfileCategory,
      );

      const { destroy: destroyMeasurementLayer, layer: layerMeasure } =
        await createVectorLayer(vcsUiApp);
      measurementLayer = layerMeasure;
      const { destroy: destroySessionWatcher, session: sessionWatched } =
        createSessionReference(vcsUiApp, heightProfileCategory);
      session = sessionWatched;

      const destroyToolbox = createToolboxButton(
        vcsUiApp,
        layer,
        session,
        heightProfileCategory,
      );

      const contextMenuDestroy = createContextMenu(vcsUiApp, this, name);

      destroyListeners.push(
        destroyImportExport,
        destroySelectionWatcher,
        contextMenuDestroy,
        destroyLayer,
        destroySessionWatcher,
        destroyToolbox,
        destroyMeasurementLayer,
      );

      return Promise.resolve();
    },
    /**
     * should return all default values of the configuratio n
     */
    getDefaultOptions(): PluginConfig {
      return {};
    },
    /**
     * should return the plugin's serialization excluding all default value s
     */
    toJSON(): PluginConfig {
      return {};
    },
    i18n: {
      en: {
        heightProfile: {
          titleTemporary: 'Height Profile',
          heightProfileCalculated: 'Height Profile Calculated',
          distance: 'Distance (m)',
          height: 'Height (m)',
          resolutionError: 'The resolution must be above 0',
          heightProfileCanceled:
            'Calculation of the height profile was canceled!',
          tooltip: {
            resolution:
              'The resolution defines the distance between the sampling points of the height profile. The smaller the resolution, the more detailed the profile.',
          },
          header: {
            title: 'Height Profile',
          },
          collection: {
            add: 'Calculate new profile',
          },
          edit: 'Edit Geometry',
          delete: 'Delete',
          title: 'Height Profile',
          create: 'Height Profile',
          tip: 'Calculate Height Profile',
          profile: 'Profile',
          diagram: 'Calculated Profiles: Diagram',
          classificationType: { DGM: 'DTM', DOM: 'DSM' },
          resolution: 'Resolution [m]',
          results: 'Start Calculation',
          new: 'New',
          pointsMultiple: 'Name',
          points: 'Anchor Points',
          point: 'Point',
          settings: 'Settings',
          classification: 'Reference Surface',
          calcResults: 'Calculated Profiles',
          resolutionProblem:
            'Not enough sample points could be generated. Select a higher resolution or a longer profile line.',
          calc: 'Calculate',
          cancel: 'Cancel',
          dialogText: 'The Height Profile is being calculated.',
          graphAction: 'Show Graph',
          measureLine: 'Measurement Line',
          measurementWarning:
            'A measurement line can only be created if no more than one height line is displayed in the graph.',
          editSessionWarning:
            'Subsequent modification of the geometry deletes all previously calculated profiles.',
          initialMessage:
            'Click the map to define the line of your profile. Double click a location to end your line.',
          tempTitle: 'Temporary Height Profile',
          scaleFactor: 'Scale Factor',
          scaleFactorTooltip:
            'The Scale Factor indicates by how much the elevation values are scaled compared to the horizontal distances in a profile.',
          measurement: {
            start: 'Start Measurement in Graph',
            stop: 'Stop Measurement in Graph',
            clear: 'Delete Measurement in Graph',
          },
          reset: 'Resetting the adjustments to the graph',
          nn: 'Toggle Normal Null Mode',

          helperText: {
            part1:
              'To perform measurements in the profile click on the chart. Define two points of interest. A third click starts a new measurement.',
            part2: '2.  Select the profile in the map to edit it.',
          },
          layerWarning:
            'Layer configuration changed. The diagram may differ from the map display.',
          parameterComponent: 'Calculate Profile',
        },
      },
      de: {
        heightProfile: {
          titleTemporary: 'Höhenprofil',
          heightProfileCalculated: 'Höhenprofil berechnet',
          heightProfileCanceled: 'Berechnung des Höhenprofiles abgebrochen!',
          tooltip: {
            resolution:
              'Die Auflösung definiert den Abstand zwischen den Abtastpunkten des Höhenprofils. Je kleiner die Auflösung ist, desto detaillierter ist das Profil.',
          },
          header: {
            title: 'Höhenprofil',
          },
          collection: {
            add: 'Neues Profil berechnen',
          },
          distance: 'Distanz (m)',
          height: 'Höhe (m)',
          resolutionError: 'Die Auflösung muss größer als 0 sein.',
          edit: 'Geometrie bearbeiten',
          delete: 'Löschen',
          tip: 'Höhenprofil berechnen',
          title: 'Höhenprofil',
          create: 'Höhenprofil',
          classificationType: { DGM: 'DGM', DOM: 'DOM' },
          resolution: 'Auflösung [m]',
          results: 'Berechnung starten',
          new: 'Neu',
          pointsMultiple: 'Name',
          points: 'Stützpunkte',
          point: 'Punkt',
          diagram: 'Berechnete Profile: Diagramm',
          settings: 'Einstellungen',
          classification: 'Bezugsoberfläche',
          calcResults: 'Berechnete Profile',
          calc: 'Berechnen',
          cancel: 'Abbrechen',
          profile: 'Profil',
          dialogText: 'Das Höhenprofil wird berechnet.',
          graphAction: 'Graph anzeigen',
          measureLine: 'Messlinie',
          measurementWarning:
            'Es kann nur eine Messlinie erstellt werden, wenn nicht mehr als eine Höhenlinie im Graph dargestellt wird.',
          editSessionWarning:
            'Die nachträgliche Veränderung der Geometrie löscht alle bisher berechneten Profile.',
          initialMessage:
            'Klicken Sie auf die Karte, um die Linie Ihres Profils zu definieren. Doppelklicken Sie auf eine Stelle, um Ihre Linie zu beenden.',
          tempTitle: 'Temporäres Höhenprofil',
          scaleFactor: 'Überhöhungsfaktor',
          scaleFactorTooltip:
            'Der Überhöhungsfaktor gibt an, um wie viel die Höhenwerte im Vergleich zu den horizontalen Distanzen im Höhenprofil vergrößert dargestellt werden.',
          measurement: {
            start: 'Messung im Graphen starten',
            stop: 'Messung im Graphen stoppen',
            clear: 'Messung im Graphen löschen',
          },
          reset: 'Zurücksetzen der Anpassungen des Graphen',
          nn: 'Normal Null Modus umschalten',
          resolutionProblem:
            'Es konnte nicht ausreichen Samplepunkte generiert werden. Wählen Sie eine höhere Auflösung oder eine längere Profillinie.',
          helperText: {
            part1:
              'Um Messungen im Profil durchzuführen, klicken Sie auf das Diagramm. Definieren Sie zwei Punkte von Interesse. Ein dritter Klick startet eine neue Messung.',
            part2:
              '2.  Wählen Sie das Profil in der Karte aus, um es zu bearbeiten.',
          },
          layerWarning:
            'Ebenenkonfiguration geändert. Das Diagramm kann von der Kartendarstellung abweichen.',
          parameterComponent: 'Profil berechnen',
        },
      },
    },
    destroy(): void {
      destroyListeners.forEach((listener) => listener());
    },
  };
}
