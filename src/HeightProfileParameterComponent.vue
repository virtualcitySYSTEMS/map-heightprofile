<template>
  <v-sheet>
    <VcsFormSection heading="heightProfile.settings">
      <div class="px-2 pt-2 pb-1">
        <v-row no-gutters>
          <v-col cols="6">
            <VcsLabel
              html-for="vp-resolution"
              :help-text="$t('heightProfile.tooltip.resolution')"
            >
              {{ $t('heightProfile.resolution') }}
            </VcsLabel>
          </v-col>
          <v-col>
            <VcsTextField
              id="vp-resolution"
              v-model.number="resolution"
              type="number"
              :step="1"
              show-spin-buttons
              :rules="[resolutionRule]"
            />
          </v-col>
        </v-row>
        <v-row no-gutters>
          <v-col cols="6">
            <VcsLabel html-for="vp-classification-type">
              {{ $t('heightProfile.classification') }}
            </VcsLabel>
          </v-col>
          <v-col>
            <VcsSelect
              id="vp-classification-type"
              v-model="elevationType"
              :items="terrainselectvalues"
            />
          </v-col>
        </v-row>
      </div>
    </VcsFormSection>
    <div class="d-flex w-full justify-end px-2 pt-2 pb-1">
      <VcsFormButton
        variant="filled"
        :disabled="disabled || resolution <= 0"
        @click="calculateHeightProfile"
      >
        {{ $t('heightProfile.results') }}
      </VcsFormButton>
    </div>
  </v-sheet>
</template>
<script lang="ts">
  import type { Ref } from 'vue';
  import { defineComponent, inject, onUnmounted, ref, onMounted } from 'vue';
  import { VCol, VRow, VSheet } from 'vuetify/components';

  import { v4 as uuidv4 } from 'uuid';
  import type {
    VcsUiApp,
    CollectionComponentClass,
    CollectionComponentListItem,
  } from '@vcmap/ui';
  import {
    VcsFormSection,
    VcsFormButton,
    VcsLabel,
    VcsSelect,
    VcsTextField,
    NotificationType,
    addLoadingOverlay,
  } from '@vcmap/ui';

  import type { Collection } from '@vcmap/core';
  import { CesiumMap } from '@vcmap/core';
  import type { LineString } from 'ol/geom.js';
  import { name } from '../package.json';
  import type { HeightProfilePlugin } from './index.js';
  import type {
    ElevationType,
    HeightProfileResult,
  } from './setupResultCollectionComponent.js';
  import {
    CancelledError,
    createHeightProfileCalculation,
  } from './helper/calculationHelper.js';

  interface TerrainSelectItem {
    title: string;
    value: string;
    props: { disabled: boolean };
  }

  export const windowIdSetParameter = 'heightProfileSetParameter_window_id';

  export default defineComponent({
    name: 'HeightProfileParameterComponent',
    components: {
      VSheet,
      VcsFormSection,
      VcsFormButton,
      VRow,
      VCol,
      VcsLabel,
      VcsSelect,
      VcsTextField,
    },
    props: {
      featureId: {
        type: String,
        required: true,
      },
    },
    setup({ featureId }) {
      const app = inject<VcsUiApp>('vcsApp')!;
      const plugin = app.plugins.getByKey(name) as HeightProfilePlugin;
      const feature = plugin.layer.getFeatureById(featureId);
      const resolution = ref(1);
      const elevationType = ref('both') as Ref<ElevationType>;
      const progressBar = ref(0);
      const disabled = ref(!(app.maps.activeMap instanceof CesiumMap));
      const mapListener = app.maps.mapActivated.addEventListener((item) => {
        disabled.value = !(item instanceof CesiumMap);
      });
      const collection = inject(
        'collection',
      ) as Collection<HeightProfileResult>;
      const collectionComponent = inject(
        'collectionComponent',
      ) as CollectionComponentClass<HeightProfileResult>;
      const terrainselectvalues: Ref<Array<TerrainSelectItem>> = ref([
        {
          value: 'terrain',
          title: 'heightProfile.classificationType.DGM',
          props: { disabled: false }, // set if terrain in map
        },
        {
          value: 'both',
          title: 'heightProfile.classificationType.DOM',
          props: { disabled: false },
        },
      ]);

      function checkTerrain(): void {
        if (app.maps.activeMap instanceof CesiumMap) {
          terrainselectvalues.value[0].props.disabled =
            app.maps.activeMap.terrainProvider ===
            app.maps.activeMap.defaultTerrainProvider;
        }
      }

      const layerListener = app.layers.stateChanged.addEventListener(() => {
        checkTerrain();
      });

      function calculateHeightProfile(): void {
        if (app.maps.activeMap instanceof CesiumMap) {
          const scene = app.maps.activeMap.getScene()!;
          const geometry = feature?.getGeometry() as LineString;
          const { ready, cancel, progress, resolutionValue } =
            createHeightProfileCalculation(
              geometry,
              resolution.value,
              elevationType.value,
              1000,
              scene,
              app,
            );
          const removeLoadingOverlay = addLoadingOverlay(app, name, {
            progress: progressBar,
            title: 'heightProfile.dialogText',
            cancel,
          });
          progress.addEventListener((event) => {
            progressBar.value = event;
          });

          ready
            .then((resultPoints) => {
              if (resultPoints.ok) {
                const collName = uuidv4();
                const appLayers = [...app.layers].filter(
                  (layer) => layer.active,
                );
                const layerNames = appLayers.map((layer) => layer.name);
                let number = 1;
                let title = `profile-${collection.size + number}`;

                const titleExistsInCollection = (): boolean => {
                  return [...collection].some(
                    (item) => item.properties.title === title,
                  );
                };

                while (titleExistsInCollection()) {
                  number += 1;
                  title = `profile-${collection.size + number}`;
                }

                const item: HeightProfileResult = {
                  name: collName,
                  properties: { title },
                  resolution: resolutionValue,
                  elevationType: elevationType.value,
                  layerNames,
                  resultPoints: resultPoints.points,
                };
                collection.add(item);
                app.windowManager.remove(windowIdSetParameter);

                const listItem = collectionComponent.getListItemForItem(
                  item,
                ) as CollectionComponentListItem;
                collectionComponent.selection.value = [listItem];
              } else if (!resultPoints.ok) {
                if (resultPoints.error instanceof CancelledError) {
                  app.notifier.add({
                    type: NotificationType.WARNING,
                    message: 'heightProfile.heightProfileCanceled',
                  });
                } else {
                  app.notifier.add({
                    type: NotificationType.ERROR,
                    message: String(resultPoints.error),
                  });
                }
              }
            })
            // eslint-disable-next-line @typescript-eslint/use-unknown-in-catch-callback-variable
            .catch((err) => {
              app.notifier.add({
                type: NotificationType.ERROR,
                message: String(err.message),
              });
            })
            .finally(removeLoadingOverlay);
        }
      }

      onMounted(() => {
        checkTerrain();
      });
      onUnmounted(() => {
        mapListener();
        layerListener();
      });

      return {
        terrainselectvalues,
        disabled,
        resolution,
        elevationType,
        calculateHeightProfile,
        resolutionRule: (v: number): boolean | string =>
          v > 0 || 'heightProfile.resolutionError',
      };
    },
  });
</script>
<style lang="scss" scoped></style>
