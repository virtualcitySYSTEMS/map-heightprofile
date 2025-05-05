import type { Collection } from '@vcmap/core';
import { Projection } from '@vcmap/core';
import type { Coordinate } from 'ol/coordinate';
import Feature from 'ol/Feature';
import { Point } from 'ol/geom';
import type { VcsUiApp } from '@vcmap/ui';
import type {
  ApexConfig,
  ApexOptions,
  ChartMeasurement,
  ChartObject,
  SeriesEntry,
} from 'apexcharts';
import type { Ref } from 'vue';
import { ref } from 'vue';
import { getLogger } from '@vcsuite/logger';
import { name } from '../package.json';
import type { HeightProfilePlugin } from './index.js';
import type { HeightProfileResult } from './setupResultCollectionComponent.js';
import { addMeasurementAnnotationsToGraph } from './helper/measurementHelper.js';

export function placeTooltip(
  plugin: HeightProfilePlugin,
  point: Coordinate,
): void {
  plugin.measurementLayer.removeFeaturesById(['_tooltip']);
  const feature = new Feature({
    geometry: new Point(Projection.wgs84ToMercator(point)),
    olcs_extrudedHeight: 5,
    olcs_altitudeMode: 'absolute',
  });
  feature.setId('_tooltip');
  plugin.measurementLayer.addFeatures([feature]);
}

export function addScaleFactorToGraph(
  chartContext: ChartObject,
  app: VcsUiApp,
  scaleFactorInitial: Ref<number>,
  scaleFactorSave: Ref<number>,
  scaleFactorManuallySet: Ref<boolean>,
  initial = false,
): void {
  let scaleFactor;
  if (chartContext.w) {
    scaleFactor =
      (chartContext.w.globals.gridHeight *
        (chartContext.w.globals.maxX - chartContext.w.globals.minX)) /
      ((chartContext.w.globals.maxY - chartContext.w.globals.minY) *
        chartContext.w.globals.gridWidth);
  } else {
    scaleFactor =
      (chartContext.chart.w.globals.gridHeight *
        (chartContext.chart.w.globals.maxX -
          chartContext.chart.w.globals.minX)) /
      ((chartContext.chart.w.globals.maxY - chartContext.chart.w.globals.minY) *
        chartContext.chart.w.globals.gridWidth);
  }

  const background = getComputedStyle(
    document.documentElement,
  ).getPropertyValue('--v-theme-base-lighten-4');
  const text = getComputedStyle(document.documentElement).getPropertyValue(
    '--v-theme-base-darken-4',
  );

  chartContext.addXaxisAnnotation(
    {
      x: chartContext.w
        ? chartContext.w.globals.maxX
        : chartContext.chart.w.globals.maxX,
      label: {
        textAnchor: 'end',
        position: 'top',
        orientation: 'horizontal',
        text: `${String(app.vueI18n.t('heightProfile.scaleFactor'))}: ${scaleFactor.toFixed(2).toString()}`,
        style: {
          color: `rgb(${text})`,
          background: `rgb(${background})`,
        },
      },
    },
    false,
  );
  if (initial) {
    scaleFactorInitial.value = Math.round(scaleFactor * 100) / 100;
  }
  if (!scaleFactorManuallySet.value) {
    scaleFactorSave.value = Math.round(scaleFactor * 100) / 100;
  }
}

export const windowIdGraph = 'heightProfileGraph_window_id';

export function setupChart(
  app: VcsUiApp,
  results: Collection<HeightProfileResult>,
  resultNames: string[],
  scaleFactorInitial: Ref<number>,
  scaleFactorSave: Ref<number>,
  currentMeasurement: Ref<ChartMeasurement | undefined>,
  normalNMode: Ref<boolean>,
  measurementActive: Ref<boolean>,
  scaleFactorManuallySet: Ref<boolean>,
  decimalPlaces: number,
): {
  series: SeriesEntry[];
  chartOptions: ApexOptions;
  nnActive: Ref<boolean>;
  destroy: () => void;
} {
  const nnActive: Ref<boolean> = ref(false);
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
  const yaxisLabelsFormatter = (): { formatter(value: number): string } => ({
    formatter(value: number): string {
      const fixed = value.toFixed(decimalPlaces);
      const [integerPart, decimalPart] = fixed.split('.');
      if (decimalPart && Number(decimalPart) === 0) {
        return integerPart;
      }
      return fixed;
    },
  });

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
    '<svg id="icon-trash" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path id="delete" d="M14.525,4.27A.5.5,0,0,1,15,4.784V5.05a.5.5,0,0,1-.475.514H3.476A.5.5,0,0,1,3,5.05V4.784a.5.5,0,0,1,.476-.514H5.42a.866.866,0,0,0,.827-.71l.1-.477A1.341,1.341,0,0,1,7.624,2h2.753a1.338,1.338,0,0,1,1.268,1.048l.109.511a.865.865,0,0,0,.827.711Zm-.988,9.724c.2-1.986.558-6.7.558-6.751a.539.539,0,0,0-.121-.391.474.474,0,0,0-.349-.164H4.379a.461.461,0,0,0-.349.164.571.571,0,0,0-.127.391c0,.009.014.175.035.453.095,1.234.358,4.672.529,6.3a1.989,1.989,0,0,0,1.954,1.979c.837.02,1.7.027,2.581.027.831,0,1.674-.007,2.537-.027A1.988,1.988,0,0,0,13.537,13.994Z" transform="translate(-1 -0.996)" fill="currentColor" /><rect id="spacer" width="16" height="16" fill="none"/></svg>\n';
  const iconMeasure =
    '<svg id="measure" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path id="tool_54" d="M7.39,22.95c-.77,0-1.39-.62-1.39-1.39h0V2.46c0-.77.62-1.39,1.39-1.39h3.47c.77,0,1.39.62,1.39,1.39h0v19.11c0,.77-.62,1.39-1.39,1.39h-3.47ZM7.39,2.8v18.41c0,.19.16.35.35.35h2.78c.19,0,.35-.16.35-.35v-2.25c0-.19-.16-.35-.35-.35h-.69c-.29,0-.52-.23-.52-.52s.23-.52.52-.52h.69c.19,0,.35-.15.35-.34v-.7c0-.19-.15-.35-.35-.35h-.69c-.29-.01-.51-.26-.5-.54.01-.27.23-.49.5-.5h.69c.19,0,.35-.16.35-.35v-.71c0-.19-.15-.35-.35-.35h-.69c-.29-.01-.51-.25-.5-.54.01-.27.23-.49.5-.5h.69c.19,0,.35-.16.35-.35v-.69c0-.19-.16-.35-.35-.35h-.69c-.29-.01-.51-.26-.5-.54.01-.27.23-.49.5-.5h.69c.19,0,.35-.16.35-.35h0v-.7c0-.19-.15-.35-.35-.35h-.69c-.29,0-.52-.23-.52-.52s.23-.52.52-.52h.69c.19,0,.34-.15.35-.34v-.7c0-.19-.15-.34-.34-.34h-.7c-.29,0-.52-.23-.52-.52s.23-.52.52-.52h.69c.19,0,.34-.15.35-.34v-2.26c0-.19-.16-.35-.35-.35h-2.78c-.19,0-.35.16-.35.35ZM15.73,22.66l-1.39-1.39c-.2-.2-.2-.53,0-.74.1-.1.23-.15.37-.15h.35c.19,0,.35-.15.35-.35h0V3.7c0-.19-.16-.34-.35-.34h-.35c-.14,0-.27-.06-.37-.16-.2-.2-.2-.53,0-.73h0l1.39-1.39c.2-.2.53-.21.73,0h0l1.38,1.39c.1.1.15.23.15.37,0,.29-.23.52-.52.52h-.35c-.19,0-.34.15-.35.34v16.34c0,.19.16.35.35.35h.35c.29,0,.52.24.52.52,0,.14-.06.27-.15.37l-1.38,1.39c-.1.1-.23.15-.37.15s-.27-.05-.37-.15h0ZM8.42,3.84c0-.38.31-.69.69-.69s.69.31.69.69-.31.69-.69.69-.69-.31-.69-.69h0Z" fill="currentColor" /></svg>';

  const chartOptions: ApexOptions = {
    chart: {
      fontFamily: 'Titillium Web, sans-serif',
      height: 350,
      width: 1400,
      type: 'line',
      zoom: { enabled: true },
      selection: {
        enabled: true,
        type: 'x',
        fill: { color: '#24292e', opacity: 0.1 },
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
              icon: '|',
              index: 4,
              title: '',
              class: 'custom-icon-spacer',
              click(): void {},
            },
            {
              icon: iconReset,
              index: 5,
              title: String(app.vueI18n.t('heightProfile.reset')),
              class: 'custom-icon-reset',
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              click(chart: ChartObject, _options, _e): void {
                chart
                  .updateOptions({ yaxis: { labels: yaxisLabelsFormatter() } })
                  .catch(() => {
                    getLogger(name).error('failed to update options');
                  });

                normalNMode.value = false;
                nnActive.value = false;
                chart.resetSeries();
                if (currentMeasurement.value?.values) {
                  addMeasurementAnnotationsToGraph(
                    currentMeasurement.value.values,
                    chart,
                    app,
                  );
                }
              },
            },
            {
              icon: '|',
              index: 6,
              title: '',
              class: 'custom-icon-spacer',
              click(): void {},
            },
            {
              icon: 'NN',
              index: 7,
              title: String(app.vueI18n.t('heightProfile.nn')),
              class: 'custom-icon-nn',
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              click(chart: ChartObject, _options, _e): void {
                const iconNN = document.querySelector('.custom-icon-nn');
                if (normalNMode.value) {
                  if (iconNN) {
                    iconNN.classList.add('primary--text');
                  }
                  chart
                    .updateOptions({
                      yaxis: { labels: yaxisLabelsFormatter() },
                    })
                    .catch(() => {
                      getLogger(name).error('failed to update options');
                    });
                  chart.resetSeries();
                  normalNMode.value = false;
                  nnActive.value = false;
                } else {
                  if (iconNN) {
                    iconNN.classList.remove('primary--text');
                  }
                  chart
                    .updateOptions({
                      yaxis: { min: 0, labels: yaxisLabelsFormatter() },
                    })
                    .catch(() => {
                      getLogger(name).error('failed to update options');
                    });
                  chart.resetSeries();
                  normalNMode.value = true;
                  nnActive.value = true;
                }
              },
            },
            {
              icon: '|',
              index: 8,
              title: '',
              class: 'custom-icon-spacer',
              click(): void {},
            },
            {
              icon: iconMeasure,
              index: 9,
              title: String(app.vueI18n.t('heightProfile.measurement.start')),
              class: 'custom-icon-start',
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              click(_chart, _options, _e): void {
                const iconStart = document.querySelector('.custom-icon-start');

                if (iconStart) {
                  if (measurementActive.value) {
                    measurementActive.value = false;
                    iconStart.classList.remove('primary--text');
                  } else {
                    measurementActive.value = true;
                    iconStart.classList.add('primary--text');
                  }
                }
              },
            },
            {
              icon: '|',
              index: 10,
              title: '',
              class: 'custom-icon-spacer',
              click(): void {},
            },
            {
              icon: iconClear,
              index: 10,
              title: String(app.vueI18n.t('heightProfile.measurement.clear')),
              class: 'custom-icon-clear',
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              click(chart: ChartObject, _options, _e): void {
                if (currentMeasurement?.value) {
                  currentMeasurement.value.destroy();
                  addScaleFactorToGraph(
                    chart,
                    app,
                    scaleFactorInitial,
                    scaleFactorSave,
                    scaleFactorManuallySet,
                  );
                }
              },
            },
          ],
        },
        export: {
          csv: { filename: 'graph' },
          svg: { filename: 'graph' },
          png: { filename: 'graph' },
        },
      },
    },
    theme: { mode: 'light' },
    dataLabels: { enabled: false },
    stroke: { width: 3, curve: 'straight' },
    grid: {
      row: { colors: ['#f3f3f3', 'transparent'], opacity: 0.5 },
    },
    xaxis: {
      type: 'numeric',
      title: { text: String(app.vueI18n.t('heightProfile.distance')) },
    },
    yaxis: {
      title: { text: String(app.vueI18n.t('heightProfile.height')) },
      labels: yaxisLabelsFormatter(),
    },
    tooltip: {
      x: { show: false },
      y: [
        {
          formatter: (value: number): string =>
            `${value.toFixed(decimalPlaces)} m`,
        },
      ],
    },
    legend: {
      formatter: customLegendFormatter,
      showForSingleSeries: true,
    },
  };

  return {
    series,
    chartOptions,
    nnActive,
    destroy(): void {
      plugin.measurementLayer.removeAllFeatures();
      if (currentMeasurement?.value) {
        currentMeasurement.value.destroy();
      }
    },
  };
}
