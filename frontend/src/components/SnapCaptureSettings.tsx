import ToggleSwitch from './ToggleSwitch'
import { useSnapCaptureSettings } from '../hooks/useSnapCaptureSettings'

/** SnapCaptureSettings 解读截屏保留开关。 */
export default function SnapCaptureSettings() {
  const { keepCapture, setKeepCapture } = useSnapCaptureSettings()

  return (
    <div className="settings-form settings-reading-form">
      <div className="settings-form-row">
        <label className="settings-form-label">保留截屏</label>
        <ToggleSwitch
          className="settings-form-toggle"
          checked={keepCapture}
          label="保留截屏"
          title="开启后每次解读保存截屏，切换目录页仍可查看"
          onChange={(on) => void setKeepCapture(on)}
        />
      </div>
      <p className="settings-field-hint">开启后每次解读保存截屏，切换目录页仍可查看</p>
    </div>
  )
}
