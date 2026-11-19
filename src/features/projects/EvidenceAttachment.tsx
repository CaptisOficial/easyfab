import { useEffect, useState } from "react";
import { readResultsEvidence } from "../../lib/results-api";

/** Read through the authorized IPC boundary; never expose workspace paths. */
export function EvidenceAttachment({ projectId, file, disabled, onOpen }: {
  projectId: string;
  file: { id: string; name: string };
  disabled?: boolean;
  onOpen: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    setPreview(null);
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["png", "jpg", "jpeg"].includes(extension)) return;
    let active = true;
    const reader = new FileReader();
    reader.onload = () => { if (active && typeof reader.result === "string") setPreview(reader.result); };
    void readResultsEvidence(projectId, file.id).then(bytes => {
      if (active) reader.readAsDataURL(new Blob([new Uint8Array(bytes)], { type: extension === "png" ? "image/png" : "image/jpeg" }));
    }).catch(() => { /* Keep the native open action available on read failure. */ });
    return () => { active = false; if (reader.readyState === FileReader.LOADING) reader.abort(); };
  }, [projectId, file.id, file.name]);
  return (
    <button type="button" className="action results-evidence-attachment" disabled={disabled} onClick={onOpen}>
      {preview && <img src={preview} alt="" onError={() => setPreview(null)} />}
      <span>{file.name}</span>
    </button>
  );
}
