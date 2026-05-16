import { s } from "../styles";

export function SettingsPanel({
  portInput,
  setPortInput,
  hostInput,
  setHostInput,
  onApply,
  onCancel,
}: {
  portInput: string;
  setPortInput: (v: string) => void;
  hostInput: string;
  setHostInput: (v: string) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  const portNum = parseInt(portInput);
  const portValid = !isNaN(portNum) && portNum >= 1024 && portNum <= 65535;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        height: "100%",
      }}
    >
      <p style={{ ...s.sectionLabel, marginBottom: 20 }}>// SETTINGS</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Port */}
        <div style={s.settingRow}>
          <label style={s.settingLabel}>
            SIGNALING PORT
            <span
              style={{
                color: "var(--text-muted)",
                fontWeight: 400,
                fontSize: 9,
              }}
            >
              {" "}
              (1024–65535)
            </span>
          </label>
          <input
            type="number"
            value={portInput}
            onChange={(e) => setPortInput(e.target.value)}
            min={1024}
            max={65535}
            style={{
              ...s.settingInput,
              borderColor: portValid ? "var(--border-bright)" : "var(--danger)",
            }}
            onFocus={(e) => {
              if (portValid) e.target.style.borderColor = "var(--accent)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = portValid
                ? "var(--border-bright)"
                : "var(--danger)";
            }}
          />
          {!portValid && portInput !== "" && (
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 9,
                color: "var(--danger)",
                letterSpacing: "0.05em",
              }}
            >
              Port tidak valid
            </span>
          )}
        </div>

        {/* Host URL */}
        <div style={s.settingRow}>
          <label style={s.settingLabel}>
            WEB APP URL
            <span
              style={{
                color: "var(--text-muted)",
                fontWeight: 400,
                fontSize: 9,
              }}
            >
              {" "}
              (untuk QR)
            </span>
          </label>
          <input
            type="url"
            value={hostInput}
            onChange={(e) => setHostInput(e.target.value)}
            placeholder="https://ipcam.upkan.id"
            style={s.settingInput}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--accent)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--border-bright)";
            }}
          />
          <p
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--text-muted)",
              letterSpacing: "0.04em",
              lineHeight: 1.6,
            }}
          >
            URL yang di-encode ke QR code. Ubah ke{" "}
            <span style={{ color: "var(--text)" }}>http://&lt;ip&gt;:5173</span>{" "}
            saat dev lokal.
          </p>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onApply}
          disabled={!portValid}
          style={{
            ...s.startBtn,
            flex: 1,
            marginBottom: 0,
            opacity: portValid ? 1 : 0.4,
            cursor: portValid ? "pointer" : "not-allowed",
          }}
        >
          APPLY
        </button>
        <button
          onClick={onCancel}
          style={{ ...s.stopBtn, padding: "11px 16px", marginBottom: 0 }}
        >
          CANCEL
        </button>
      </div>

      <div style={{ height: 16 }} />
      <div style={s.panelFooter}>
        <span>PORT CHANGE RESTARTS SERVER</span>
      </div>
    </div>
  );
}
