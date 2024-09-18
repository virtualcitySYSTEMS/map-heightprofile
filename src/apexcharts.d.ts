import ApexCharts from 'apexcharts';

declare module 'apexcharts' {
  export type ApexConfig = {
    config: object;
    dataPointIndex: number;
    globals: object;
    seriesIndex: number;
  };

  export type ChartMeasurement = {
    readonly finished: boolean;
    readonly values: [number, number][];
    addValue: (value: [number, number]) => void;
    destroy: () => void;
  };

  export type SeriesEntry = {
    name: string;
    data: Array<[number, number]>;
    id?: string | undefined;
    color?: string | undefined;
    zIndex?: number | undefined;
  };

  type ApexGlobals = {
    globals: {
      maxY: number;
      maxX: number;
      minY: number;
      minX: number;
      gridWidth: number;
      gridHeight: number;
    };
  };

  export type ApexChartContext = {
    w: ApexGlobals;
  };

  export interface ChartObject extends ApexCharts {
    chart: {
      w: ApexGlobals;
    };
    w: ApexGlobals;
  }
}
