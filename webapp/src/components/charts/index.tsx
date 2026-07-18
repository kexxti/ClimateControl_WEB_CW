import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import {
  formatPeriodRange,
  formatTick,
  getChartDomain,
  getPointDate,
  getTimeTicks,
  makeTooltipLines,
  normalizeBuildingHistoryPoints,
  normalizeRoomHistoryPoints,
  type BuildingHistoryPoint,
  type ChartPeriod,
  type HistoryMeta,
  type RoomHistoryPoint,
} from '../../lib/charting';

type RoomHistoryLineChartClasses = {
  chart: string;
  axis: string;
  grid: string;
  tooltip: string;
  tempLine: string;
  setpointLine: string;
  tempDot: string;
  setpointMarker: string;
  legend: string;
  tempLegend: string;
  setpointLegend: string;
};

type BuildingHistoryLineChartClasses = {
  chart: string;
  axis: string;
  grid: string;
  tooltip: string;
  avgTempLine: string;
  avgSetpointLine: string;
  avgTempDot: string;
  legend: string;
  avgTempLegend: string;
  avgSetpointLegend: string;
};

type ChartSize = {
  width: number;
  height: number;
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
};

const defaultRoomChartSize: ChartSize = {
  width: 900,
  height: 360,
  margin: { top: 30, right: 28, bottom: 52, left: 56 },
};

const defaultBuildingChartSize: ChartSize = {
  width: 720,
  height: 320,
  margin: { top: 24, right: 24, bottom: 44, left: 48 },
};

const renderTooltipText = (tooltipText: d3.Selection<SVGTextElement, unknown, null, undefined>, lines: string[]) => {
  tooltipText.selectAll('tspan').remove();
  lines.forEach((line, index) => {
    tooltipText.append('tspan').attr('x', 10).attr('dy', index === 0 ? 0 : 16).text(line);
  });
};

export const RoomHistoryLineChart = ({
  data,
  meta,
  period,
  classNames,
  size = defaultRoomChartSize,
  ariaLabel = 'Температура помещения',
}: {
  data: RoomHistoryPoint[];
  meta?: HistoryMeta;
  period: Exclude<ChartPeriod, 'custom'>;
  classNames: RoomHistoryLineChartClasses;
  size?: ChartSize;
  ariaLabel?: string;
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const { width, height, margin } = size;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const chartData = normalizeRoomHistoryPoints(data, period, ariaLabel);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img');

    const domain = getChartDomain(chartData, meta);
    const x = d3.scaleTime().domain(domain).range([0, innerWidth]);
    const values = chartData.flatMap((item) => [item.temp, item.setpoint]);
    const y = d3
      .scaleLinear()
      .domain([Math.floor(d3.min(values) ?? 18) - 1, Math.ceil(d3.max(values) ?? 26) + 1])
      .nice()
      .range([innerHeight, 0]);

    const chart = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);
    chart
      .append('g')
      .attr('class', classNames.grid)
      .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(() => ''));
    chart
      .append('g')
      .attr('class', classNames.axis)
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(getTimeTicks(domain, period, innerWidth))
          .tickFormat((value) => formatTick(value as Date, period)),
      );
    chart.append('g').attr('class', classNames.axis).call(d3.axisLeft(y).ticks(5).tickFormat((value) => `${value}°`));

    const tempLine = d3
      .line<RoomHistoryPoint>()
      .x((item) => x(getPointDate(item)))
      .y((item) => y(item.temp))
      .curve(d3.curveMonotoneX);
    const setpointLine = d3
      .line<RoomHistoryPoint>()
      .x((item) => x(getPointDate(item)))
      .y((item) => y(item.setpoint))
      .curve(d3.curveMonotoneX);

    chart.append('path').datum(chartData).attr('class', classNames.tempLine).attr('d', tempLine);
    chart.append('path').datum(chartData).attr('class', classNames.setpointLine).attr('d', setpointLine);

    chart
      .selectAll('line.setpointMarker')
      .data(chartData.filter((item) => item.setpointChanged))
      .join('line')
      .attr('class', classNames.setpointMarker)
      .attr('x1', (item) => x(getPointDate(item)))
      .attr('x2', (item) => x(getPointDate(item)))
      .attr('y1', 0)
      .attr('y2', innerHeight);

    const tooltip = chart.append('g').attr('class', classNames.tooltip).style('display', 'none');
    const tooltipBg = tooltip.append('rect').attr('rx', 6).attr('height', 84);
    const tooltipText = tooltip.append('text').attr('x', 10).attr('y', 18);

    const showTooltip = (event: MouseEvent, item: RoomHistoryPoint) => {
      const lines = makeTooltipLines(formatPeriodRange(item, period), {
        temperature: item.temp,
        setpoint: item.setpoint,
        power: item.power,
        minTemp: item.minTemp,
        maxTemp: item.maxTemp,
        count: item.count,
      });
      renderTooltipText(tooltipText, lines);

      const [pointerX, pointerY] = d3.pointer(event, chart.node());
      const tooltipWidth = Math.max(...lines.map((line) => line.length)) * 7 + 24;
      const tooltipHeight = lines.length * 16 + 16;
      const xPosition = Math.min(pointerX + 14, innerWidth - tooltipWidth);
      const yPosition = Math.max(4, pointerY - tooltipHeight - 8);
      tooltipBg.attr('width', tooltipWidth).attr('height', tooltipHeight);
      tooltip.attr('transform', `translate(${xPosition}, ${yPosition})`).style('display', null);
    };

    chart
      .selectAll('circle.tempDot')
      .data(chartData)
      .join('circle')
      .attr('class', classNames.tempDot)
      .attr('cx', (item) => x(getPointDate(item)))
      .attr('cy', (item) => y(item.temp))
      .attr('r', 4)
      .on('mouseenter', showTooltip)
      .on('mousemove', showTooltip)
      .on('mouseleave', () => tooltip.style('display', 'none'));

    const legend = svg.append('g').attr('class', classNames.legend).attr('transform', `translate(${margin.left}, 12)`);
    [
      { label: 'Температура', className: classNames.tempLegend },
      { label: 'Уставка', className: classNames.setpointLegend },
    ].forEach((item, index) => {
      const group = legend.append('g').attr('transform', `translate(${index * 130}, 0)`);
      group.append('rect').attr('width', 10).attr('height', 10).attr('rx', 2).attr('class', item.className);
      group.append('text').attr('x', 16).attr('y', 10).text(item.label);
    });
  }, [ariaLabel, classNames, data, meta, period, size]);

  return <svg ref={svgRef} className={classNames.chart} aria-label={ariaLabel} />;
};

export const BuildingHistoryLineChart = ({
  data,
  meta,
  period,
  classNames,
  size = defaultBuildingChartSize,
  ariaLabel = 'Средние данные по зданию',
}: {
  data: BuildingHistoryPoint[];
  meta?: HistoryMeta;
  period: ChartPeriod;
  classNames: BuildingHistoryLineChartClasses;
  size?: ChartSize;
  ariaLabel?: string;
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const { width, height, margin } = size;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const chartData = normalizeBuildingHistoryPoints(data, period, ariaLabel);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img');

    const domain = getChartDomain(chartData, meta);
    const x = d3.scaleTime().domain(domain).range([0, innerWidth]);
    const values = chartData.flatMap((item) => [item.avgTemp, item.avgSetpoint]);
    const y = d3
      .scaleLinear()
      .domain([Math.floor(d3.min(values) ?? 18) - 1, Math.ceil(d3.max(values) ?? 25) + 1])
      .nice()
      .range([innerHeight, 0]);

    const chart = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);
    chart
      .append('g')
      .attr('class', classNames.grid)
      .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(() => ''));
    chart
      .append('g')
      .attr('class', classNames.axis)
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(getTimeTicks(domain, period, innerWidth))
          .tickFormat((value) => formatTick(value as Date, period)),
      );
    chart.append('g').attr('class', classNames.axis).call(d3.axisLeft(y).ticks(5).tickFormat((value) => `${value}°`));

    const avgTempLine = d3
      .line<BuildingHistoryPoint>()
      .x((item) => x(getPointDate(item)))
      .y((item) => y(item.avgTemp))
      .curve(d3.curveMonotoneX);

    const avgSetpointLine = d3
      .line<BuildingHistoryPoint>()
      .x((item) => x(getPointDate(item)))
      .y((item) => y(item.avgSetpoint))
      .curve(d3.curveMonotoneX);

    chart.append('path').datum(chartData).attr('class', classNames.avgTempLine).attr('d', avgTempLine);
    chart.append('path').datum(chartData).attr('class', classNames.avgSetpointLine).attr('d', avgSetpointLine);

    const tooltip = chart.append('g').attr('class', classNames.tooltip).style('display', 'none');
    const tooltipBg = tooltip.append('rect').attr('rx', 6).attr('height', 84);
    const tooltipText = tooltip.append('text').attr('x', 10).attr('y', 18);

    const showTooltip = (event: MouseEvent, item: BuildingHistoryPoint) => {
      const lines = makeTooltipLines(formatPeriodRange(item, period), {
        temperature: item.avgTemp,
        setpoint: item.avgSetpoint,
        power: item.avgPower,
        minTemp: item.minTemp,
        maxTemp: item.maxTemp,
        count: item.count,
      });
      renderTooltipText(tooltipText, lines);
      const [pointerX, pointerY] = d3.pointer(event, chart.node());
      const tooltipWidth = Math.max(...lines.map((line) => line.length)) * 7 + 24;
      const tooltipHeight = lines.length * 16 + 16;
      tooltipBg.attr('width', tooltipWidth).attr('height', tooltipHeight);
      tooltip
        .attr('transform', `translate(${Math.min(pointerX + 14, innerWidth - tooltipWidth)}, ${Math.max(4, pointerY - tooltipHeight - 8)})`)
        .style('display', null);
    };

    chart
      .selectAll('circle.avgTempDot')
      .data(chartData)
      .join('circle')
      .attr('class', classNames.avgTempDot)
      .attr('cx', (item) => x(getPointDate(item)))
      .attr('cy', (item) => y(item.avgTemp))
      .attr('r', 4)
      .on('mouseenter', showTooltip)
      .on('mousemove', showTooltip)
      .on('mouseleave', () => tooltip.style('display', 'none'));

    const legend = svg.append('g').attr('class', classNames.legend).attr('transform', `translate(${margin.left}, 10)`);
    [
      { label: 'Средняя температура', className: classNames.avgTempLegend },
      { label: 'Средняя уставка', className: classNames.avgSetpointLegend },
    ].forEach((item, index) => {
      const group = legend.append('g').attr('transform', `translate(${index * 170}, 0)`);
      group.append('rect').attr('width', 10).attr('height', 10).attr('rx', 2).attr('class', item.className);
      group.append('text').attr('x', 16).attr('y', 10).text(item.label);
    });
  }, [ariaLabel, classNames, data, meta, period, size]);

  return <svg ref={svgRef} className={classNames.chart} aria-label={ariaLabel} />;
};
