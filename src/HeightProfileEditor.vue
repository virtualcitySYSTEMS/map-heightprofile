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
      <VcsFormButton
        variant="filled"
        :disabled="isCreateSession || isEditSession"
      >
        {{ $t('heightProfile.results') }}
      </VcsFormButton>
    </div>

    <VcsFormSection
      :heading="`heightProfile.points`"
      :header-actions="editActions"
      ><vcs-data-table
        item-key="id"
        :headers="headers"
        :show-searchbar="false"
        :items="points"
      >
      </vcs-data-table>
    </VcsFormSection>

    <div class="d-flex w-full justify-space-between px-2 pt-2 pb-1">
      <VcsFormButton icon="$vcsComponentsPlus" :disabled="isCreateSession" />
      <VcsFormButton
        variant="filled"
        :id="action.name"
        :disabled="isCreateSession"
        :tooltip="action.title"
        @click.stop="action.callback($event)"
      >
        {{ $t('heightProfile.new') }}
      </VcsFormButton>
    </div>
  </v-sheet>
</template>
<script lang="ts">
  import { defineComponent, inject, ref, onUnmounted, computed } from 'vue';
  import { VSheet, VRow, VCol } from 'vuetify/lib';
  import {
    SessionType,
    getFlatCoordinatesFromGeometry,
    CesiumMap,
  } from '@vcmap/core';
  import {
    VcsDataTable,
    VcsFormSection,
    VcsFormButton,
    VcsLabel,
    VcsSelect,
    VcsUiApp,
    VcsTextField,
  } from '@vcmap/ui';
  import { unByKey } from 'ol/Observable.js';
  import { LineString } from 'ol/geom';
  import { Scene } from '@vcmap-cesium/engine';
  import { HeightProfileResult, createAction, ElevationType } from './setup.js';
  import { createHeightProfileCalculation } from './calculationHelper.js';
  import { name } from '../package.json';
  import type { HeightProfilePlugin } from './index.js';

  export const windowIdHeightProfile = 'heightProfileEditor_window_id';
  export default defineComponent({
    name: 'HeightProfileEditorComponent',
    components: {
      VSheet,
      VcsFormSection,
      VcsDataTable,
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
    setup(props) {
      const app = inject<VcsUiApp>('vcsApp')!;
      const plugin = app.plugins.getByKey(name) as HeightProfilePlugin;

      let scene: Scene | undefined;
      if (app.maps.activeMap instanceof CesiumMap) {
        scene = app.maps.activeMap.getScene();
      }
      const isCreateSession = computed(
        () => plugin.session.value?.type === SessionType.CREATE,
      );
      const isEditSession = computed(
        () => plugin.session.value?.type === SessionType.EDIT_GEOMETRY,
      );
      const points = ref();
      const resolution = ref(0.5);
      const elevationType = ref('both');

      const feature = plugin.layer.getFeatureById(props.featureId);
      if (!feature) {
        throw new Error('Feature not found');
      }

      const results = ref<HeightProfileResult[]>(
        (feature.get('results') as HeightProfileResult[] | undefined) ?? [],
      );
      const featureListenerGeometry = feature
        .getGeometry()
        ?.on('change', () => {
          const geometry = feature.getGeometry();
          const coords = getFlatCoordinatesFromGeometry(geometry!);
          const positions = [];
          for (const coord of coords) {
            if (coord) {
              positions.push({
                id: `Punkt ${positions.length + 1}`,
                name: undefined,
                x: coord[0].toFixed(2),
                y: coord[1].toFixed(2),
                z: coord[2].toFixed(2),
              });
            }
          }

          points.value = positions;
        });

      const featureListenerProperty = feature.on('propertychange', (event) => {
        if (event.key === 'results') {
          results.value = feature.get('results') as HeightProfileResult[];
        }
      });

      const { action, destroy } = createAction(
        app,
        plugin.layer,
        plugin.session,
      );

      const headers: Array<{ text: string; value: string }> = [
        {
          text: 'heightProfile.pointsMultiple',
          value: 'id',
        },
        {
          text: 'X',
          value: 'x',
        },
        {
          text: 'Y',
          value: 'y',
        },
        {
          text: 'Z',
          value: 'z',
        },
      ];

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

      const editActions = ref([
        {
          name: 'editAction',
          icon: '$vcsEditVertices',
          title: 'heightProfile.edit',
          disabled: isCreateSession,
          active: isEditSession,
          callback(): void {},
        },
      ]);
      onUnmounted(() => {
        unByKey(featureListenerGeometry!);
        unByKey(featureListenerProperty);
        destroy();
      });

      return {
        createHeightProfileCalculation,
        headers,
        terrainselectvalues,
        points,
        action,
        isCreateSession,
        isEditSession,
        editActions,
        results,
        resolution,
        elevationType,
      };
    },
  });
</script>
<style lang="scss" scoped></style>
