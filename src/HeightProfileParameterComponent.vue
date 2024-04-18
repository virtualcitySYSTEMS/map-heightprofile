<template>
  <v-sheet>
    <VcsFormSection heading="heightProfile.settings">
      <div class="px-2 pt-2 pb-1">
        <v-row no-gutters>
          <v-col cols="6">
            <VcsLabel
              html-for="vp-resolution"
              :title="$t('heightProfile.tooltip.resolution')"
              :dense="true"
            >
              {{ $t('heightProfile.resolution') }}
            </VcsLabel>
          </v-col>
          <v-col>
            <VcsTextField
              id="vp-resolution"
              type="number"
              step="0.01"
              min="0.01"
              :title="$t('heightProfile.tooltip.resolution')"
              show-spin-buttons
              v-model.number="resolution"
            />
          </v-col>
        </v-row>
        <v-row no-gutters>
          <v-col cols="6">
            <VcsLabel html-for="vp-classification-type" :dense="true">
              {{ $t('heightProfile.classification') }}
            </VcsLabel>
          </v-col>
          <v-col>
            <VcsSelect
              id="vp-classification-type"
              :items="terrainselectvalues"
              v-model="elevationType"
              dense
            />
          </v-col>
        </v-row>
      </div>
    </VcsFormSection>
    <div class="d-flex w-full justify-space-between px-2 pt-2 pb-1">
      <VcsFormButton variant="filled" :disabled="disabled" @click="startCalc">
        {{ $t('heightProfile.results') }}
      </VcsFormButton>
    </div>
    <v-dialog v-model="dialogVisible" max-width="500" persistent>
      <v-card>
        <div class="px-2 pt-2 pb-1">
          <v-card-text>
            {{ $t('heightProfile.dialogText') }}
          </v-card-text>
          <v-progress-linear :value="progressBar"></v-progress-linear>
          <v-card-actions>
            <VcsFormButton color="primary" @click="cancelCalc">{{
              $t('heightProfile.cancel')
            }}</VcsFormButton>
          </v-card-actions>
        </div>
      </v-card>
    </v-dialog>
  </v-sheet>
</template>
<script lang="ts">
  import { Ref, defineComponent, inject, onUnmounted, ref } from 'vue';
  import {
    VCol,
    VRow,
    VSheet,
    VDialog,
    VCard,
    VCardText,
    VCardActions,
    VProgressLinear,
  } from 'vuetify/lib';

  import { v4 as uuidv4 } from 'uuid';
  import {
    VcsFormSection,
    VcsFormButton,
    VcsUiApp,
    VcsLabel,
    VcsSelect,
    VcsTextField,
    NotificationType,
    CollectionComponentClass,
    CollectionComponentListItem,
  } from '@vcmap/ui';

  import { Scene } from '@vcmap-cesium/engine';
  import { CesiumMap, Collection } from '@vcmap/core';
  import { LineString } from 'ol/geom.js';
  import { name } from '../package.json';
  import type { HeightProfilePlugin } from './index.js';
  import {
    ElevationType,
    HeightProfileResult,
  } from './setupResultCollectionComponent.js';
  import {
    CancelledError,
    createHeightProfileCalculation,
  } from './helper/calculationHelper.js';

  export const windowIdSetParameter = 'heightProfileSetParameter_window_id';
  export default defineComponent({
    name: 'HeightProfileParameterComponent',
    components: {
      VSheet,
      VcsFormSection,
      VDialog,
      VCard,
      VcsFormButton,
      VCardText,
      VCardActions,
      VProgressLinear,
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
      const resolution = ref(0.5);
      const elevationType = ref('both') as Ref<ElevationType>;
      const dialogVisible = ref(false);
      const progressBar = ref(0);
      const disabled = ref(true);
      const mapListener = app.maps.mapActivated.addEventListener((item) => {
        disabled.value = !(item instanceof CesiumMap);
      });
      const collection = inject(
        'collection',
      ) as Collection<HeightProfileResult>;
      const collectionComponent = inject(
        'collectionComponent',
      ) as CollectionComponentClass<HeightProfileResult>;
      const terrainselectvalues: Array<{ text: string; value: string }> = [
        {
          value: 'terrain',
          text: 'heightProfile.classificationType.DGM',
        },
        {
          value: 'both',
          text: 'heightProfile.classificationType.DOM',
        },
      ];

      let scene: Scene | undefined;
      if (app.maps.activeMap instanceof CesiumMap) {
        disabled.value = false;
        scene = app.maps.activeMap.getScene();
      }
      function calculateHeightProfile(): () => void {
        if (scene) {
          const geometry = feature?.getGeometry() as LineString;
          const { ready, cancel, progress, resolutionValue } =
            createHeightProfileCalculation(
              geometry,
              resolution.value,
              elevationType.value as ElevationType,
              1000,
              scene,
            );
          dialogVisible.value = true;
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
                const item: HeightProfileResult = {
                  name: collName,
                  properties: {
                    // title: `${String(app.vueI18n.t('heightProfile.profile'))}-${collection.size + 1}`,
                    title: `profile-${collection.size + 1}`,
                  },

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
              dialogVisible.value = false;
            })
            .catch((err) => {
              app.notifier.add({
                type: NotificationType.ERROR,
                message: String(err.message),
              });
              dialogVisible.value = false;
            });
          return cancel;
        }
        return () => {};
      }

      let cancelFunc: () => void = () => {};
      const startCalc = (): void => {
        cancelFunc = calculateHeightProfile();
      };

      const cancelCalc = (): void => {
        cancelFunc();
      };
      onUnmounted(() => {
        mapListener();
      });

      return {
        terrainselectvalues,
        disabled,
        resolution,
        elevationType,
        dialogVisible,
        startCalc,
        cancelCalc,
        progressBar,
      };
    },
  });
</script>
<style lang="scss" scoped></style>
