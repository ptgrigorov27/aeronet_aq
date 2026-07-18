import * as d3 from "d3";

export type ValueScale = "AQI" | "PM";

/**
 * Generate readable labels from readings object
 */
export function genLabels(readings: Record<string, Record<string, unknown>>[]): string[] {
  const labels: string[] = [];

  for (const date in readings) {
    const keys = Object.keys(readings[date]);
    if (!keys.length) continue;

    const d = new Date(keys[0]);

    const formattedDate = d.toLocaleString("en-US", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
      hour12: false,
    });
    labels.push(formattedDate);
  }
  return labels;
}

/**
 * EPA AQI index breakpoints (unitless index).
 * EPA 2024 PM2.5 concentration breakpoints (µg/m³).
 * @see https://www.epa.gov/system/files/documents/2024-02/pm-naaqs-air-quality-index-fact-sheet.pdf
 */
function categoryColor(value: number, scale: ValueScale): d3.Color | null {
  if (scale === "PM") {
    if (value <= 9.0) return d3.color("green");
    if (value <= 35.4) return d3.color("yellow");
    if (value <= 55.4) return d3.color("orange");
    if (value <= 125.4) return d3.color("red");
    if (value <= 225.4) return d3.color("purple");
    return d3.color("maroon");
  }

  if (value <= 50) return d3.color("green");
  if (value <= 100) return d3.color("yellow");
  if (value <= 150) return d3.color("orange");
  if (value <= 200) return d3.color("red");
  if (value <= 300) return d3.color("purple");
  return d3.color("maroon");
}

/**
 * Return a color for AQI index or PM2.5 concentration (µg/m³)
 */
export function setColor(
  value: number,
  where: string,
  scale: ValueScale = "AQI"
): d3.RGBColor | d3.HSLColor | null {
  let c: d3.Color | null = categoryColor(value, scale) ?? d3.color("grey");

  if (where === "inner" && c && "opacity" in c) {
    (c as d3.RGBColor | d3.HSLColor).opacity = 0.5;
  }

  return c as d3.RGBColor | d3.HSLColor | null;
}

/**
 * Return text color for readability based on AQI / PM category
 */
export function setTextColor(value: number, scale: ValueScale = "AQI"): string {
  if (scale === "PM") {
    if (value <= 9.0) return "white";
    if (value <= 35.4) return "black";
    if (value <= 55.4) return "black";
    return "white";
  }

  if (value <= 50) return "white";
  if (value <= 100) return "black";
  if (value <= 150) return "black";
  if (value <= 200) return "white";
  if (value <= 300) return "white";
  return "white";
}

/**
 * Return category text based on AQI index or PM2.5 concentration
 */
export function setText(value: number, scale: ValueScale = "AQI"): string {
  if (scale === "PM") {
    if (value <= 9.0) return "Good";
    if (value <= 35.4) return "Moderate";
    if (value <= 55.4) return "Unhealthy for sensitive groups";
    if (value <= 125.4) return "Unhealthy";
    if (value <= 225.4) return "Very unhealthy";
    return "Hazardous";
  }

  if (value <= 50) return "Good";
  if (value <= 100) return "Moderate";
  if (value <= 150) return "Unhealthy for sensitive groups";
  if (value <= 200) return "Unhealthy";
  if (value <= 300) return "Very unhealthy";
  return "Hazardous";
}
