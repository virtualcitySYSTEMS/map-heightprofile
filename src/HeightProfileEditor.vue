<template>
  <v-sheet>
    {{ state }}
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
              :disabled="!['created', 'synced', 'desynced'].includes(state)"
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
              v-model="olcs_classificationType"
              :disabled="!['created', 'synced', 'desynced'].includes(state)"
              dense
            />
          </v-col>
        </v-row>
      </div>
    </VcsFormSection>
    <div class="d-flex w-full justify-space-between px-2 pt-2 pb-1">
      <VcsFormButton
        variant="filled"
        icon="$vcsRotateRight"
        :disabled="!['desynced'].includes(state)"
      >
      </VcsFormButton>
      <VcsFormButton
        variant="filled"
        :disabled="!['synced', 'created'].includes(state)"
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
      <VcsFormButton
        icon="$vcsComponentsPlus"
        :disabled="!['created', 'synced', 'desynced'].includes(state)"
      />
      <VcsFormButton
        variant="filled"
        :id="action.name"
        :disabled="!['created', 'synced', 'desynced'].includes(state)"
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
  import { getFlatCoordinatesFromGeometry } from '@vcmap/core';
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
  import { HeightProfilFeatureProperties, createAction } from './setup.js';
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

      const points = ref();

      const feature = plugin.layer.getFeatureById(props.featureId);
      if (!feature) {
        throw new Error('Feature not found');
      }

      const featureProperties =
        feature.getProperties() as HeightProfilFeatureProperties;
      const state = ref(featureProperties.state);
      const resolution = ref(featureProperties.resolution);
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const olcs_classificationType = ref(
        featureProperties.olcs_classificationType,
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
        if (event.key === 'state') {
          state.value = feature.get('state');
        } else if (event.key === 'resolution') {
          resolution.value = feature.get('resolution');
        } else if (event.key === 'olcs_classificationType') {
          olcs_classificationType.value = feature.get(
            'olcs_classificationType',
          );
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
          disabled: computed(
            () => !['created', 'synced', 'desynced'].includes(state.value),
          ),
          callback(): void {},
        },
      ]);
      onUnmounted(() => {
        unByKey(featureListenerGeometry!);
        unByKey(featureListenerProperty);
        destroy();
      });

      return {
        headers,
        terrainselectvalues,
        points,
        action,
        state,
        editActions,
        resolution: computed({
          get: () => resolution.value,
          set: (value) => {
            if (value > 0) {
              feature.set('resolution', value);
            }
          },
        }),
        olcs_classificationType: computed({
          get: () => olcs_classificationType.value,
          set: (value) => {
            feature.set('olcs_classificationType', value);
          },
        }),
      };
    },
  });
</script>
<style lang="scss" scoped></style>
