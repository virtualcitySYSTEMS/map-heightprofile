<template>
  <v-container>
    <v-row v-if="layerWarning" no-gutters>
      <v-col>
        <VCard class="spaceFormat">
          <VcsLabel html-for="vp-resolution"
            ><v-icon class="marginClass" icon="mdi-alert">mdi-alert</v-icon>
            {{ $t('heightProfile.layerWarning') }}
          </VcsLabel>
        </VCard>
      </v-col>
    </v-row>
    <div id="chart" class="distance-top">
      <apexchart
        id="apexChartId"
        ref="demoChart"
        type="line"
        height="350"
        :options="chartOptions"
        :series="series"
        @click="apexClick"
        @mounted="apexMounted"
        @animation-end="apexAnimationEnd"
        @mouse-move="apexMouseMove"
        @mouse-leave="apexMouseLeave"
        @scrolled="apexScrolled"
      >
      </apexchart>
    </div>
    <div class="px-2 pt-2 pb-1">
      <v-row no-gutters>
        <v-col class="width-constraint">
          <VcsLabel
            html-for="vp-scaleFactor"
            :help-text="$t('heightProfile.scaleFactorTooltip')"
          >
            {{ $t('heightProfile.scaleFactor') }}
          </VcsLabel>
        </v-col>
        <v-col class="width-constraint">
          <VcsTextField
            id="vp-scaleFactor"
            v-model.number="scaleFactorSave"
            type="number"
            :step="1"
            :min="0.0"
            show-spin-buttons
            :decimals="2"
            :disabled="nnActive"
            @focusin="scaleFactorManuallySet = true"
            @focusout="scaleFactorManuallySet = false"
            @input="callScaleFactor"
          />
        </v-col>
      </v-row>
    </div>
  </v-container>
</template>
<script lang="ts">
  import type { Ref } from 'vue';
  import { defineComponent, inject, onUnmounted, ref } from 'vue';
  import { VCol, VContainer, VRow, VCard, VIcon } from 'vuetify/components';
  import type { VcsUiApp } from '@vcmap/ui';
  import { NotificationType, VcsLabel, VcsTextField } from '@vcmap/ui';
  import VueApexCharts from 'vue3-apexcharts';
  import type { HeightProfilePlugin } from 'src';
  import type {
    ApexChartContext,
    ChartObject,
    ApexConfig,
    ChartMeasurement,
  } from 'apexcharts';
  import { name } from '../package.json';
  import type { HeightProfileFeature } from './heightProfileFeature.js';
  import { resultCollectionSymbol } from './heightProfileFeature.js';
  import { addScaleFactorToGraph, placeTooltip, setupChart } from './chart.js';
  import {
    addMeasurementAnnotationsToGraph,
    startChartMeasurement,
  } from './helper/measurementHelper.js';
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

      const measurementActive = ref(false);
      const scaleFactorManuallySet = ref(false);
      const currentMeasurement: Ref<ChartMeasurement | undefined> =
        ref(undefined);
      const normalNMode = ref(false);

      const scaleFactorSave: Ref<number> = ref(0);
      const scaleFactorInitial: Ref<number> = ref(0);

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

      const demoChart: Ref<ChartObject | undefined> = ref();

      const { series, chartOptions, nnActive, destroy } = setupChart(
        app,
        results,
        props.resultNames,
        scaleFactorInitial,
        scaleFactorSave,
        currentMeasurement,
        normalNMode,
        measurementActive,
        scaleFactorManuallySet,
      );

      function callScaleFactor(): void {
        if (demoChart.value) {
          setScaleFactor(demoChart.value, scaleFactorSave, scaleFactorInitial);
        }
      }

      const themeChanged = app.themeChanged.addEventListener(() => {
        demoChart.value?.resetSeries();
      });

      function apexClick(
        _event: object,
        _chartContext: ApexChartContext,
        config: ApexConfig,
      ): void {
        if (measurementActive.value) {
          if (config.dataPointIndex >= 0) {
            if (series?.length === 1 || currentMeasurement.value?.finished) {
              const value = series[0].data[config.dataPointIndex];
              if (
                currentMeasurement?.value &&
                !currentMeasurement.value.finished
              ) {
                currentMeasurement.value.addValue(value);
              } else {
                if (currentMeasurement?.value) {
                  currentMeasurement.value.destroy();
                }

                currentMeasurement.value = startChartMeasurement(
                  app,
                  demoChart.value!,
                  series,
                  results,
                  measurementActive,
                  value,
                );
              }
              if (demoChart.value) {
                addScaleFactorToGraph(
                  demoChart.value,
                  app,
                  scaleFactorInitial,
                  scaleFactorSave,
                  scaleFactorManuallySet,
                );
              }
            } else {
              app.notifier.add({
                type: NotificationType.WARNING,
                message: String('heightProfile.measurementWarning'),
              });
            }
          }
        }
      }

      function apexMounted(): void {
        if (demoChart?.value) {
          addScaleFactorToGraph(
            demoChart.value,
            app,
            scaleFactorInitial,
            scaleFactorSave,
            scaleFactorManuallySet,
            true,
          );
        }
      }

      function apexAnimationEnd(): void {
        if (demoChart?.value) {
          addScaleFactorToGraph(
            demoChart.value,
            app,
            scaleFactorInitial,
            scaleFactorSave,
            scaleFactorManuallySet,
          );

          if (currentMeasurement.value?.values) {
            addMeasurementAnnotationsToGraph(
              currentMeasurement.value.values,
              demoChart.value,
              app,
            );
          }
        }
        const iconNN = document.querySelector('.custom-icon-nn');
        const iconStart = document.querySelector('.custom-icon-start');
        if (iconNN) {
          if (normalNMode.value) {
            iconNN.classList.add('primary--text');
          } else {
            iconNN.classList.remove('primary--text');
          }
        }
        if (iconStart) {
          if (measurementActive.value) {
            iconStart.classList.add('primary--text');
          } else {
            iconStart.classList.remove('primary--text');
          }
        }
      }

      function apexMouseMove(
        _event: object,
        _chartContext: ApexChartContext,
        config: ApexConfig,
      ): void {
        if (config.dataPointIndex >= 0) {
          const values = results.getByKey(series[config.seriesIndex].id);
          const point = values?.resultPoints[config.dataPointIndex];
          if (point) {
            placeTooltip(plugin, point);
          }
        } else {
          plugin.measurementLayer.removeFeaturesById(['_tooltip']);
        }
      }

      function apexMouseLeave(): void {
        plugin.layer.removeFeaturesById(['_tooltip']);
      }

      function apexScrolled(): void {
        if (demoChart.value) {
          addScaleFactorToGraph(
            demoChart.value,
            app,
            scaleFactorInitial,
            scaleFactorSave,
            scaleFactorManuallySet,
          );
          if (currentMeasurement.value!.values) {
            addMeasurementAnnotationsToGraph(
              currentMeasurement.value!.values,
              demoChart.value,
              app,
            );
          }
        }
      }

      onUnmounted(() => {
        currentMeasurement.value = undefined;
        destroy();
        layerListener();
        themeChanged();
      });

      return {
        callScaleFactor,
        layerWarning,
        demoChart,
        chartOptions,
        series,
        scaleFactorSave,
        nnActive,
        apexClick,
        apexMounted,
        apexAnimationEnd,
        apexMouseMove,
        apexMouseLeave,
        apexScrolled,
        scaleFactorManuallySet,
      };
    },
  });
</script>
<style lang="scss" scoped>
  :deep(.marginClass) {
    margin-left: calc(var(--v-vcs-font-size) * 1);
    margin-right: calc(var(--v-vcs-font-size) * 1);
  }
  :deep(.apexcharts-zoomin-icon svg),
  :deep(.apexcharts-pan-icon svg) {
    height: 20px !important;
    width: 20px !important;
  }
  :deep(.apexcharts-menu-icon svg) {
    width: 20px !important;
    height: 20px !important;
  }

  :deep(.custom-icon-start svg) {
    width: 20px !important;
    height: 20px !important;
    z-index: 5;
  }
  :deep(.custom-icon-start) {
    fill: #6e8192;
  }
  :deep(.custom-icon-clear) {
    fill: #6e8192;
  }

  :deep(.custom-icon.apexcharts-selected svg) {
    fill: rgb(var(--v-theme-primary)) !important;
    width: 20px !important;
    height: 20px !important;
  }
  :deep(.apexcharts-selected svg) {
    fill: rgb(var(--v-theme-primary)) !important;
  }
  :deep(.apexcharts-toolbar) {
    max-width: 600px !important;
    top: -5px !important;
    right: 30px !important;
  }
  :deep(.apexcharts-pan-icon.apexcharts-selected svg) {
    stroke: rgb(var(--v-theme-primary)) !important;
    width: 20px !important;
    height: 20px !important;
  }
  :deep(.spaceFormat) {
    margin-bottom: 1em;
  }
  :deep(.width-constraint) {
    max-width: 150px;
  }
  :deep(.distance-top) {
    margin-top: 0.5em;
  }
  :deep(.apexcharts-xaxis),
  :deep(.apexcharts-yaxis),
  :deep(.apexcharts-legend-text) {
    stroke: rgb(var(--v-theme-base)) !important;
    color: unset !important;
  }
  :deep(.apexcharts-xaxis-title),
  :deep(.apexcharts-yaxis-title),
  :deep(.apexcharts-xaxis),
  :deep(.apexcharts-yaxis) {
    stroke: rgb(var(--v-theme-base)) !important;
    stroke-width: 0.3px;
  }
  :deep(.apexcharts-tooltip) {
    background-color: rgb(var(--v-theme-base-lighten-4)) !important;
    color: unset !important;
    border-color: rgb(var(--v-theme-base-lighten-4)) !important;
  }
  :deep(.apexcharts-tooltip-title) {
    background-color: rgb(var(--v-theme-base-lighten-2)) !important;
    color: unset !important;
  }

  :deep(.apexcharts-menu-open) {
    color: black !important;
  }
  :deep(.apexcharts-xaxistooltip) {
    color: rgb(var(--v-theme-base-darken-4)) !important;
    background-color: rgb(var(--v-theme-base-lighten-4)) !important;
    z-index: 5;
  }
  :deep(.custom-icon-spacer) {
    cursor: default !important;
    z-index: 0;
  }
  :deep(.primary--text) {
    color: rgb(var(--v-theme-primary)) !important;
  }

  :deep(.apexcharts-zoomin-icon),
  :deep(.apexcharts-zoomout-icon) {
    transform: scale(1) !important;
  }
  :deep(.custom-icon-reset) {
    transform: scale(0.7) !important;
  }
  :deep(.custom-icon-start),
  :deep(.custom-icon-clear) {
    transform: scale(0.8) !important;
  }
  :deep(.apexcharts-menu-icon) {
    transform: scale(1) !important;
  }
  :deep(.apexcharts-menu-icon),
  :deep(.apexcharts-reset-icon),
  :deep(.apexcharts-zoom-icon) {
    transform: scale(1) !important;
  }
  :deep(.apexcharts-reset-icon),
  :deep(.apexcharts-zoom-icon) {
    transform: scale(1) !important;
  }
  :deep(.custom-icon-nn) {
    transform: scale(1) !important;
    z-index: 5;
  }
  :deep(.custom-icon-clear svg) {
    transform: scale(1) !important;
    width: 20px !important;
    height: 20px !important;
  }

  :deep(.apexcharts-menu-icon),
  :deep(.apexcharts-pan-icon),
  :deep(.apexcharts-reset-icon),
  :deep(.apexcharts-selection-icon),
  :deep(.apexcharts-toolbar-custom-icon),
  :deep(.apexcharts-zoom-icon),
  :deep(.apexcharts-zoomin-icon),
  :deep(.apexcharts-zoomout-icon) {
    cursor: pointer;
    width: 25px !important;
    height: 20px;
    line-height: 24px;
    color: #6e8192;
    text-align: center;
  }

  :deep(.apexcharts-svg.apexcharts-zoomable) {
    background: transparent !important;
  }
</style>
