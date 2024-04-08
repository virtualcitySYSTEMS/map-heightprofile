<template>
  <VcsFormSection style="width: 100%">
    <v-container>
      <v-sheet>
        {{ $t('heightProfile.title') }}

        <div id="chart">
          <apexchart
            type="line"
            height="350"
            :options="chartOptions"
            :series="series"
          >
          </apexchart>
        </div>
      </v-sheet>
    </v-container>
  </VcsFormSection>
</template>
<script lang="ts">
  import { defineComponent, inject, onUnmounted } from 'vue';
  import { VContainer, VSheet } from 'vuetify/lib';
  import { VcsFormSection, VcsUiApp } from '@vcmap/ui';
  import VueApexCharts from 'vue-apexcharts';
  import { HeightProfilePlugin } from 'src';
  import { Collection } from '@vcmap/core';
  import { name } from '../package.json';
  import { HeightProfileResult } from './setup.js';
  import { setupChart } from './chart.js';

  export default defineComponent({
    name: 'GraphComponent',
    components: {
      VContainer,
      VSheet,
      VcsFormSection,
      apexchart: VueApexCharts,
    },
    props: {
      featureId: {
        type: String,
        required: true,
      },
      resultNames: {
        type: Array<string>,
        required: true,
      },
    },

    setup(props) {
      const app = inject<VcsUiApp>('vcsApp')!;
      const plugin = app.plugins.getByKey(name) as HeightProfilePlugin;
      const feature = plugin.layer.getFeatureById(props.featureId);
      const results = feature?.get(
        'results',
      ) as Collection<HeightProfileResult>;

      const { series, chartOptions, destroy } = setupChart(
        app,
        results,
        props.resultNames,
      );

      onUnmounted(() => {
        // plugin.measurementLayer.removeAllFeatures();
        destroy();
      });

      return {
        chartOptions,
        series,
      };
    },
  });
</script>
<style scoped lang="scss"></style>
