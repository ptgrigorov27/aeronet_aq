import os
import json
import time
import pandas as pd
from datetime import date, timedelta

def df_to_geojson(df, lat_col="Lat", lon_col="Lon"):
    features = []

    for _, row in df.iterrows():
        if pd.isna(row[lat_col]) or pd.isna(row[lon_col]):
            continue

        properties = row.drop([lat_col, lon_col]).to_dict()

        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [float(row[lon_col]), float(row[lat_col])]
            },
            "properties": properties
        }

        features.append(feature)

    return {
        "type": "FeatureCollection",
        "features": features
    }

def process_station(pred_dir, aqi_dir, file_forecast, OUTDIR):
    
    df_pred = pd.read_csv(pred_dir, low_memory=False)
    
    time_cols = [col for col in df_pred.columns if "UTC" in col]
    pm_cols = [col for col in df_pred.columns if "3HR" in col and "OLD" not in col]
    
    if len(pm_cols) > 2:
        pm_cols = pm_cols[1:]
        df_pred = df_pred.drop(pm_cols[0], axis=1)
    
    if len(pm_cols) <= 1 or df_pred.empty:
        return None
    
    new_pm_cols = []
    for col in pm_cols:
        if "AQI" in col:
            new_col = col.replace("_TCNN","")
            new_pm_cols.append(new_col)
        else:
            new_col = col.replace("_TCNN","_CNN")
            new_pm_cols.append(new_col)
            
    df_pred = df_pred.rename(columns=dict(zip(pm_cols, new_pm_cols)))
    df_pred = df_pred[['Site_Name','Lat','Lon'] + time_cols + new_pm_cols]    
    
    df_pred = df_pred.pivot(
        index = ['Site_Name', 'Lat', 'Lon', 'UTC_DATE'],
        columns ='UTC_TIME',
        values = new_pm_cols
    )
    
    df_pred.columns = [f'{col[0]}({col[1]})' for col in df_pred.columns]
    aqi_cols = [col for col in df_pred.columns if 'AQI' in col]
    
    try:
        df_pred[aqi_cols] = df_pred[aqi_cols].astype('Int64')
    except:
        pass #already in integer format
    
    df_pred = df_pred.reset_index()
    
    df_aqi = pd.read_csv(aqi_dir, low_memory=False)
    daily_aqi_col = [col for col in df_aqi.columns if "DAILY_AQI" in col and "OLD" not in col]
    df_aqi = df_aqi[["Station","Site_Name","UTC_DATE"] + daily_aqi_col]
    df_aqi.rename(columns={df_aqi.columns[3]: "DAILY_AQI"}, inplace=True)

    df_forecast = df_pred.merge(df_aqi, on=['Site_Name', 'UTC_DATE'], how='inner')
    df_forecast.insert(0, 'Station', df_forecast.pop('Station'))
    df_forecast.sort_values(by='Station', inplace=True)
    df_forecast = df_forecast.reset_index(drop=True)
    
    geojson_obj = df_to_geojson(df_forecast, lat_col="Lat", lon_col="Lon")

    gj_path = os.path.join(OUTDIR, file_forecast + ".geojson")
    with open(gj_path, "w") as f:
        json.dump(geojson_obj, f, indent=2)
    
    return None

def main():
    FORECASTS = ["DoS","AERONET","OpenAQ","AAQE"]
    WEBDIR = "/var/www/html/aeronet/data_push/AQI/"
    DIR_LIST = ['output', 'output_AERONET_site', 'output_OpenAQ_site', 'output_TCNN_AAQE']
    OUTDIR_LIST = []
    
    for forecast in FORECASTS:
        temp_dir = os.path.join(WEBDIR,"output_"+forecast+"_geoJSON")
        os.makedirs(temp_dir, exist_ok=True)
        OUTDIR_LIST.append(temp_dir)
        
    start_date = date.today()
    #start_date = date(2024, 3, 1) #uncomment, if you want to download historical data too
    current_date = start_date
    end_date = date.today()
    
    while current_date <= end_date:
               
        current_day = current_date.strftime("%Y%m%d")
        file_forecast = current_day+"_forecast"
        
        for DIR, OUTDIR in zip(DIR_LIST, OUTDIR_LIST):
            
            if DIR == "output_TCNN_AAQE":
                file_pred = current_day+"_pred_TCNN"
                file_aqi = current_day+"_aqi_TCNN"
            else:
                file_pred = current_day+"_pred"
                file_aqi = current_day+"_aqi"
                
            os.makedirs(OUTDIR, exist_ok=True)
            
            pred_dir = os.path.join(WEBDIR, DIR,file_pred+".csv")
            aqi_dir = os.path.join(WEBDIR, DIR,"aqi/",file_aqi+".csv")                
                
            while True:
                if os.path.exists(pred_dir):    
                    process_station(pred_dir, aqi_dir, file_forecast, OUTDIR)
                    break
                else:
                    time.sleep(3600)
            
        current_date += timedelta(days = 1)
                    
main()