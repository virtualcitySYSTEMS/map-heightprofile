<template>
  <v-container>
    <v-row v-if="layerWarning" no-gutters>
      <v-col>
        <VCard class="spaceFormat">
          <VcsLabel html-for="vp-resolution"
            ><v-icon icon="mdi-alert">mdi-alert</v-icon>
            {{ $t('heightProfile.layerWarning') }}
          </VcsLabel>
        </VCard>
      </v-col>
    </v-row>
    <div class="distance-top" id="chart">
      <apexchart
        ref="demoChart"
        type="line"
        height="350"
        :options="chartOptions"
        :series="series"
      >
      </apexchart>
    </div>
    <div class="px-2 pt-2 pb-1">
      <v-row no-gutters>
        <v-col class="width-constraint">
          <VcsLabel
            html-for="vp-scaleFactor"
            :title="$t('heightProfile.scaleFactor')"
            :dense="true"
          >
            {{ $t('heightProfile.scaleFactor') }}
          </VcsLabel>
        </v-col>
        <v-col class="width-constraint">
          <VcsTextField
            id="vp-scaleFactor"
            type="number"
            :step="1"
            :decimals="2"
            :min="0.0"
            :title="$t('heightProfile.scaleFactor')"
            show-spin-buttons
            v-model.number="scaleFactorSave"
            @input="callScaleFactor"
            :disabled="nnActive"
          />
        </v-col>
      </v-row>
    </div>
  </v-container>
</template>
<script lang="ts">
  import { defineComponent, inject, onUnmounted, Ref, ref } from 'vue';
  import { VCol, VContainer, VRow, VCard, VIcon } from 'vuetify/lib';
  import { VcsLabel, VcsTextField, VcsUiApp } from '@vcmap/ui';
  import VueApexCharts from 'vue-apexcharts';
  import { HeightProfilePlugin } from 'src';
  import { name } from '../package.json';
  import {
    HeightProfileFeature,
    resultCollectionSymbol,
  } from './heightProfileFeature.js';
  import { setupChart } from './chart.js';
  import { type ApexChartContext } from './helper/measurementHelper.js';
  import { setScaleFactor } from './helper/scaleFactorHelper.js';

  export default defineComponent({
    name: 'GraphComponent',
    components: {
      VCol,
      VIcon,
      VRow,
      VContainer,
      VcsTextField,
      VcsLabel,
      VCard,
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
      const feature = plugin.layer.getFeatureById(
        props.featureId,
      ) as HeightProfileFeature;
      const results = feature[resultCollectionSymbol];

      function checkLayers(): boolean {
        return [...results].some((result) => {
          return result.layerNames.some((layerName) => {
            const layer = app.layers.getByKey(layerName);
            return layer ? !layer.active : false;
          });
        });
      }

      const layerWarning = ref(checkLayers());

      const layerListener = app.layers.stateChanged.addEventListener(() => {
        layerWarning.value = checkLayers();
      });

      interface ChartObject {
        chart: ApexChartContext;
      }

      const demoChart: Ref<ChartObject | undefined> = ref();
      const {
        series,
        chartOptions,
        scaleFactorSave,
        scaleFactorInitial,
        nnActive,
        destroy,
      } = setupChart(app, results, props.resultNames);

      function callScaleFactor(): void {
        if (demoChart.value) {
          setScaleFactor(
            demoChart.value.chart,
            scaleFactorSave,
            scaleFactorInitial,
          );
        }
      }

      onUnmounted(() => {
        destroy();
        layerListener();
      });

      return {
        callScaleFactor,
        layerWarning,
        demoChart,
        chartOptions,
        series,
        scaleFactorSave,
        nnActive,
      };
    },
  });
</script>
<style lang="scss">
  .apexcharts-zoomin-icon svg,
  .apexcharts-zoomout-icon svg {
    transform: scale(1) !important;
    height: 20px !important;
    width: 20px !important;
  }

  .apexcharts-pan-icon svg {
    height: 20px !important;
    width: 20px !important;
  }
  .apexcharts-menu-icon svg {
    width: 20px !important;
    height: 20px !important;
  }
  .apexcharts-menu-icon {
    transform: scale(1) !important;
    border-left: 2px solid #6e8192;
    padding-left: 1em;
    margin-left: 1em;
  }
  .apexcharts-menu-icon,
  .apexcharts-reset-icon,
  .apexcharts-zoom-icon {
    transform: scale(1) !important;
  }
  .apexcharts-reset-icon,
  .apexcharts-zoom-icon {
    transform: scale(1) !important;
  }
  .custom-icon-nn {
    transform: scale(1) !important;
    margin-right: 1em;
    border-left: 2px solid #6e8192;
    padding-left: 1em;
    margin-left: 1em;
  }
  .custom-icon-start svg {
    width: 20px !important;
    height: 20px !important;
  }
  .custom-icon-start {
    border-left: 2px solid #6e8192;
    padding-left: 1em;
    margin-left: 1em;
    fill: #6e8192;
    margin-right: 1em;
  }
  .custom-icon-clear {
    fill: #6e8192;
  }
  .custom-icon-clear svg {
    transform: scale(1) !important;
    width: 20px !important;
    height: 20px !important;
    margin-left: 0.3em;
  }
  .custom-icon.apexcharts-selected svg {
    fill: var(--v-primary-base) !important;
    width: 20px !important;
    height: 20px !important;
  }
  .apexcharts-selected svg {
    fill: var(--v-primary-base) !important;
  }
  .apexcharts-toolbar {
    max-width: 600px !important;
    top: -5px !important;
    right: 30px !important;
  }
  .apexcharts-pan-icon.apexcharts-selected svg {
    stroke: var(--v-primary-base) !important;
    width: 20px !important;
    height: 20px !important;
  }
  .spaceFormat {
    margin-bottom: 1em;
  }
  .width-constraint {
    max-width: 150px;
  }
  .distance-top {
    margin-top: 0.5em;
  }
</style>
