import { Ref } from 'vue';
import type { ApexChartContext } from './measurementHelper.js';

function setScaleFactorSmall(
  chart: ApexChartContext,
  scaleFactorSet: number,
): void {
  const yMax =
    ((chart.w.globals.maxX - chart.w.globals.minX) *
      chart.w.globals.gridHeight) /
      (chart.w.globals.gridWidth * scaleFactorSet) +
    chart.w.globals.minY;

  chart.updateOptions({
    yaxis: {
      min: chart.w.globals.minY,
      max: yMax,
      labels: {
        formatter(value: number): string {
          return Math.floor(value).toString();
        },
      },
    },
  });
  chart.resetSeries(true, true);
}

function setScaleFactorBig(
  chart: ApexChartContext,
  scaleFactorSet: number,
): void {
  const xMax =
    (scaleFactorSet *
      (chart.w.globals.maxY - chart.w.globals.minY) *
      chart.w.globals.gridWidth) /
      chart.w.globals.gridHeight +
    chart.w.globals.minX;

  chart.updateOptions({
    xaxis: {
      min: chart.w.globals.minX,
      max: xMax,
      labels: {
        formatter(value: number): string {
          return Math.floor(value).toString();
        },
      },
    },
  });
  chart.resetSeries(true, true);
}

function getCurrentScaleFactor(chart: ApexChartContext): number {
  return (
    Math.round(
      ((chart.w.globals.gridHeight *
        (chart.w.globals.maxX - chart.w.globals.minX)) /
        ((chart.w.globals.maxY - chart.w.globals.minY) *
          chart.w.globals.gridWidth)) *
        100,
    ) / 100
  );
}

function setScaleFactorLoop(
  chart: ApexChartContext,
  scaleFactorSet: number,
  scaleFunction: (chart: ApexChartContext, scaleFactorSet: number) => void,
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
// eslint-disable-next-line import/prefer-default-export
export function setScaleFactor(
  chart: ApexChartContext,
  scaleFactorSave: Ref<number>,
  scaleFactorInitial: Ref<number>,
): void {
  chart.resetSeries(true, true);
  const scaleFactorSet = scaleFactorSave.value;
  if (scaleFactorSet && scaleFactorSet > 0) {
    if (scaleFactorSet < scaleFactorInitial.value) {
      setScaleFactorLoop(chart, scaleFactorSet, setScaleFactorSmall);
    } else if (scaleFactorSet > scaleFactorInitial.value) {
      setScaleFactorLoop(chart, scaleFactorSet, setScaleFactorBig);
    }
  }
}
