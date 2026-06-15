import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { loadAboutStyles } from "../../../styles/featureStyleLoaders";

const ABOUT_APP_NAME = "LawyerCopilot";
const ABOUT_WINDOW_TITLE = `关于 ${ABOUT_APP_NAME}`;

export function AboutView() {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    void loadAboutStyles();
  }, []);

  useEffect(() => {
    try {
      void getCurrentWindow().setTitle(ABOUT_WINDOW_TITLE).catch(() => {});
    } catch {
      // Browser tests and non-Tauri previews do not always expose a native window.
    }
  }, []);

  useEffect(() => {
    let active = true;
    const fetchVersion = async () => {
      try {
        const value = await getVersion();
        if (active) {
          setVersion(value);
        }
      } catch {
        if (active) {
          setVersion(null);
        }
      }
    };

    void fetchVersion();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="about">
      <div className="about-card">
        <div className="about-header">
          <img
            className="about-icon"
            src="/app-icon.png"
            alt={`${ABOUT_APP_NAME} icon`}
          />
          <div className="about-title">{ABOUT_APP_NAME}</div>
        </div>
        <div className="about-version">
          {version ? `${t("about.version")} ${version}` : `${t("about.version")} —`}
        </div>
        <div className="about-tagline">
          {t("about.tagline")}
        </div>
      </div>
    </div>
  );
}
