import json
import pandas as pd

desired_cols = ["sitename", "Latitude", "Longitude", "Forecast"]
df1 = pd.read_csv("./station_270_updates_Feb_11_2025_updated.csv", encoding="latin-1")
df2 = pd.read_csv("./stations_AERONET_07262024.csv", encoding="latin-1")
df3 = pd.read_csv("./stations_OpenAQ_05082025.csv", encoding="latin-1")
df4 = pd.read_csv("./AAQE_station_07302025.csv", encoding="latin-1")

df1['Forecast'] = "DoS Missions"
df2['Forecast'] = "AERONET"
df3['Forecast'] = "Open AQ"
df4['Forecast'] = "African AQE"

df2["sitename"] = df2["sitename"].str.replace("-", "_", regex=False).str.strip()

df = pd.concat([df1[desired_cols], df2[desired_cols], df3[desired_cols], df4[desired_cols]], axis=0)

for col in df.columns:
    df[col] = df[col].astype(str).replace(",", ";")

df["Latitude"] = pd.to_numeric(df["Latitude"], errors="coerce")
df["Longitude"] = pd.to_numeric(df["Longitude"], errors="coerce")

features = []

for _, row in df.iterrows():
    lat = float(row["Latitude"])
    lon = float(row["Longitude"])

    feature = {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [lon, lat]  # GeoJSON uses [lon, lat]
        },
        "properties": {
            "sitename": row["sitename"],
            "Forecast": row["Forecast"]
        }
    }
    features.append(feature)

geojson = {
    "type": "FeatureCollection",
    "features": features
}

with open("out.geojson", "w", encoding="utf-8") as f:
    json.dump(geojson, f, ensure_ascii=False, indent=2)