import pandas as pd


df = pd.read_csv("./station_270_updates_Feb_11_2025_updated.csv", encoding="latin-1")

print(df.columns)

df2 = df[["sitename", "Latitude", "Longitude"]]
print(df.columns)
print(df)

for col in df.columns:
    df[col] = df[col].astype(str).replace(',', ';')



df2.to_csv("out.csv", index=False)
