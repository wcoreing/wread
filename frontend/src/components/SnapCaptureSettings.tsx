import { useSnapCaptureSettings } from '../hooks/useSnapCaptureSettings'

/** SnapCaptureSettings 解读截屏保留开关。 */
export default function SnapCaptureSettings() {
  const { keepCapture, setKeepCapture } = useSnapCaptureSettings()

  return (
    <div className="settings-form settings-reading-form">
      <div className="settings-form-row">
        <label className="settings-form-label">保留截屏</label>
        <div className="settings-form-control settings-form-check">
          <input
            type="checkbox"
            checked={keepCapture}
            onChange={(e) => void setKeepCapture(e.target.checked)}
          />
        </div>
      </div>
      <p className="settings-field-hint">开启后每次解读保存截屏，切换目录页仍可查看</p>
    </div>
  )
}
