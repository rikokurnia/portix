"use client";
import { useEffect, useRef } from "react";
import {
  createChart,
  LineSeries,
  ColorType,
  LineStyle,
  type Time,
} from "lightweight-charts";
export interface ChartSeries {
  name: string;
  color: string;
  logo: string;
  values: { time: string; value: number }[];
}
export function Chart({
  series,
  height = 190,
}: {
  series: ChartSeries[];
  height?: number;
}) {
  const host = useRef<HTMLDivElement>(null),
    labels = useRef<HTMLDivElement>(null),
    tooltip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const chart = createChart(host.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#ccc1e4",
        fontFamily: "Arial",
        fontSize: 11,
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: "#9582b520", style: LineStyle.Dotted },
        horzLines: { color: "#9582b530", style: LineStyle.Dotted },
      },
      leftPriceScale: {
        visible: true,
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      rightPriceScale: { visible: false },
      timeScale: {
        borderColor: "#9582b555",
        rightOffset: 0.7,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      crosshair: { horzLine: { labelVisible: false } },
      handleScroll: false,
      handleScale: false,
      localization: { priceFormatter: (p: number) => `${p.toFixed(1)}%` },
    });
    const lines = series.map((s) => {
      const line = chart.addSeries(LineSeries, {
        color: s.color,
        lineWidth: 2,
        priceScaleId: "left",
        lastValueVisible: false,
        priceLineVisible: false,
        pointMarkersVisible: true,
        pointMarkersRadius: 3,
      });
      line.setData(s.values.map((v) => ({ ...v, time: v.time as Time })));
      return line;
    });
    chart.timeScale().fitContent();
    const position = () => {
      series.forEach((s, i) => {
        const last = s.values.at(-1)!;
        const x = chart.timeScale().timeToCoordinate(last.time as Time),
          y = lines[i].priceToCoordinate(last.value);
        const el = labels.current?.children[i] as HTMLElement | undefined;
        if (el) {
          el.style.display = x === null || y === null ? "none" : "block";
          el.style.left = `${(x ?? 0) + chart.priceScale("left").width() + 8}px`;
          el.style.top = `${(y ?? 0) - 11}px`;
        }
      });
    };
    const observer = new ResizeObserver(() => {
      if (host.current) {
        chart.resize(host.current.clientWidth, height);
        chart.timeScale().fitContent();
        position();
      }
    });
    observer.observe(host.current);
    chart.timeScale().subscribeVisibleLogicalRangeChange(position);
    chart.subscribeCrosshairMove((p) => {
      const el = tooltip.current;
      if (!el) return;
      if (!p.time || !p.point) {
        el.hidden = true;
        return;
      }
      el.hidden = false;
      el.textContent =
        `${String(p.time)} · ` +
        lines
          .map((line, i) => {
            const d = p.seriesData.get(line);
            return d && "value" in d
              ? `${series[i].name} ${d.value.toFixed(2)}%`
              : "";
          })
          .filter(Boolean)
          .join(" · ");
    });
    const frame = requestAnimationFrame(position);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      chart.remove();
    };
  }, [series, height]);
  return (
    <div className="chart-wrap" aria-label="Seven-day APY chart">
      <div ref={host} />
      <div ref={labels} className="chart-endpoints" aria-hidden="true">
        {series.map((s) => (
          <img key={s.name} src={s.logo} alt="" width="23" height="23" />
        ))}
      </div>
      <div ref={tooltip} className="chart-tooltip" hidden />
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.name}>
            <i style={{ background: s.color }} />
            {s.name} <b>{s.values.at(-1)?.value.toFixed(1)}%</b>
          </span>
        ))}
      </div>
    </div>
  );
}
