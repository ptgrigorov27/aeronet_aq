import React, { useEffect, useState } from "react";
import { Box } from "@mui/material";

interface ColorLegendProps {
  type: string;
}

const ColorLegend: React.FC<ColorLegendProps> = ({ type }) => {
  const [scrnWidth, setScrnWidth] = useState(5000);
  useEffect(() => {
    const handleResize = () => {
      setScrnWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);
  return (
    <>
      {type.includes("AQ") && scrnWidth > 575 && (
        <Box
          sx={{
            position: "absolute",
            bottom: "16px",
            left: "calc(50vw - (539.4px/2))",
            zIndex: 1000,
            pointerEvents: "auto",
            width: "547.4px",
            padding: "0px",
            backgroundColor: "rgba(255,255,255,0.8)",
            borderRadius: "8px",
            boxShadow: "0 0 5px rgba(0, 0, 0, 0.5)",
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex" }}>
            <div
              style={{
                borderRadius: "8px 0 0 0 ",
                width: "49.33px",
                height: "auto",
                backgroundColor: "green",
                padding: "5px",
              }}
            >
              Good
            </div>
            <div
              style={{
                width: "70.65px",
                height: "auto",
                backgroundColor: "yellow",
                padding: "5px",
              }}
            >
              Moderate
            </div>
            <div
              style={{
                width: "183.28px",
                height: "auto",
                backgroundColor: "orange",
                padding: "5px",
              }}
            >
              Unhealthy for sensitive groups
            </div>
            <div
              style={{
                width: "65.65px",
                height: "auto",
                color: "white",
                backgroundColor: "red",
                padding: "5px",
              }}
            >
              Unhealthy
            </div>
            <div
              style={{
                width: "99.32px",
                height: "auto",
                color: "white",
                backgroundColor: "purple",
                padding: "5px",
              }}
            >
              Very unhealthy
            </div>
            <div
              style={{
                borderRadius: "0 8px 0 0 ",
                width: "79.2px",
                height: "maroon",
                color: "white",
                backgroundColor: "#b91c1c",
                padding: "5px",
              }}
            >
              Hazardous
            </div>
          </div>
          <div style={{ display: "flex" }}>
            <div style={{ width: "49.33px", height: "auto", padding: "2px" }}>
              0-50
            </div>
            <div style={{ width: "70.65px", height: "auto", padding: "2px" }}>
              51-100
            </div>
            <div style={{ width: "183.28px", height: "auto", padding: "2px" }}>
              101-150
            </div>
            <div style={{ width: "65.65px", height: "auto", padding: "2px" }}>
              151-200
            </div>
            <div style={{ width: "99.32px", height: "auto", padding: "2px" }}>
              201-300
            </div>
            <div
              style={{
                borderRadius: "0 0 8px 0",
                width: "79.2px",
                height: "auto",
                padding: "2px",
              }}
            >
              301+
            </div>
          </div>
        </Box>
      )}
      {type.includes("AQ") && scrnWidth <= 575 && (
        <Box
          sx={{
            position: "absolute",
            width: "45vw",
            minWidth: "240px",
            bottom: "5vh",
            left: "calc(50vw - (90vw/2))",
            zIndex: 1000,
            pointerEvents: "auto",
            padding: "0px",
            backgroundColor: "rgba(255,255,255,0.8)",
            borderRadius: "8px",
            boxShadow: "0 0 5px rgba(0, 0, 0, 0.3)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gridGap: "4px",
            }}
          >
            {/* Top Row (Columns) */}
            <div
              style={{
                gridColumn: "1",
                gridRow: "1",
                borderRadius: "8px 0 0 0",
                height: "auto",
                backgroundColor: "green",
                padding: "5px",
              }}
            >
              Good
            </div>
            <div
              style={{
                gridColumn: "1",
                gridRow: "2",
                height: "auto",
                backgroundColor: "yellow",
                padding: "5px",
              }}
            >
              Moderate
            </div>
            <div
              style={{
                gridColumn: "1",
                gridRow: "3",
                width: "183.28px",
                height: "auto",
                backgroundColor: "orange",
                padding: "5px",
              }}
            >
              Unhealthy for sensitive groups
            </div>
            <div
              style={{
                gridColumn: "1",
                gridRow: "4",
                height: "auto",
                color: "white",
                backgroundColor: "red",
                padding: "5px",
              }}
            >
              Unhealthy
            </div>
            <div
              style={{
                gridColumn: "1",
                gridRow: "5",
                height: "auto",
                color: "white",
                backgroundColor: "purple",
                padding: "5px",
              }}
            >
              Very unhealthy
            </div>
            <div
              style={{
                gridColumn: "1",
                gridRow: "6",
                borderRadius: "0 0 0 8px ",
                height: "auto",
                padding: "5px",
                color: "white",
                backgroundColor: "#b91c1c",
              }}
            >
              Hazardous
            </div>

            {/* Bottom Row (Values) */}
            <div
              style={{
                gridColumn: "2",
                gridRow: "1",
                height: "auto",
                padding: "2px",
              }}
            >
              0-50
            </div>
            <div
              style={{
                gridColumn: "2",
                gridRow: "2",
                height: "auto",
                padding: "2px",
              }}
            >
              51-100
            </div>
            <div
              style={{
                gridColumn: "2",
                gridRow: "3",
                height: "auto",
                padding: "2px",
              }}
            >
              101-150
            </div>
            <div
              style={{
                gridColumn: "2",
                gridRow: "4",
                height: "auto",
                padding: "2px",
              }}
            >
              151-200
            </div>
            <div
              style={{
                gridColumn: "2",
                gridRow: "5",
                height: "auto",
                padding: "2px",
              }}
            >
              201-300
            </div>
            <div
              style={{
                gridColumn: "2",
                gridRow: "6",
                height: "auto",
                padding: "2px",
              }}
            >
              301+
            </div>
          </div>
        </Box>
      )}

      {type == "PM" && (
        <Box
          sx={{
            position: "absolute",
            bottom: "16px",
            left: "calc(50vw - (539.4px/2))",
            zIndex: 1000,
            pointerEvents: "auto",
            width: "547.4px",
            padding: "0px",
            backgroundColor: "rgba(255,255,255,0.8)",
            borderRadius: "8px",
            boxShadow: "0 0 5px rgba(0, 0, 0, 0.5)",
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex" }}>
            <div
              style={{
                borderRadius: "8px 0 0 0 ",
                width: "49.33px",
                height: "auto",
                backgroundColor: "green",
                padding: "5px",
              }}
            >
              Good
            </div>
            <div
              style={{
                width: "70.65px",
                height: "auto",
                backgroundColor: "yellow",
                padding: "5px",
              }}
            >
              Moderate
            </div>
            <div
              style={{
                width: "183.28px",
                height: "auto",
                backgroundColor: "orange",
                padding: "5px",
              }}
            >
              Unhealthy for sensitive groups
            </div>
            <div
              style={{
                width: "65.65px",
                height: "auto",
                color: "white",
                backgroundColor: "red",
                padding: "5px",
              }}
            >
              Unhealthy
            </div>
            <div
              style={{
                width: "99.32px",
                height: "auto",
                color: "white",
                backgroundColor: "purple",
                padding: "5px",
              }}
            >
              Very unhealthy
            </div>
            <div
              style={{
                borderRadius: "0 8px 0 0 ",
                width: "79.2px",
                height: "maroon",
                color: "white",
                backgroundColor: "#b91c1c",
                padding: "5px",
              }}
            >
              Hazardous
            </div>
          </div>
          <div style={{ display: "flex" }}>
            <div style={{ width: "49.33px", height: "auto", padding: "2px" }}>
              0-12
            </div>
            <div style={{ width: "70.65px", height: "auto", padding: "2px" }}>
              13-35
            </div>
            <div style={{ width: "183.28px", height: "auto", padding: "2px" }}>
              36-55
            </div>
            <div style={{ width: "65.65px", height: "auto", padding: "2px" }}>
              56-150
            </div>
            <div style={{ width: "99.32px", height: "auto", padding: "2px" }}>
              151-250
            </div>
            <div
              style={{
                borderRadius: "0 0 8px 0",
                width: "79.2px",
                height: "auto",
                padding: "2px",
              }}
            >
              251+
            </div>
          </div>
        </Box>
      )}
    </>
  );
};

export default ColorLegend;
