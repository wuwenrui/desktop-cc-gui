import { useTranslation } from "react-i18next";
import Folder from "lucide-react/dist/esm/icons/folder";
import Globe2 from "lucide-react/dist/esm/icons/globe-2";
import HardDrive from "lucide-react/dist/esm/icons/hard-drive";

import { cn } from "../../../lib/utils";

type ProjectMapStorageSwitchProps = {
  activeReadLocation: "global" | "project";
  onSwitchReadLocation: (location: "global" | "project") => void;
};

export function ProjectMapStorageSwitch({
  activeReadLocation,
  onSwitchReadLocation,
}: ProjectMapStorageSwitchProps) {
  const { t } = useTranslation();

  return (
    <div
      className="project-map-storage-switch"
      role="group"
      aria-label={t("projectMap.storage.readLocation")}
    >
      <span className="project-map-storage-label">
        <HardDrive aria-hidden />
        {t("projectMap.storage.readLocation")}
      </span>
      <button
        type="button"
        className={cn(activeReadLocation === "global" && "is-active")}
        aria-pressed={activeReadLocation === "global"}
        onClick={() => onSwitchReadLocation("global")}
      >
        <Globe2 aria-hidden />
        {t("projectMap.storage.global")}
      </button>
      <button
        type="button"
        className={cn(activeReadLocation === "project" && "is-active")}
        aria-pressed={activeReadLocation === "project"}
        onClick={() => onSwitchReadLocation("project")}
      >
        <Folder aria-hidden />
        {t("projectMap.storage.project")}
      </button>
    </div>
  );
}
