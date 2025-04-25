import type { Ref } from 'vue';
import type { ChartObject } from 'apexcharts';
import { getLogger } from '@vcsuite/logger';
import { name } from '../../package.json';

function setScaleFactorSmall(chart: ChartObject, scaleFactorSet: number): void {
  const yMax =
    ((chart.chart.w.globals.maxX - chart.chart.w.globals.minX) *
      chart.chart.w.globals.gridHeight) /
      (chart.chart.w.globals.gridWidth * scaleFactorSet) +
    chart.chart.w.globals.minY;

  chart
    .updateOptions({
      yaxis: {
        min: chart.chart.w.globals.minY,
        max: yMax,
        labels: {
          formatter(value: number): string {
            return Math.floor(value).toString();
          },
        },
      },
    })
    .catch(() => {
      getLogger(name).error('failed to update options');
    });
  chart.resetSeries();
}

function setScaleFactorBig(chart: ChartObject, scaleFactorSet: number): void {
  const xMax =
    (scaleFactorSet *
      (chart.chart.w.globals.maxY - chart.chart.w.globals.minY) *
      chart.chart.w.globals.gridWidth) /
      chart.chart.w.globals.gridHeight +
    chart.chart.w.globals.minX;

  chart
    .updateOptions({
      xaxis: {
        min: chart.chart.w.globals.minX,
        max: xMax,
        labels: {
          formatter(value: number): string {
            return Math.floor(value).toString();
          },
        },
      },
    })
    .catch(() => {
      getLogger(name).error('failed to update options');
    });
  chart.resetSeries();
}

function getCurrentScaleFactor(chart: ChartObject): number {
  return (
    Math.round(
      ((chart.chart.w.globals.gridHeight *
        (chart.chart.w.globals.maxX - chart.chart.w.globals.minX)) /
        ((chart.chart.w.globals.maxY - chart.chart.w.globals.minY) *
          chart.chart.w.globals.gridWidth)) *
        100,
    ) / 100
  );
}

function setScaleFactorLoop(
  chart: ChartObject,
  scaleFactorSet: number,
  scaleFunction: (chart: ChartObject, scaleFactorSet: number) => void,
): void {
  let numb = 1;
  do {
    numb += 1;
    scaleFunction(chart, scaleFactorSet);
  } while (getCurrentScaleFactor(chart) !== scaleFactorSet && numb <= 6);
}

/**
 * Sets the scale factor for a given chart. Depending on the original scaleFactor which fits the axes best to the graph values it selects smaller or bigger.
 * Smaller refers to scaleFactors smaller than initial and applies the scaling to the yAxis and bigger applies it to xAxis. This should allow for the best visualization of the values.
 * @param {ApexChartContext} chart - The ApexCharts context representing the chart.
 * @param {Ref<number>} scaleFactorSave - Reference to the saved scale factor.
 * @param {Ref<number>} scaleFactorInitial - Reference to the initial scale factor.
 * @returns {void}
 */

export function setScaleFactor(
  chart: ChartObject,
  scaleFactorSave: Ref<number>,
  scaleFactorInitial: Ref<number>,
): void {
  chart.resetSeries();
  const scaleFactorSet = scaleFactorSave.value;
  if (scaleFactorSet && scaleFactorSet > 0) {
    if (scaleFactorSet < scaleFactorInitial.value) {
      setScaleFactorLoop(chart, scaleFactorSet, setScaleFactorSmall);
    } else if (scaleFactorSet > scaleFactorInitial.value) {
      setScaleFactorLoop(chart, scaleFactorSet, setScaleFactorBig);
    }
  }
}
