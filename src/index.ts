import { VcsPlugin, VcsUiApp } from '@vcmap/ui';
import { CreateFeatureSession, GeometryType, VectorLayer } from '@vcmap/core';
import { ShallowRef } from 'vue';
import { name, version, mapVersion } from '../package.json';

import {
  createHeightProfileLayer,
  createSessionReference,
  createToolboxButton,
} from './setup.js';

type PluginConfig = Record<never, never>;
type PluginState = Record<never, never>;

export type HeightProfilePlugin = VcsPlugin<PluginConfig, PluginState> & {
  readonly layer: VectorLayer;
  readonly session: ShallowRef<
    CreateFeatureSession<GeometryType.LineString> | undefined
  >;
};

export default function plugin(): HeightProfilePlugin {
  let layer: VectorLayer | undefined;
  const destroyListeners: Array<() => void> = [];

  let session:
    | ShallowRef<CreateFeatureSession<GeometryType.LineString> | undefined>
    | undefined;

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
    get session(): ShallowRef<
      CreateFeatureSession<GeometryType.LineString> | undefined
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
      const { destroy: destroySessionWatcher, session: sessionWatched } =
        createSessionReference(vcsUiApp);
      session = sessionWatched;

      const destroyToolbox = createToolboxButton(vcsUiApp, layer, session);

      destroyListeners.push(
        destroyLayer,
        destroySessionWatcher,
        destroyToolbox,
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
          tooltip: {
            resolution:
              'The resolution defines the distance between the sampeling points of the height profile. The smaller the resolution, the more detailed the profile.',
          },
          header: {
            title: 'Height Profile',
          },
          edit: 'Edit',
          title: 'Height Profile',
          create: 'Create',
          classificationType: { DGM: 'DEM', DOM: 'DSM' },
          resolution: 'Resolution [m]',
          results: 'Show Results',
          new: 'New',
          pointsMultiple: 'Ancor Points',
          points: 'Points',
          settings: 'Profile Settings',
          classification: 'Classification Type',
        },
      },
      de: {
        heightProfile: {
          tooltip: {
            resolution:
              'Die Auflösung definiert den Abstand zwischen den Abtastpunkten des Höhenprofils. Je kleiner die Auflösung ist, desto detaillierter ist das Profil.',
          },
          header: {
            title: 'Höhenprofil',
          },
          edit: 'Bearbeiten',
          title: 'Höhenprofil',
          create: 'Erstellen',
          classificationType: { DGM: 'DGM', DOM: 'DOM' },
          resolution: 'Auflösung [m]',
          results: 'Ergebnisse anzeigen',
          new: 'Neu',
          pointsMultiple: 'Ankerpunkte',
          points: 'Punkte',
          settings: 'Profil Einstellungen',
          classification: 'Klassifikationstyp',
        },
      },
    },
    destroy(): void {
      destroyListeners.forEach((listener) => listener());
    },
  };
}
