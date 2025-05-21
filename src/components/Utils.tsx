import * as d3 from "d3";

export function genLabels(readings): string[] {
  const labels = [];

  ////for (const rDate of Object.keys(readings[0])) { // uncomment if reverting back to line graph with all values [3 d] array
  for (const date in readings) {
    const d = new Date(Object.keys(readings[date])[0]);

    const formattedDate = d.toLocaleString("en-US", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      //minute: '2-digit',
      timeZone: "UTC",
      hour12: false,
    });
    labels.push(formattedDate);
  }
  return labels;
}

export function setColor(value: number, where: string): d3.color {
  let c = d3.color("grey");
  if (where === "outter") {
    if (value <= 50) {
      c = d3.color("green");
    } else if (value <= 100) {
      c = d3.color("yellow");
    } else if (value <= 150) {
      c = d3.color("orange");
    } else if (value <= 200) {
      c = d3.color("red");
    } else if (value <= 300) {
      c = d3.color("purple");
    } else {
      c = d3.color("maroon");
    }
  } else if (where === "inner") {
    if (value <= 50) {
      c = d3.color("green");
      c.opacity = 0.5;
    } else if (value <= 100) {
      c = d3.color("yellow");
      c.opacity = 0.5;
    } else if (value <= 150) {
      c = d3.color("orange");
      c.opacity = 0.5;
    } else if (value <= 200) {
      c = d3.color("red");
      c.opacity = 0.5;
    } else if (value <= 300) {
      c = d3.color("purple");
      c.opacity = 0.5;
    } else {
      c = d3.color("maroon");
      c.opacity = 0.5;
    }
  }

  return c;
}

export function setTextColor(value: number): string {
  if (value <= 50) {
    return "white";
  } else if (value <= 100) {
    return "black";
  } else if (value <= 150) {
    return "black";
  } else if (value <= 200) {
    return "white";
  } else if (value <= 300) {
    return "white";
  } else {
    return "white";
  }
}

export function setText(value: number): string {
  if (value <= 50) {
    return "Good";
  } else if (value <= 100) {
    return "Moderate";
  } else if (value <= 150) {
    return "Unhealthy for sensitive groups";
  } else if (value <= 200) {
    return "Unhealthy";
  } else if (value <= 300) {
    return "Very unhealthy";
  } else {
    return "Hazardous";
  }
}

// export function setColor(
//   value: number,
//   where: string,
//   type: string = "AQI",
// ): d3.color {
//   const defaultC = d3.color("grey");
//   if (where === "outter") {
//     if (type.includes("PM")) {
//       switch (true) {
//         case value <= 12:
//           return d3.color("green");
//         case value <= 35:
//           return d3.color("yellow");
//         case value <= 55:
//           return d3.color("orange");
//         case value <= 150:
//           return d3.color("red");
//         case value <= 250:
//           return d3.color("purple");
//         case value > 250:
//           return d3.color("maroon");
//         default:
//           return defaultC;
//       }
//     }
//     if (type.includes("AQI")) {
//       switch (true) {
//         case value <= 50:
//           return d3.color("green");
//         case value <= 100:
//           return d3.color("yellow");
//         case value <= 150:
//           return d3.color("orange");
//         case value <= 200:
//           return d3.color("red");
//         case value <= 300:
//           return d3.color("purple");
//         case value > 300:
//           return d3.color("maroon");
//         default:
//           return defaultC;
//       }
//     }
//   }
//
//   if (where === "inner") {
//     if (type.includes("PM")) {
//       switch (true) {
//         case value <= 12:
//           return d3.color("green");
//         case value <= 35:
//           return d3.color("yellow");
//         case value <= 55:
//           return d3.color("orange");
//         case value <= 150:
//           return d3.color("red");
//         case value <= 250:
//           return d3.color("purple");
//         case value > 250:
//           return d3.color("maroon");
//         default:
//           return defaultC;
//       }
//     }
//     if (type.includes("AQI")) {
//       switch (true) {
//         case value <= 50:
//           return d3.color("green").opacity(0.5);
//         case value <= 100:
//           return d3.color("yellow").opacity(0.5);
//         case value <= 150:
//           return d3.color("orange").opacity(0.5);
//         case value <= 200:
//           return d3.color("red").opacity(0.5);
//         case value <= 300:
//           return d3.color("purple").opacity(0.5);
//         case value > 300:
//           return d3.color("maroon").opacity(0.5);
//         default:
//           return defaultC;
//       }
//     }
//   }
// }
//
// export function setTextColor(value: number, type: string = "AQI"): d3.color {
//   const defaultC = d3.color("white");
//   switch (true) {
//     case value <= 50:
//       return d3.color("white");
//     case value <= 100:
//       return d3.color("black");
//     case value <= 150:
//       return d3.color("black");
//     case value <= 200:
//       return d3.color("white");
//     case value <= 300:
//       return d3.color("white");
//     case value > 300:
//       return d3.color("white");
//     default:
//       return defaultC;
//   }
// }
// // NOTE: added to method
// export function setText(value: number, type: string = "AQI"): string {
//   const bad: string = "Invalid";
//   switch (true) {
//     case value <= 50:
//       return "Good";
//     case value <= 100:
//       return "Moderate";
//     case value <= 150:
//       return "Unhealthy for sensitive groups";
//     case value <= 200:
//       return "Unhealthy";
//     case value <= 300:
//       return "Very unhealthy";
//     case value > 300:
//       return "Hazardous";
//     default:
//       return bad;
//   }
// }
