import { Collection, Projection } from '@vcmap/core';
import { Coordinate } from 'ol/coordinate';
import Feature from 'ol/Feature';
import { Point } from 'ol/geom';
import { NotificationType, VcsUiApp } from '@vcmap/ui';
import { ApexOptions } from 'apexcharts';
import { Ref, ref } from 'vue';
import { name } from '../package.json';
import type { HeightProfilePlugin } from './index.js';
import type { HeightProfileResult } from './setupResultCollectionComponent.js';
import {
  ApexChartContext,
  SeriesEntry,
  startChartMeasurement,
  ChartMeasurement,
  addMeasurementAnnotationsToGraph,
} from './helper/measurementHelper.js';

type ApexConfig = {
  config: object;
  dataPointIndex: number;
  globals: object;
  seriesIndex: number;
};

function placeTooltip(plugin: HeightProfilePlugin, point: Coordinate): void {
  plugin.measurementLayer.removeFeaturesById(['_tooltip']);
  const feature = new Feature({
    geometry: new Point(Projection.wgs84ToMercator(point)),
    olcs_extrudedHeight: 5,
    olcs_altitudeMode: 'absolute',
  });
  feature.setId('_tooltip');
  plugin.measurementLayer.addFeatures([feature]);
}

export const windowIdGraph = 'heightProfileGraph_window_id';

export function setupChart(
  app: VcsUiApp,
  results: Collection<HeightProfileResult>,
  resultNames: string[],
): {
  series: SeriesEntry[];
  chartOptions: ApexOptions;
  scaleFactorSave: Ref<number>;
  scaleFactorInitial: Ref<number>;
  destroy: () => void;
} {
  let currentMeasurment: ChartMeasurement | undefined;
  let measurementActive = false;
  const scaleFactorSave: Ref<number> = ref(0);
  const scaleFactorInitial: Ref<number> = ref(0);

  function addScaleFactorToGraph(
    chartContext: ApexChartContext,
    initial = false,
  ): void {
    const scaleFactor =
      (chartContext.w.globals.gridHeight *
        (chartContext.w.globals.maxX - chartContext.w.globals.minX)) /
      ((chartContext.w.globals.maxY - chartContext.w.globals.minY) *
        chartContext.w.globals.gridWidth);

    chartContext.addXaxisAnnotation(
      {
        x: chartContext.w.globals.maxX,
        label: {
          textAnchor: 'end',
          position: 'top',
          orientation: 'horizontal',
          text: `${String(app.vueI18n.t('heightProfile.scaleFactor'))}: ${scaleFactor.toFixed(2).toString()}`,
        },
      },
      false,
    );
    if (initial) {
      scaleFactorInitial.value = scaleFactor;
    }
    scaleFactorSave.value = scaleFactor;
  }

  let normalNMode = false;
  const plugin = app.plugins.getByKey(name) as HeightProfilePlugin;
  const series = resultNames
    .map((id): SeriesEntry | undefined => {
      const result = results.getByKey(id);
      if (result) {
        const heightsArray = result.resultPoints.map(
          (innerArray) => innerArray[2],
        );

        return {
          name: result.properties.title,
          id,
          data: heightsArray.map((data, index) => [
            index * result.resolution,
            data,
          ]),
        };
      }
      return undefined;
    })
    .filter((r): r is SeriesEntry => !!r);

  const customLegendFormatter = (
    seriesName: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _opts: ApexConfig,
  ): string => {
    return `<div class="legend-item-label" id="test">${seriesName}</div>`;
  };

  const iconPlus =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"  viewBox="0 0 16 16"> <path id="Path_444" d="M25,20a1.154,1.154,0,0,1-1.154,1.154H21.538a.385.385,0,0,0-.385.385v2.308a1.154,1.154,0,0,1-2.308,0V21.538a.385.385,0,0,0-.385-.385H16.154a1.154,1.154,0,1,1,0-2.308h2.308a.385.385,0,0,0,.385-.385V16.154a1.154,1.154,0,1,1,2.308,0v2.308a.385.385,0,0,0,.385.385h2.308A1.154,1.154,0,0,1,25,20Z" transform="translate(-12 -12)" fill="currentColor"/><rect id="size" width="16" height="16" fill="none" /></svg>';
  const iconMinus =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"> <path id="Path_444" d="M25,20a1.154,1.154,0,0,1-1.154,1.154H16.154a1.154,1.154,0,1,1,0-2.308h7.692A1.154,1.154,0,0,1,25,20Z" transform="translate(-12 -12)"  fill="currentColor"/> <rect id="size" width="16" height="16" fill="none" /> </svg>';
  const iconExport =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"> <g id="Gruppe_1962" transform="translate(-694 -537.56)"> <path id="Pfad_745" d="M712,547h-3v2h2v9H701v-9h2v-2h-3a1,1,0,0,0-1,1v11a1,1,0,0,0,1,1h12a1,1,0,0,0,1-1V548A1,1,0,0,0,712,547Z" fill="currentColor"/><path id="Pfad_746" d="M702,545.021a1,1,0,0,0,.707-.292L705,542.435V550a1,1,0,0,0,2,0v-7.37l2.293,2.293a1,1,0,1,0,1.414-1.414l-3.9-3.9a1.146,1.146,0,0,0-.118-.078.9.9,0,0,0-.078-.116,1,1,0,0,0-1.414,0l-3.9,3.9a1,1,0,0,0,.707,1.707Z" fill="currentColor"/></g></svg>';
  const iconPanning =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>hand-back-right-outline</title><path d="M21 7C21 5.62 19.88 4.5 18.5 4.5C18.33 4.5 18.16 4.5 18 4.55V4C18 2.62 16.88 1.5 15.5 1.5C15.27 1.5 15.04 1.53 14.83 1.59C14.46 .66 13.56 0 12.5 0C11.27 0 10.25 .89 10.04 2.06C9.87 2 9.69 2 9.5 2C8.12 2 7 3.12 7 4.5V10.39C6.66 10.08 6.24 9.85 5.78 9.73L5 9.5C4.18 9.29 3.31 9.61 2.82 10.35C2.44 10.92 2.42 11.66 2.67 12.3L5.23 18.73C6.5 21.91 9.57 24 13 24C17.42 24 21 20.42 21 16V7M19 16C19 19.31 16.31 22 13 22C10.39 22 8.05 20.41 7.09 18L4.5 11.45L5 11.59C5.5 11.71 5.85 12.05 6 12.5L7 15H9V4.5C9 4.22 9.22 4 9.5 4S10 4.22 10 4.5V12H12V2.5C12 2.22 12.22 2 12.5 2S13 2.22 13 2.5V12H15V4C15 3.72 15.22 3.5 15.5 3.5S16 3.72 16 4V12H18V7C18 6.72 18.22 6.5 18.5 6.5S19 6.72 19 7V16Z" /></svg>';
  const iconReset =
    '<svg xmlns="http://www.w3.org/2000/svg" width="13.98" height="12" viewBox="0 0 13.98 12" > <path id="Path_476" d="M965.562,566.241h-2.989v1.5h2.978a3.042,3.042,0,0,1,.051,6.083h-6.926l1.636-1.637a.75.75,0,0,0-1.06-1.06l-2.917,2.917a.732.732,0,0,0-.161.241.737.737,0,0,0,0,.578.732.732,0,0,0,.161.241l2.917,2.916a.75.75,0,0,0,1.06-1.06l-1.636-1.636h6.949a4.542,4.542,0,0,0-.063-9.084Z"  transform="translate(-956.115 -566.241)" fill="currentColor"/></svg>';
  const iconClear =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>layers-off</title><path d="M3.27,1L2,2.27L6.22,6.5L3,9L4.63,10.27L12,16L14.1,14.37L15.53,15.8L12,18.54L4.63,12.81L3,14.07L12,21.07L16.95,17.22L20.73,21L22,19.73L3.27,1M19.36,10.27L21,9L12,2L9.09,4.27L16.96,12.15L19.36,10.27M19.81,15L21,14.07L19.57,12.64L18.38,13.56L19.81,15Z" /></svg>';
  const iconMeasure =
    '<svg id="icon_24_2D_height" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"> <path id="Vereinigungsmenge_54" d="m2.39,22.95c-.77,0-1.39-.62-1.39-1.39h0V2.46c0-.77.62-1.39,1.39-1.39h3.47c.77,0,1.39.62,1.39,1.39h0v19.11c0,.77-.62,1.39-1.39,1.39h-3.47ZM2.39,2.8v18.41c0,.19.16.35.35.35h2.78c.19,0,.35-.16.35-.35v-2.25c0-.19-.16-.35-.35-.35h-.69c-.29,0-.52-.23-.52-.52s.23-.52.52-.52h.69c.19,0,.35-.15.35-.34v-.7c0-.19-.15-.35-.35-.35h-.69c-.29-.01-.51-.26-.5-.54.01-.27.23-.49.5-.5h.69c.19,0,.35-.16.35-.35v-.71c0-.19-.15-.35-.35-.35h-.69c-.29-.01-.51-.25-.5-.54.01-.27.23-.49.5-.5h.69c.19,0,.35-.16.35-.35v-.69c0-.19-.16-.35-.35-.35h-.69c-.29-.01-.51-.26-.5-.54.01-.27.23-.49.5-.5h.69c.19,0,.35-.16.35-.35h0v-.7c0-.19-.15-.35-.35-.35h-.69c-.29,0-.52-.23-.52-.52s.23-.52.52-.52h.69c.19,0,.34-.15.35-.34v-.7c0-.19-.15-.34-.34-.34h-.7c-.29,0-.52-.23-.52-.52s.23-.52.52-.52h.69c.19,0,.34-.15.35-.34v-2.26c0-.19-.16-.35-.35-.35h-2.78c-.19,0-.35.16-.35.35Zm8.34,19.86l-1.39-1.39c-.2-.2-.2-.53,0-.74.1-.1.23-.15.37-.15h.35c.19,0,.35-.15.35-.35h0V3.7c0-.19-.16-.34-.35-.34h-.35c-.14,0-.27-.06-.37-.16-.2-.2-.2-.53,0-.73h0s1.39-1.39,1.39-1.39c.2-.2.53-.21.73,0h0s1.38,1.39,1.38,1.39c.1.1.15.23.15.37,0,.29-.23.52-.52.52h-.35c-.19,0-.34.15-.35.34v16.34c0,.19.16.35.35.35h.35c.29,0,.52.24.52.52,0,.14-.06.27-.15.37l-1.38,1.39c-.1.1-.23.15-.37.15-.14,0-.27-.05-.37-.15ZM3.42,3.84c0-.38.31-.69.69-.69.38,0,.69.31.69.69,0,.38-.31.69-.69.69-.38,0-.69-.31-.69-.69h0Z" fill="currentColor"/><path id="Pfad_682" d="m13.9,20.5h1.09c0-.15.01-.3.04-.45.03-.15.08-.29.15-.42.07-.12.16-.22.28-.3.13-.08.27-.12.42-.12.22,0,.44.07.6.23.16.17.25.4.24.64,0,.16-.04.32-.12.46-.08.13-.17.25-.29.36-.12.11-.24.21-.38.29-.14.09-.27.17-.39.26-.24.17-.47.33-.68.49-.21.15-.4.33-.56.52-.16.19-.29.41-.38.64-.1.27-.15.56-.14.85h4.11v-.98h-2.64c.14-.19.3-.36.48-.5.18-.14.37-.28.56-.4.19-.12.38-.25.57-.38.18-.12.35-.27.51-.43.15-.16.27-.34.36-.54.1-.23.14-.48.14-.73,0-.26-.05-.51-.16-.75-.1-.21-.24-.4-.42-.55-.18-.15-.39-.27-.61-.34-.24-.08-.48-.12-.73-.12-.31,0-.61.05-.89.17-.25.11-.47.27-.64.48-.17.21-.3.46-.38.72-.09.29-.13.59-.11.9Zm5.96,2.39v-3.6h.9c.27,0,.53.04.78.13.2.08.38.21.51.38.13.18.23.38.28.6.06.26.09.52.08.78,0,.27-.03.54-.12.8-.07.2-.18.38-.32.53-.13.13-.28.23-.46.29-.17.06-.35.09-.53.08h-1.12Zm-1.26-4.66v5.71h2.46c.39,0,.78-.07,1.14-.22.31-.14.59-.34.81-.6.22-.27.39-.58.48-.92.11-.37.16-.76.16-1.15,0-.42-.06-.84-.2-1.24-.12-.33-.3-.63-.54-.88-.23-.23-.51-.42-.82-.53-.33-.12-.68-.18-1.03-.18h-2.46Z" fill="currentColor"/></svg>';

  const chartOptions: ApexOptions = {
    chart: {
      fontFamily: 'Titillium Web, sans-serif',
      height: 350,
      width: 1400,
      type: 'line',
      zoom: {
        enabled: true,
      },
      selection: {
        enabled: true,
        type: 'x',
        fill: {
          color: '#24292e',
          opacity: 0.1,
        },
        stroke: {
          width: 1,
          dashArray: 3,
          color: '#24292e',
          opacity: 0.4,
        },
      },
      toolbar: {
        show: true,
        tools: {
          zoom: true,
          zoomin: iconPlus,
          zoomout: iconMinus,
          download: iconExport,
          selection: false,
          pan: iconPanning,
          reset: false,
          customIcons: [
            {
              icon: iconReset,
              index: 4,
              title: `${String(app.vueI18n.t('heightProfile.reset'))}`,
              class: 'custom-icon-reset',
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              click(chart: ApexChartContext, _options, _e): void {
                chart.updateOptions({
                  yaxis: {
                    labels: {
                      formatter(value: number): string {
                        return Math.floor(value).toString();
                      },
                    },
                  },
                });

                chart.resetSeries(true, true);
                if (currentMeasurment?.values) {
                  addMeasurementAnnotationsToGraph(
                    currentMeasurment.values,
                    chart,
                    app,
                  );
                }
              },
            },
            {
              icon: 'NN',
              index: 5,
              title: `${String(app.vueI18n.t('heightProfile.nn'))}`,
              class: 'custom-icon-nn',
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              click(chart: ApexChartContext, _options, _e): void {
                const iconNN = document.querySelector('.custom-icon-nn');
                if (normalNMode) {
                  if (iconNN) {
                    iconNN.classList.add('primary--text');
                  }
                  chart.updateOptions({
                    yaxis: {
                      labels: {
                        formatter(value: number): string {
                          return Math.floor(value).toString();
                        },
                      },
                    },
                  });
                  chart.resetSeries(true, true);
                  normalNMode = false;
                } else {
                  if (iconNN) {
                    iconNN.classList.remove('primary--text');
                    // iconNN.setAttribute('style', 'color: #000000');
                  }
                  chart.updateOptions({
                    yaxis: {
                      min: 0,
                      labels: {
                        formatter(value: number): string {
                          return Math.floor(value).toString();
                        },
                      },
                    },
                  });
                  chart.resetSeries(true, true);
                  normalNMode = true;
                }
              },
            },
            {
              icon: iconMeasure,
              index: 6,
              title: `${String(app.vueI18n.t('heightProfile.measurement.start'))}`,
              class: 'custom-icon-start',
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              click(_chart, _options, _e): void {
                const iconStart = document.querySelector('.custom-icon-start');

                if (iconStart) {
                  if (measurementActive) {
                    measurementActive = false;
                    iconStart.classList.remove('primary--text');
                  } else {
                    measurementActive = true;
                    iconStart.classList.add('primary--text');
                  }
                }
              },
            },
            {
              icon: iconClear,
              index: 7,
              title: `${String(app.vueI18n.t('heightProfile.measurement.clear'))}`,
              class: 'custom-icon-clear',
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              click(chart: ApexChartContext, _options, _e): void {
                currentMeasurment?.destroy();
                addScaleFactorToGraph(chart);
              },
            },
          ],
        },
      },
      events: {
        click(
          _event: object,
          chartContext: ApexChartContext,
          config: ApexConfig,
        ): void {
          if (measurementActive) {
            if (config.dataPointIndex >= 0) {
              if (series?.length === 1 || currentMeasurment?.finished) {
                const value = series[0].data[config.dataPointIndex];
                if (currentMeasurment && !currentMeasurment.finished) {
                  currentMeasurment.addValue(value);
                } else {
                  currentMeasurment?.destroy();
                  currentMeasurment = startChartMeasurement(
                    app,
                    chartContext,
                    series,
                    results,
                    value,
                  );
                }
                addScaleFactorToGraph(chartContext);
              } else {
                app.notifier.add({
                  type: NotificationType.WARNING,
                  message: String('heightProfile.measurementWarning'),
                });
              }
            }
          }
        },
        mouseMove(
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
        },
        mouseLeave(): void {
          plugin.layer.removeFeaturesById(['_tooltip']);
        },
        scrolled(chartContext) {
          addScaleFactorToGraph(chartContext);
          if (currentMeasurment?.values) {
            addMeasurementAnnotationsToGraph(
              currentMeasurment.values,
              chartContext,
              app,
            );
          }
        },
        mounted(chartContext: ApexChartContext) {
          addScaleFactorToGraph(chartContext, true);
        },
        animationEnd(
          chartContext: ApexChartContext,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _config: ApexConfig,
        ): void {
          if (currentMeasurment?.values) {
            addMeasurementAnnotationsToGraph(
              currentMeasurment.values,
              chartContext,
              app,
            );
          }
          addScaleFactorToGraph(chartContext);
          const iconNN = document.querySelector('.custom-icon-nn');
          const iconStart = document.querySelector('.custom-icon-start');
          if (iconNN) {
            if (normalNMode) {
              iconNN.classList.add('primary--text');
            } else {
              iconNN.classList.remove('primary--text');
            }
          }
          if (iconStart) {
            if (measurementActive) {
              iconStart.classList.add('primary--text');
            } else {
              iconStart.classList.remove('primary--text');
            }
          }
        },
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      width: 3,
      curve: 'straight',
    },
    grid: {
      row: {
        colors: ['#f3f3f3', 'transparent'],
        opacity: 0.5,
      },
    },
    xaxis: {
      type: 'numeric',
    },
    yaxis: {
      labels: {
        formatter(value: number): string {
          return Math.floor(value).toString();
        },
      },
    },
    legend: {
      formatter: customLegendFormatter,
      showForSingleSeries: true,
    },
  };

  return {
    series,
    chartOptions,
    scaleFactorSave,
    scaleFactorInitial,
    destroy(): void {
      plugin.measurementLayer.removeAllFeatures();
      currentMeasurment?.destroy();
    },
  };
}
