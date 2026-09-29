import { addDays, isoDate } from "@/lib/geo";
import { CHECK_LABELS, CheckResult, IntegrityContext, skipped } from "../types";

export interface DailyWeather {
  date: string;
  precipitationMm: number | null;
  tempMaxC: number | null;
}

/**
 * Daily precipitation from Open-Meteo (keyless; free for non-commercial use).
 * The archive API lags ~5 days, so recent dates use the forecast API's history.
 */
export async function fetchDailyWeather(lat: number, lng: number, from: Date, to: Date): Promise<DailyWeather[]> {
  const recent = Date.now() - to.getTime() < 60 * 86_400_000;
  const base = recent ? "https://api.open-meteo.com/v1/forecast" : "https://archive-api.open-meteo.com/v1/archive";
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    start_date: isoDate(from),
    end_date: isoDate(to),
    daily: "precipitation_sum,temperature_2m_max",
    timezone: "auto",
  });
  const res = await fetch(`${base}?${params}`);
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.reason || `Open-Meteo HTTP ${res.status}`);

  const days: string[] = json.daily?.time ?? [];
  return days.map((date, i) => ({
    date,
    precipitationMm: json.daily.precipitation_sum?.[i] ?? null,
    tempMaxC: json.daily.temperature_2m_max?.[i] ?? null,
  }));
}

/** Check 5: does the sky/ground in the photo match what the weather record says? */
export async function checkWeather(ctx: IntegrityContext): Promise<CheckResult> {
  if (!ctx.site) return skipped("weather", "No location (photo GPS or project site) to look up weather for.");
  if (!ctx.takenAt) return skipped("weather", "No capture date to look up weather for.");
  if (ctx.takenAt.getTime() > Date.now()) return skipped("weather", "Capture date is in the future.");

  const days = await fetchDailyWeather(ctx.site.lat, ctx.site.lng, addDays(ctx.takenAt, -2), ctx.takenAt);
  const today = days.at(-1);
  const dayMm = today?.precipitationMm ?? null;
  const threeDayMm = days.reduce((s, d) => s + (d.precipitationMm ?? 0), 0);
  const details = {
    site: ctx.site,
    date: isoDate(ctx.takenAt),
    dateSource: ctx.takenAtSource,
    days,
    dayMm,
    threeDayMm: Math.round(threeDayMm * 10) / 10,
    scene: ctx.vision?.scene ?? null,
  };

  if (dayMm === null) return skipped("weather", "No weather record for that date and place.", details);

  const scene = ctx.vision?.scene;
  if (!scene) {
    return skipped(
      "weather",
      `${dayMm} mm rain recorded that day, but no visual weather cues were extracted to compare against.`,
      details
    );
  }

  if (scene.raining && dayMm < 0.5) {
    return {
      id: "weather",
      label: CHECK_LABELS.weather,
      status: "fail",
      penalty: 15,
      confidence: "medium",
      summary: `Photo shows rain, but ${dayMm} mm was recorded at this site that day.`,
      details,
    };
  }
  if ((scene.wetGround || scene.flooding) && threeDayMm < 1) {
    return {
      id: "weather",
      label: CHECK_LABELS.weather,
      status: "fail",
      penalty: 15,
      confidence: "medium",
      summary: `Photo shows wet ground or flooding, but only ${details.threeDayMm} mm fell in the 3 days before.`,
      details,
    };
  }
  if (scene.dryDusty && dayMm > 20) {
    return {
      id: "weather",
      label: CHECK_LABELS.weather,
      status: "warn",
      penalty: 7,
      confidence: "low",
      summary: `Photo looks dry and dusty, but ${dayMm} mm of rain fell that day.`,
      details,
    };
  }

  const cue = scene.raining || scene.wetGround || scene.flooding ? "wet conditions in the photo" : "dry conditions in the photo";
  return {
    id: "weather",
    label: CHECK_LABELS.weather,
    status: "pass",
    penalty: 0,
    confidence: "medium",
    summary: `${dayMm} mm rain that day (${details.threeDayMm} mm over 3 days), consistent with ${cue}.`,
    details,
  };
}
