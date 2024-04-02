import { VcsPlugin, VcsUiApp } from '@vcmap/ui';
import {
  CreateFeatureSession,
  EditGeometrySession,
  GeometryType,
  VectorLayer,
} from '@vcmap/core';
import { ShallowRef } from 'vue';
import { name, version, mapVersion } from '../package.json';

import {
  HeightProfileSessionType,
  createHeightProfileLayer,
  createSessionReference,
  createToolboxButton,
  createVectorLayer,
} from './setup.js';

type PluginConfig = Record<never, never>;
type PluginState = Record<never, never>;

export type HeightProfilePlugin = VcsPlugin<PluginConfig, PluginState> & {
  readonly layer: VectorLayer;
  readonly measurementLayer: VectorLayer;
  readonly session: ShallowRef<HeightProfileSessionType>;
};

export default function plugin(): HeightProfilePlugin {
  let layer: VectorLayer | undefined;
  let measurementLayer: VectorLayer | undefined;
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
      const { destroy: destroyMeasurementLayer, layer: layerMeasure } =
        await createVectorLayer(vcsUiApp);
      measurementLayer = layerMeasure;
      const { destroy: destroySessionWatcher, session: sessionWatched } =
        createSessionReference(vcsUiApp);
      session = sessionWatched;

      const destroyToolbox = createToolboxButton(vcsUiApp, layer, session);

      destroyListeners.push(
        destroyLayer,
        destroySessionWatcher,
        destroyToolbox,
        destroyMeasurementLayer,
      );

      return Promise.resolve();
    },
    /**
     * should return all default values of the configuration
     */
    getDefaultOptions(): PluginConfig {
      return {};
    },
    /**
     * should return the plugin's serialization excluding all default values
     */
    toJSON(): PluginConfig {
      return {};
    },
    i18n: {
      en: {
        heightProfile: {
          heightProfileCalculated: 'Height Profile Calculated',
          heightProfileCanceled:
            'Calculation of the heightprofile was canceled!',
          tooltip: {
            resolution:
              'The resolution defines the distance between the sampeling points of the height profile. The smaller the resolution, the more detailed the profile.',
          },
          header: {
            title: 'Height Profile',
          },
          collection: {
            add: 'Create Height Profile',
          },
          edit: 'Edit',
          title: 'Height Profile',
          create: 'Create',
          classificationType: { DGM: 'DEM', DOM: 'DSM' },
          resolution: 'Resolution [m]',
          results: 'Create Result',
          new: 'New',
          pointsMultiple: 'Ancor Points',
          points: 'Points',
          point: 'Point',
          settings: 'Profile Settings',
          classification: 'Classification Type',
          calcResults: 'Height Profiles',
          calc: 'Calculate',
          cancel: 'Cancel',
          dialogText: 'The Height Profile is beeing calculated.',
          graphAction: 'Show Graph',
          measureLine: 'Measurement Line',
          measurementWarning:
            'A measurement line can only be created if no more than one height line is displayed in the graph.',
        },
      },
      de: {
        heightProfile: {
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
            add: 'Erstellen eines Höhenprofils',
          },
          edit: 'Bearbeiten',
          title: 'Höhenprofil',
          create: 'Erstellen',
          classificationType: { DGM: 'DGM', DOM: 'DOM' },
          resolution: 'Auflösung [m]',
          results: 'Ergebnis erstellen',
          new: 'Neu',
          pointsMultiple: 'Ankerpunkte',
          points: 'Punkte',
          point: 'Punkt',
          settings: 'Profil Einstellungen',
          classification: 'Klassifikationstyp',
          calcResults: 'Höhenprofile',
          calc: 'Berechnen',
          cancel: 'Abbrechen',
          dialogText: 'Das Höhenprofil wird berechnet.',
          graphAction: 'Graph Anzeigen',
          measureLine: 'Messlinie',
          measurementWarning:
            'Es kann nur eine Messlinie erstellt werden, wenn nicht mehr als eine Höhenlinie im Graph dargestellt wird.',
        },
      },
    },
    destroy(): void {
      destroyListeners.forEach((listener) => listener());
    },
  };
}
