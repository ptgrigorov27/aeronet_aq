import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  ReactNode,
} from "react";
//import API_BASE_URL from "https://aeronet.gsfc.nasa.gov/cgi-bin/web_print_air_quality_index?";
import "../App.css"


interface Readings {
  Station: string;
  Site_Name: string;
  UTC_DATE: string;
  LatLon: [number, number];
  _3HR_PM_CONC_CNN130: number;
  _3HR_PM_CONC_CNN430: number;
  _3HR_PM_CONC_CNN730: number;
  _3HR_PM_CONC_CNN1030: number;
  _3HR_PM_CONC_CNN1330: number;
  _3HR_PM_CONC_CNN1630: number;
  _3HR_PM_CONC_CNN1930: number;
  _3HR_PM_CONC_CNN2230: number;
  _3HR_AQI130: number;
  _3HR_AQI430: number;
  _3HR_AQI730: number;
  _3HR_AQI1030: number;
  _3HR_AQI1330: number;
  _3HR_AQI1630: number;
  _3HR_AQI1930: number;
  _3HR_AQI2230: number;
  DAILY_AQI: number;
}

interface SiteContextType {
  readings: Readings[];
  refreshSites: () => void;
}

const SiteContext = createContext<SiteContextType | undefined>(undefined);

interface SiteProviderProps {
  children: ReactNode;
}

export const SiteProvider: React.FC<SiteProviderProps> = ({ children }) => {
  const [readings] = useState<Readings[]>([]);

  const fetchSites = useCallback( () => {
    try {
    } catch (error) {
      console.error("Error fetching sites:", error);
    }
  }, []);

  const refreshSites = useCallback(() => {
    fetchSites();
  }, [fetchSites]);

  return (
    <SiteContext.Provider
      value={{ readings, refreshSites }}
    >
      {children}
    </SiteContext.Provider>
  );
};

export const useSiteContext = (): SiteContextType => {
  const context = useContext(SiteContext);
  if (context === undefined) {
    throw new Error("useSiteContext must be used within a SiteProvider");
  }
  return context;
};

