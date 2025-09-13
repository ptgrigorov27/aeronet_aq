import * as d3 from "d3";

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
 * Return a color for AQI / PM value
 */
export function setColor(value: number, where: string): d3.RGBColor | d3.HSLColor | null {
  let c: d3.Color | null = d3.color("grey");

  if (where === "outter") {
    if (value <= 50) c = d3.color("green");
    else if (value <= 100) c = d3.color("yellow");
    else if (value <= 150) c = d3.color("orange");
    else if (value <= 200) c = d3.color("red");
    else if (value <= 300) c = d3.color("purple");
    else c = d3.color("maroon");
  } else if (where === "inner") {
    if (value <= 50) c = d3.color("green");
    else if (value <= 100) c = d3.color("yellow");
    else if (value <= 150) c = d3.color("orange");
    else if (value <= 200) c = d3.color("red");
    else if (value <= 300) c = d3.color("purple");
    else c = d3.color("maroon");

    // ✅ safely set opacity
    if (c && "opacity" in c) {
      (c as d3.RGBColor | d3.HSLColor).opacity = 0.5;
    }
  }

  return c as d3.RGBColor | d3.HSLColor | null;
}

/**
 * Return text color for readability based on AQI value
 */
export function setTextColor(value: number): string {
  if (value <= 50) return "white";
  if (value <= 100) return "black";
  if (value <= 150) return "black";
  if (value <= 200) return "white";
  if (value <= 300) return "white";
  return "white";
}

/**
 * Return AQI category text based on value
 */
export function setText(value: number): string {
  if (value <= 50) return "Good";
  if (value <= 100) return "Moderate";
  if (value <= 150) return "Unhealthy for sensitive groups";
  if (value <= 200) return "Unhealthy";
  if (value <= 300) return "Very unhealthy";
  return "Hazardous";
}
